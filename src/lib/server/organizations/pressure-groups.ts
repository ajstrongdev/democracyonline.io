import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  feed,
  organizationLifecycleEvents,
  parties,
  pressureGroupMembers,
  pressureGroups,
  users,
  wikiArticleRevisions,
  wikiArticles,
} from "@/db/schema";
import { CreatePartySchema } from "@/lib/schemas/party-schema";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";

const groupInput = CreatePartySchema.omit({ cofounders: true });

export const getMyPressureGroup = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) return null;
    const [group] = await db
      .select({ id: pressureGroupMembers.groupId })
      .from(pressureGroupMembers)
      .innerJoin(users, eq(users.id, pressureGroupMembers.userId))
      .where(userEmailEquals(context.user.email))
      .limit(1);
    return group?.id ?? null;
  });

export const listPressureGroups = createServerFn().handler(async () =>
  db
    .select({
      id: pressureGroups.id,
      name: pressureGroups.name,
      founderId: pressureGroups.founderId,
      count: sql<number>`count(${pressureGroupMembers.userId})::int`,
    })
    .from(pressureGroups)
    .leftJoin(
      pressureGroupMembers,
      eq(pressureGroupMembers.groupId, pressureGroups.id),
    )
    .where(isNull(pressureGroups.formedPartyId))
    .groupBy(pressureGroups.id)
    .orderBy(pressureGroups.createdAt),
);

export const getPressureGroup = createServerFn()
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [group] = await db
      .select()
      .from(pressureGroups)
      .where(eq(pressureGroups.id, data.id))
      .limit(1);
    if (!group) return null;
    const members = group.formedPartyId
      ? await db
          .select({
            id: users.id,
            username: users.username,
            photoUrl: users.photoUrl,
          })
          .from(users)
          .where(eq(users.partyId, group.formedPartyId))
          .orderBy(users.id)
      : await db
          .select({
            id: users.id,
            username: users.username,
            photoUrl: users.photoUrl,
          })
          .from(pressureGroupMembers)
          .innerJoin(users, eq(users.id, pressureGroupMembers.userId))
          .where(eq(pressureGroupMembers.groupId, data.id))
          .orderBy(users.id);
    return { ...group, members };
  });

export const createPressureGroup = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(groupInput)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({
          id: users.id,
          username: users.username,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .for("update");
      if (!actor?.active || actor.partyId)
        throw new Error(
          "Only active independent players can form a pressure group",
        );
      const [member] = await tx
        .select({ userId: pressureGroupMembers.userId })
        .from(pressureGroupMembers)
        .where(eq(pressureGroupMembers.userId, actor.id))
        .limit(1);
      if (member) throw new Error("Leave your current pressure group first");
      const [taken] = await tx
        .select({ id: parties.id })
        .from(parties)
        .where(sql`lower(${parties.name}) = lower(${data.party.name})`)
        .limit(1);
      if (taken) throw new Error("That party name is already taken");
      const [group] = await tx
        .insert(pressureGroups)
        .values({ founderId: actor.id, name: data.party.name, details: data })
        .returning({ id: pressureGroups.id });
      await tx
        .insert(pressureGroupMembers)
        .values({ groupId: group.id, userId: actor.id });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `started forming ${data.party.name}`,
      });
      return { id: group.id };
    });
  });

export const joinPressureGroup = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      // Serializes joins and the three-member conversion for this group.
      const [group] = await tx
        .select()
        .from(pressureGroups)
        .where(eq(pressureGroups.id, data.id))
        .for("update");
      if (!group || group.formedPartyId)
        throw new Error("This group has already become a party");
      const [actor] = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .for("update");
      if (!actor?.active || actor.partyId)
        throw new Error("Only active independent players can join");
      const [existing] = await tx
        .select({ groupId: pressureGroupMembers.groupId })
        .from(pressureGroupMembers)
        .where(eq(pressureGroupMembers.userId, actor.id));
      if (existing) throw new Error("You are already in a pressure group");
      const memberIds = await tx
        .select({ userId: pressureGroupMembers.userId })
        .from(pressureGroupMembers)
        .where(eq(pressureGroupMembers.groupId, group.id));
      if (memberIds.length >= 3) throw new Error("This group is already full");
      if (memberIds.length < 2) {
        await tx
          .insert(pressureGroupMembers)
          .values({ groupId: group.id, userId: actor.id });
        await tx.insert(feed).values({
          userId: actor.id,
          content: `joined the ${group.name} pressure group`,
        });
        return { formed: false, groupId: group.id };
      }
      const ids = [...memberIds.map((member) => member.userId), actor.id].sort(
        (a, b) => a - b,
      );
      const players = await tx
        .select({
          id: users.id,
          username: users.username,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(inArray(users.id, ids))
        .for("update");
      if (
        players.length !== 3 ||
        players.some((player) => player.partyId || !player.active)
      )
        throw new Error("All three members must remain active independents");
      const details = group.details;
      const [party] = await tx
        .insert(parties)
        .values({ ...details.party, leaderId: group.founderId })
        .returning({ id: parties.id, name: parties.name });
      await tx
        .update(users)
        .set({ partyId: party.id })
        .where(inArray(users.id, ids));
      await tx
        .delete(pressureGroupMembers)
        .where(eq(pressureGroupMembers.groupId, group.id));
      await tx
        .update(pressureGroups)
        .set({ formedPartyId: party.id })
        .where(eq(pressureGroups.id, group.id));
      await tx.insert(feed).values({
        userId: actor.id,
        content: `joined the ${group.name} pressure group`,
      });
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "party",
        organizationId: party.id,
        organizationName: party.name,
        action: "created",
        actorUserId: group.founderId,
      });
      await tx.insert(feed).values({
        userId: group.founderId,
        content: `formed ${party.name} with two cofounders`,
      });
      if (details.platform) {
        const [article] = await tx
          .insert(wikiArticles)
          .values({ entityType: "party", entityId: String(party.id) })
          .returning({ id: wikiArticles.id });
        await tx.insert(wikiArticleRevisions).values({
          articleId: article.id,
          editorUserId: group.founderId,
          editorUsername: players.find(
            (player) => player.id === group.founderId,
          )!.username,
          content: details.platform,
          editSummary: "Published initial party platform",
        });
      }
      return { formed: true, partyId: party.id };
    });
  });

export const leavePressureGroup = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [group] = await tx
        .select()
        .from(pressureGroups)
        .where(
          and(
            eq(pressureGroups.id, data.id),
            isNull(pressureGroups.formedPartyId),
          ),
        )
        .for("update");
      if (!group) throw new Error("Group not found");
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (!actor) throw new Error("Player not found");
      const [member] = await tx
        .select()
        .from(pressureGroupMembers)
        .where(
          and(
            eq(pressureGroupMembers.groupId, group.id),
            eq(pressureGroupMembers.userId, actor.id),
          ),
        );
      if (!member) throw new Error("You are not a member");
      if (actor.id === group.founderId) {
        await tx.insert(feed).values({
          userId: actor.id,
          content: `disbanded the ${group.name} pressure group`,
        });
        await tx.delete(pressureGroups).where(eq(pressureGroups.id, group.id));
      } else {
        await tx.insert(feed).values({
          userId: actor.id,
          content: `left the ${group.name} pressure group`,
        });
        await tx
          .delete(pressureGroupMembers)
          .where(
            and(
              eq(pressureGroupMembers.groupId, group.id),
              eq(pressureGroupMembers.userId, actor.id),
            ),
          );
      }
      return true;
    });
  });
