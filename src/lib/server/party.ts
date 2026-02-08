import { createServerFn } from "@tanstack/react-start";
import { eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  parties,
  partyStances,
  partyNotifications,
  partyTransactionHistory,
  politicalStances,
  users,
} from "@/db/schema";
import { db } from "@/db";
import {
  CreatePartySchema,
  UpdatePartySchema,
} from "@/lib/schemas/party-schema";
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
      .where(eq(sql`lower(${users.email})`, sql`lower(${data.email})`))
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

export const getPartyStances = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const stances = await db
      .select({
        title: politicalStances.issue,
        value: partyStances.value,
        stanceId: partyStances.stanceId,
      })
      .from(partyStances)
      .innerJoin(
        politicalStances,
        eq(partyStances.stanceId, politicalStances.id),
      )
      .where(eq(partyStances.partyId, data.partyId));
    return stances;
  });

export const getPartyDetails = createServerFn()
  .inputValidator((data: { partyId: number; userId: number | null }) => data)
  .handler(async ({ data }) => {
    const party = await getPartyById({ data: { partyId: data.partyId } });
    const members = await getPartyMembers({ data: { partyId: data.partyId } });
    const stances = await getPartyStances({ data: { partyId: data.partyId } });
    const membershipStatus = data.userId
      ? await getMembershipStatus({
          data: { userId: data.userId, partyId: data.partyId },
        })
      : { isInParty: false, isLeader: false };

    return {
      party,
      members,
      stances,
      membershipStatus,
    };
  });

export const getPoliticalStances = createServerFn().handler(async () => {
  const stances = await db.select().from(politicalStances);
  return stances;
});

// Mutations
export const createParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(CreatePartySchema)
  .handler(async ({ data }) => {
    const { party, stances } = data;
    const result = await db.transaction(async (tx) => {
      const [newParty] = await tx
        .insert(parties)
        .values({
          name: party.name,
          leaderId: party.leader_id,
          bio: party.bio,
          color: party.color,
          logo: party.logo,
          discord: party.discord,
          leaning: party.leaning,
          partySubs: party.membership_fee ?? 0,
        })
        .returning();

      await tx
        .update(users)
        .set({ partyId: newParty.id })
        .where(eq(users.id, party.leader_id))
        .returning();

      if (stances.length > 0) {
        await tx.insert(partyStances).values(
          stances.map((stance) => ({
            partyId: newParty.id,
            stanceId: stance.stanceId,
            value: stance.value,
          })),
        );
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
      .where(eq(users.email, context.user.email))
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

    const { party: partyData, stances } = data;
    await db.transaction(async (tx) => {
      await tx
        .update(parties)
        .set({
          name: partyData.name,
          bio: partyData.bio,
          color: partyData.color,
          logo: partyData.logo,
          discord: partyData.discord,
          leaning: partyData.leaning,
          partySubs: partyData.membership_fee ?? 0,
        })
        .where(eq(parties.id, partyData.id));

      await tx
        .delete(partyStances)
        .where(eq(partyStances.partyId, partyData.id));

      if (stances.length > 0) {
        await tx.insert(partyStances).values(
          stances.map((stance) => ({
            partyId: partyData.id,
            stanceId: stance.stanceId,
            value: stance.value,
          })),
        );
      }
    });
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
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only leave a party as yourself");
    }

    if (currentUser.partyId) {
      const [party] = await db
        .select({ leaderId: parties.leaderId })
        .from(parties)
        .where(eq(parties.id, currentUser.partyId))
        .limit(1);
      if (party?.leaderId === data.userId) {
        await db
          .update(parties)
          .set({ leaderId: null })
          .where(eq(parties.id, currentUser.partyId));
      }
    }

    await db
      .update(users)
      .set({ partyId: null })
      .where(eq(users.id, data.userId));

    if (currentUser.partyId) {
      const memberCount = await db
        .select()
        .from(users)
        .where(eq(users.partyId, currentUser.partyId));

      if (memberCount.length === 0) {
        await deleteParty({ data: { partyId: currentUser.partyId } });
      }
    }
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
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only join a party as yourself");
    }

    await db
      .update(users)
      .set({ partyId: data.partyId })
      .where(eq(users.id, data.userId));
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
      .where(eq(users.email, context.user.email))
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

// Get party transaction history
export const getPartyTransactions = createServerFn()
  .inputValidator((data: { partyId: number; limit?: number }) => data)
  .handler(async ({ data }) => {
    const transactions = await db
      .select()
      .from(partyTransactionHistory)
      .where(eq(partyTransactionHistory.partyId, data.partyId))
      .orderBy(sql`${partyTransactionHistory.createdAt} DESC`)
      .limit(data.limit ?? 50);
    return transactions;
  });

// Withdraw party funds (leader only)
export const withdrawPartyFunds = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { partyId: number; amount: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    if (data.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    // Get the current user
    const [currentUser] = await db
      .select({ id: users.id, money: users.money })
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check if user is party leader
    const [party] = await db
      .select({
        leaderId: parties.leaderId,
        money: parties.money,
        name: parties.name,
      })
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1);

    if (!party || party.leaderId !== currentUser.id) {
      throw new Error("Only the party leader can withdraw funds");
    }

    if ((party.money ?? 0) < data.amount) {
      throw new Error("Insufficient party funds");
    }

    // Perform the withdrawal in a transaction
    await db.transaction(async (tx) => {
      // Deduct from party
      await tx
        .update(parties)
        .set({ money: sql`${parties.money} - ${data.amount}` })
        .where(eq(parties.id, data.partyId));

      // Add to user
      await tx
        .update(users)
        .set({ money: sql`${users.money} + ${data.amount}` })
        .where(eq(users.id, currentUser.id));

      // Record transaction
      await tx.insert(partyTransactionHistory).values({
        partyId: data.partyId,
        amount: -data.amount,
        description: `Leader withdrawal to personal account`,
      });
    });

    return true;
  });
