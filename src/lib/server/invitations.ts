import { createServerFn } from "@tanstack/react-start";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feed, playerInvitations, users } from "@/db/schema";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationTokenPrefix,
} from "@/lib/invitations/token";
import { getCurrentDatabaseUser } from "@/lib/server/current-user";
import { requireAuthMiddleware } from "@/middleware";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const maximumOpenInvitations = 5;

export const validateInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const [invitation] = await db
      .select({ id: playerInvitations.id })
      .from(playerInvitations)
      .where(
        and(
          eq(playerInvitations.tokenHash, hashInvitationToken(data.token)),
          isNull(playerInvitations.redeemedAt),
          isNull(playerInvitations.revokedAt),
          gt(playerInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!invitation)
      throw new Error("Invitation is invalid or no longer available");
    return { valid: true };
  });

export const listMyInvitations = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw new Error("Authentication required");
    const currentUser = await getCurrentDatabaseUser(context.user);
    if (!currentUser) throw new Error("Player profile not found");

    return db
      .select({
        id: playerInvitations.id,
        tokenPrefix: playerInvitations.tokenPrefix,
        createdAt: playerInvitations.createdAt,
        expiresAt: playerInvitations.expiresAt,
        redeemedAt: playerInvitations.redeemedAt,
        revokedAt: playerInvitations.revokedAt,
        redeemedByUsername: users.username,
      })
      .from(playerInvitations)
      .leftJoin(users, eq(users.id, playerInvitations.redeemedByUserId))
      .where(eq(playerInvitations.inviterId, currentUser.id))
      .orderBy(playerInvitations.createdAt);
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw new Error("Authentication required");
    const currentUser = await getCurrentDatabaseUser(context.user);
    if (!currentUser || !currentUser.isActive) {
      throw new Error("Only active players can create invitations");
    }
    const openInvitations = await db
      .select({ id: playerInvitations.id })
      .from(playerInvitations)
      .where(
        and(
          eq(playerInvitations.inviterId, currentUser.id),
          isNull(playerInvitations.redeemedAt),
          isNull(playerInvitations.revokedAt),
          gt(playerInvitations.expiresAt, new Date()),
        ),
      );
    if (openInvitations.length >= maximumOpenInvitations) {
      throw new Error(
        `You can have at most ${maximumOpenInvitations} open invitations`,
      );
    }

    const token = generateInvitationToken();
    const [invitation] = await db
      .insert(playerInvitations)
      .values({
        tokenHash: hashInvitationToken(token),
        tokenPrefix: invitationTokenPrefix(token),
        inviterId: currentUser.id,
        expiresAt: new Date(Date.now() + invitationLifetimeMs),
      })
      .returning({
        id: playerInvitations.id,
        tokenPrefix: playerInvitations.tokenPrefix,
        createdAt: playerInvitations.createdAt,
        expiresAt: playerInvitations.expiresAt,
      });
    await db.insert(feed).values({
      userId: currentUser.id,
      content: "created a player invitation",
    });
    return { invitation, token };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ invitationId: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error("Authentication required");
    const currentUser = await getCurrentDatabaseUser(context.user);
    if (!currentUser) throw new Error("Player profile not found");
    const revoked = await db
      .update(playerInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(playerInvitations.id, data.invitationId),
          eq(playerInvitations.inviterId, currentUser.id),
          isNull(playerInvitations.redeemedAt),
          isNull(playerInvitations.revokedAt),
        ),
      )
      .returning({ id: playerInvitations.id });
    if (!revoked.length) throw new Error("Invitation cannot be revoked");
    await db.insert(feed).values({
      userId: currentUser.id,
      content: "revoked a player invitation",
    });
    return { success: true };
  });
