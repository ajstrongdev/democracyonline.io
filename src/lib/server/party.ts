import { createServerFn } from "@tanstack/react-start";
import { and, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  feed,
  organizationLifecycleEvents,
  parties,
  users,
  wikiArticleRevisions,
  wikiArticles,
} from "@/db/schema";
import { db } from "@/db";
import {
  CreatePartySchema,
  UpdatePartySchema,
} from "@/lib/schemas/party-schema";
import { userEmailEquals } from "@/lib/server/user-email";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";
import { isAdminEmail } from "@/lib/server/admin";
import { canReviveParty } from "@/lib/organizations/lifecycle";
import { archivePartyIfEmpty } from "@/lib/server/organization-lifecycle";

// Data fetching
export const partyPageData = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const partyInfo = await getParties();
    const isInParty = await checkUserInParty({ data: { email: data.email } });
    return { partyInfo, isInParty };
  });

export const getParties = createServerFn().handler(async () => {
  const rows = await db
    .select({
      ...getTableColumns(parties),
      memberCount: sql<number>`count(${users.id})`.as("memberCount"),
    })
    .from(parties)
    .leftJoin(users, eq(users.partyId, parties.id))
    .where(isNull(parties.archivedAt))
    .groupBy(parties.id)
    .orderBy(sql`count(${users.id}) desc`);
  return rows;
});

export const checkUserInParty = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(data.email))
      .limit(1);

    return user?.partyId !== null && user?.partyId !== undefined;
  });

export const checkUserInSpecificParty = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    return user?.partyId === data.partyId;
  });

export const checkIfUserIsPartyLeader = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
      .limit(1);
    return party?.leaderId === data.userId;
  });

export const getMembershipStatus = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const isInParty = await checkUserInSpecificParty({
      data: { userId: data.userId, partyId: data.partyId },
    });
    const isLeader = await checkIfUserIsPartyLeader({
      data: { userId: data.userId, partyId: data.partyId },
    });
    return { isInParty, isLeader };
  });

export const getPartyMembers = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const {
      email,
      isAncestryRoot,
      moderationRole,
      ...userColumns
    } = getTableColumns(users);
    const members = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.partyId, data.partyId));
    return members;
  });

export const getPartyById = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select()
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1);
    return party || null;
  });

// Mutations
export const createParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(CreatePartySchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [creator] = await db
      .select({
        id: users.id,
        username: users.username,
        partyId: users.partyId,
      })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!creator) throw new Error("Player account not found");
    if (creator.partyId) throw new Error("Leave your current party first");

    const { party, platform } = data;
    const result = await db.transaction(async (tx) => {
      const [newParty] = await tx
        .insert(parties)
        .values({
          name: party.name,
          leaderId: creator.id,
          bio: party.bio,
          color: party.color,
          logo: party.logo,
          discord: party.discord,
          leaning: party.leaning,
        })
        .returning();

      await tx
        .update(users)
        .set({ partyId: newParty.id })
        .where(eq(users.id, creator.id))
        .returning();

      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "party",
        organizationId: newParty.id,
        organizationName: newParty.name,
        action: "created",
        actorUserId: creator.id,
      });
      await tx.insert(feed).values({
        userId: creator.id,
        content: `formed ${newParty.name}`,
      });

      if (platform) {
        const [article] = await tx
          .insert(wikiArticles)
          .values({ entityType: "party", entityId: String(newParty.id) })
          .returning({ id: wikiArticles.id });
        await tx.insert(wikiArticleRevisions).values({
          articleId: article.id,
          editorUserId: creator.id,
          editorUsername: creator.username,
          content: platform,
          editSummary: "Published initial party platform",
        });
      }

      return newParty;
    });
    return result;
  });

export const updateParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(UpdatePartySchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(and(eq(parties.id, data.party.id), isNull(parties.archivedAt)))
      .limit(1);

    if (!party || party.leaderId !== currentUser.id) {
      throw new Error("Only the party leader can update the party");
    }

    const partyData = data.party;
    await db
      .update(parties)
      .set({
        name: partyData.name,
        bio: partyData.bio,
        color: partyData.color,
        logo: partyData.logo,
        discord: partyData.discord,
        leaning: partyData.leaning,
      })
      .where(eq(parties.id, partyData.id));
    return true;
  });

export const leaveParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    const [currentUser] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only leave a party as yourself");
    }

    if (!currentUser.partyId) return true;
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.id, currentUser.id));
      const archived = await archivePartyIfEmpty(
        tx,
        currentUser.partyId!,
        currentUser.id,
      );
      if (!archived) {
        await tx
          .update(parties)
          .set({ leaderId: null })
          .where(
            and(
              eq(parties.id, currentUser.partyId!),
              eq(parties.leaderId, currentUser.id),
            ),
          );
      }
    });
    return true;
  });

