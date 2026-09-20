import { createServerFn } from "@tanstack/react-start";
import { and, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  coalitionMembers,
  coalitions,
  joinRequests,
  parties,
  partyNotifications,
  partyStances,
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
import { requireAuthMiddleware } from "@/middleware";

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
      .where(eq(parties.id, data.partyId))
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
    const { email, ...userColumns } = getTableColumns(users);
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
      .where(eq(parties.id, data.party.id))
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

async function removeEmptyParty(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  partyId: number,
) {
  const [membership] = await tx
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.partyId, partyId))
    .limit(1);

  await tx.delete(joinRequests).where(eq(joinRequests.partyId, partyId));
  await tx
    .delete(coalitionMembers)
    .where(eq(coalitionMembers.partyId, partyId));
  await tx.delete(partyStances).where(eq(partyStances.partyId, partyId));
  await tx
    .delete(partyNotifications)
    .where(
      or(
        eq(partyNotifications.senderPartyId, partyId),
        eq(partyNotifications.receiverPartyId, partyId),
      ),
    );
  await tx.delete(parties).where(eq(parties.id, partyId));

  if (membership) {
    const [remaining] = await tx
      .select({ partyId: coalitionMembers.partyId })
      .from(coalitionMembers)
      .where(eq(coalitionMembers.coalitionId, membership.coalitionId))
      .limit(1);
    if (!remaining) {
      await tx
        .delete(joinRequests)
        .where(eq(joinRequests.coalitionId, membership.coalitionId));
      await tx
        .delete(coalitions)
        .where(eq(coalitions.id, membership.coalitionId));
    }
  }
}

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
        .update(parties)
        .set({ leaderId: null })
        .where(
          and(
            eq(parties.id, currentUser.partyId!),
            eq(parties.leaderId, currentUser.id),
          ),
        );
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.id, currentUser.id));
      const [remaining] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.partyId, currentUser.partyId!))
        .limit(1);
      if (!remaining) await removeEmptyParty(tx, currentUser.partyId!);
    });
    return true;
  });

export const deleteParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.partyId, data.partyId));
      await tx
        .delete(partyStances)
        .where(eq(partyStances.partyId, data.partyId));
      await tx
        .delete(partyNotifications)
        .where(
          or(
            eq(partyNotifications.senderPartyId, data.partyId),
            eq(partyNotifications.receiverPartyId, data.partyId),
          ),
        );
      await tx.delete(parties).where(eq(parties.id, data.partyId));
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
    const [targetParty] = await db
      .select({ id: parties.id })
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1);
    if (!targetParty) throw new Error("Party not found");

    await db.transaction(async (tx) => {
      const previousPartyId = currentUser.partyId;
      if (previousPartyId) {
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
      await tx
        .update(users)
        .set({ partyId: data.partyId })
        .where(eq(users.id, currentUser.id));
      if (previousPartyId) {
        const [remaining] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.partyId, previousPartyId))
          .limit(1);
        if (!remaining) await removeEmptyParty(tx, previousPartyId);
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
      .where(eq(parties.id, data.partyId))
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
