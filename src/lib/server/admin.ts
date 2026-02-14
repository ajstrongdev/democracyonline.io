import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { authMiddleware } from "@/middleware/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { db } from "@/db";
import {
  accessTokens,
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  candidates,
  chats,
  companies,
  feed,
  parties,
  presidentialElection,
  senateElection,
  sharePriceHistory,
  stocks,
  users,
  userShares,
  votes,
} from "@/db/schema";

function isAdminEmail(email: string) {
  return env.ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase(),
  );
}

export const checkIsAdmin = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    console.log("[checkIsAdmin] User email from context:", email);
    console.log("[checkIsAdmin] ADMIN_EMAILS:", env.ADMIN_EMAILS);
    if (!email) return false;
    const isAdmin = isAdminEmail(email);
    console.log("[checkIsAdmin] Is admin:", isAdmin);
    return isAdmin;
  });

export function getAdminEmails(): Array<string> {
  return env.ADMIN_EMAILS;
}

// Firebase Users Management
export const listFirebaseUsers = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    const auth = getAdminAuth();
    const listUsersResult = await auth.listUsers(1000);

    return {
      users: listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        disabled: user.disabled,
        emailVerified: user.emailVerified,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
    };
  });

export const toggleUserDisabled = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { uid: string; disabled: boolean }) => data)
  .handler(
    async ({
      context,
      data,
    }: {
      context: any;
      data: { uid: string; disabled: boolean };
    }) => {
      const email = context.user?.email;
      if (!email || !isAdminEmail(email)) {
        throw new Error("Unauthorized");
      }

      const auth = getAdminAuth();
      await auth.updateUser(data.uid, { disabled: data.disabled });

      return { success: true };
    },
  );

export const deleteFirebaseUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { uid: string }) => data)
  .handler(
    async ({ context, data }: { context: any; data: { uid: string } }) => {
      const email = context.user?.email;
      if (!email || !isAdminEmail(email)) {
        throw new Error("Unauthorized");
      }

      const auth = getAdminAuth();
      await auth.deleteUser(data.uid);

      return { success: true };
    },
  );

export const listParties = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    const allParties = await db
      .select({
        id: parties.id,
        name: parties.name,
        bio: parties.bio,
        color: parties.color,
        politicalLeaning: parties.politicalLeaning,
        leaderId: parties.leaderId,
        createdAt: parties.createdAt,
        leaning: parties.leaning,
        logo: parties.logo,
        discord: parties.discord,
      })
      .from(parties);

    return { parties: allParties };
  });

export const listDatabaseUsers = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        partyId: users.partyId,
        createdAt: users.createdAt,
      })
      .from(users);

    return { users: allUsers };
  });

export const purgeUserFromDatabase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(
    async ({ context, data }: { context: any; data: { userId: number } }) => {
      const email = context.user?.email;
      if (!email || !isAdminEmail(email)) {
        throw new Error("Unauthorized");
      }
      // Delete bill votes
      await db
        .delete(billVotesHouse)
        .where(eq(billVotesHouse.voterId, data.userId));
      await db
        .delete(billVotesSenate)
        .where(eq(billVotesSenate.voterId, data.userId));
      await db
        .delete(billVotesPresidential)
        .where(eq(billVotesPresidential.voterId, data.userId));

      // Delete election votes
      await db
        .delete(senateElection)
        .where(eq(senateElection.voterId, data.userId));
      await db
        .delete(presidentialElection)
        .where(eq(presidentialElection.voterId, data.userId));

      // Delete votes
      await db.delete(votes).where(eq(votes.userId, data.userId));

      // Delete candidates
      await db.delete(candidates).where(eq(candidates.userId, data.userId));

      // Delete chats
      await db.delete(chats).where(eq(chats.userId, data.userId));

      // Delete feed posts
      await db.delete(feed).where(eq(feed.userId, data.userId));

      // Delete bills created by user
      await db.delete(bills).where(eq(bills.creatorId, data.userId));

      // Update parties where user is leader (set leader to null)
      await db
        .update(parties)
        .set({ leaderId: null })
        .where(eq(parties.leaderId, data.userId));

      // Finally, delete the user
      await db.delete(users).where(eq(users.id, data.userId));

      return { success: true, message: "User purged from database" };
    },
  );

export const listAccessTokens = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    const tokens = await db
      .select({
        id: accessTokens.id,
        token: accessTokens.token,
        createdAt: accessTokens.createdAt,
      })
      .from(accessTokens);

    return { tokens };
  });

export const createAccessToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    const token = crypto.randomBytes(31).toString("base64url").slice(0, 41);

    const [newToken] = await db
      .insert(accessTokens)
      .values({ token })
      .returning();

    return { token: newToken };
  });

export const deleteAccessToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { tokenId: number }) => data)
  .handler(
    async ({ context, data }: { context: any; data: { tokenId: number } }) => {
      const email = context.user?.email;
      if (!email || !isAdminEmail(email)) {
        throw new Error("Unauthorized");
      }

      await db.delete(accessTokens).where(eq(accessTokens.id, data.tokenId));

      return { success: true };
    },
  );

export const resetEconomy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) {
      throw new Error("Unauthorized");
    }

    // Delete share price history
    await db.delete(sharePriceHistory);

    // Delete all user share holdings
    await db.delete(userShares);

    // Delete all stock entries
    await db.delete(stocks);

    // Delete all companies
    await db.delete(companies);

    // Reset all players' money to $2500
    await db.update(users).set({ money: 2500 });

    return {
      success: true,
      message:
        "Economy reset: all companies, shares, and price history deleted. All players given $2,500.",
    };
  });