export const joinParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    // Verify the authenticated user matches the userId
    const [currentUser] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only join a party as yourself");
    }

    if (currentUser.partyId === data.partyId) return true;
    await db.transaction(async (tx) => {
      const previousPartyId = currentUser.partyId;
      const lockIds = [data.partyId, ...(previousPartyId ? [previousPartyId] : [])]
        .filter((partyId, index, values) => values.indexOf(partyId) === index)
        .sort((left, right) => left - right);
      for (const partyId of lockIds) {
        await tx.execute(sql`select pg_advisory_xact_lock(${partyId})`);
      }
      const [targetParty] = await tx
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
        .limit(1);
      if (!targetParty) throw new Error("Party not found");

      await tx
        .update(users)
        .set({ partyId: data.partyId })
        .where(eq(users.id, currentUser.id));
      if (previousPartyId) {
        const archived = await archivePartyIfEmpty(
          tx,
          previousPartyId,
          currentUser.id,
        );
        if (!archived) {
          await tx
            .update(parties)
            .set({ leaderId: null })
            .where(
              and(
                eq(parties.id, previousPartyId),
                eq(parties.leaderId, currentUser.id),
              ),
            );
        }
      }
    });
    return true;
  });

export const becomePartyLeader = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    // Verify the authenticated user matches the userId
    const [currentUser] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only become leader as yourself");
    }

    // Check if user is a member of the party
    if (currentUser.partyId !== data.partyId) {
      throw new Error("You must be a member of the party to become leader");
    }

    // Check if party currently has no leader
    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
      .limit(1);

    if (party?.leaderId) {
      throw new Error("Party already has a leader");
    }

    await db
      .update(parties)
      .set({ leaderId: data.userId })
      .where(eq(parties.id, data.partyId));
    return true;
  });

export const getPartyRevivalState = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) return { canRevive: false };
    const [[actor], [party]] = await Promise.all([
      db
        .select({ id: users.id, partyId: users.partyId })
        .from(users)
        .where(userEmailEquals(context.user.email))
        .limit(1),
      db
        .select({
          archivedAt: parties.archivedAt,
          formerLeaderId: parties.formerLeaderId,
        })
        .from(parties)
        .where(eq(parties.id, data.partyId))
        .limit(1),
    ]);
    if (!actor || !party?.archivedAt) return { canRevive: false };
    return {
      canRevive: canReviveParty({
        actorUserId: actor.id,
        actorPartyId: actor.partyId,
        formerLeaderId: party.formerLeaderId,
        isAdmin: isAdminEmail(context.user.email),
      }),
    };
  });

export const reviveParty = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const actorEmail = context.user.email;
    const [actor] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(actorEmail))
      .limit(1);
    if (!actor) throw new Error("Player account not found");

    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${data.partyId})`);
      const [party] = await tx
        .select({
          id: parties.id,
          name: parties.name,
          archivedAt: parties.archivedAt,
          formerLeaderId: parties.formerLeaderId,
        })
        .from(parties)
        .where(eq(parties.id, data.partyId))
        .limit(1);
      if (!party?.archivedAt) throw new Error("Archived party not found");
      if (
        !canReviveParty({
          actorUserId: actor.id,
          actorPartyId: actor.partyId,
          formerLeaderId: party.formerLeaderId,
          isAdmin: isAdminEmail(actorEmail),
        })
      ) {
        throw new Error(
          "Only an independent former leader or independent admin can revive this party",
        );
      }

      const [restoredMember] = await tx
        .update(users)
        .set({ partyId: party.id })
        .where(and(eq(users.id, actor.id), isNull(users.partyId)))
        .returning({ id: users.id });
      if (!restoredMember) {
        throw new Error("Leave your current party before reviving this party");
      }
      await tx
        .update(parties)
        .set({ archivedAt: null, leaderId: actor.id })
        .where(eq(parties.id, party.id));
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "party",
        organizationId: party.id,
        organizationName: party.name,
        action: "revived",
        actorUserId: actor.id,
        metadata: { restoredLeaderId: actor.id },
      });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `revived ${party.name}`,
      });
      return true;
    });
  });

const GetPartiesByIdsSchema = z.object({
  partyIds: z.array(z.number()).min(1),
});

export const getPartiesByIds = createServerFn()
  .inputValidator((data: unknown) => GetPartiesByIdsSchema.parse(data))
  .handler(async ({ data }) => {
    const { partyIds } = data;

    if (partyIds.length === 0) return {};

    try {
      const results = await db
        .select({
          id: parties.id,
          name: parties.name,
          color: parties.color,
          logo: parties.logo,
        })
        .from(parties)
        .where(inArray(parties.id, partyIds));

      const partyMap: Record<number, (typeof results)[0]> = {};
      results.forEach((party) => {
        partyMap[party.id] = party;
      });

      return partyMap;
    } catch (error) {
      console.error("Error fetching parties:", error);
      throw new Error("Failed to fetch parties");
    }
  });
