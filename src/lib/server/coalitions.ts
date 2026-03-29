import { createServerFn } from "@tanstack/react-start";
import { eq, and, sql, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import {
  coalitions,
  coalitionMembers,
  joinRequests,
  parties,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { requireAuthMiddleware } from "@/middleware";

const CreateCoalitionSchema = z.object({
  name: z.string().min(1, "Coalition name is required").max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  logo: z.string().nullable().optional(),
  bio: z.string().optional(),
});

const UpdateCoalitionSchema = z.object({
  coalitionId: z.number(),
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logo: z.string().nullable().optional(),
  bio: z.string().optional(),
});

async function resolveUser(email: string) {
  const [user] = await db
    .select({ id: users.id, partyId: users.partyId })
    .from(users)
    .where(eq(sql`lower(${users.email})`, sql`lower(${email})`))
    .limit(1);
  return user ?? null;
}

async function isPartyLeader(userId: number, partyId: number) {
  const [party] = await db
    .select({ leaderId: parties.leaderId })
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);
  return party?.leaderId === userId;
}

async function getPartyCoalitionId(partyId: number) {
  const [row] = await db
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.partyId, partyId))
    .limit(1);
  return row?.coalitionId ?? null;
}

async function isPartyInCoalition(partyId: number, coalitionId: number) {
  const [row] = await db
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .where(
      and(
        eq(coalitionMembers.partyId, partyId),
        eq(coalitionMembers.coalitionId, coalitionId),
      ),
    )
    .limit(1);
  return !!row;
}

export const getPartyCoalition = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const coalitionId = await getPartyCoalitionId(data.partyId);
    if (!coalitionId) return null;
    const [coalition] = await db
      .select()
      .from(coalitions)
      .where(eq(coalitions.id, coalitionId))
      .limit(1);
    return coalition ?? null;
  });

export const getCoalitions = createServerFn().handler(async () => {
  const rows = await db
    .select({
      ...getTableColumns(coalitions),
      memberCount: sql<number>`count(DISTINCT ${coalitionMembers.partyId})`.as(
        "memberCount",
      ),
      totalMembers: sql<number>`count(DISTINCT ${users.id})`.as("totalMembers"),
    })
    .from(coalitions)
    .leftJoin(coalitionMembers, eq(coalitionMembers.coalitionId, coalitions.id))
    .leftJoin(parties, eq(parties.id, coalitionMembers.partyId))
    .leftJoin(users, eq(users.partyId, parties.id))
    .groupBy(coalitions.id)
    .having(sql`count(DISTINCT ${coalitionMembers.partyId}) > 0`)
    .orderBy(sql`count(DISTINCT ${coalitionMembers.partyId}) desc`);
  return rows;
});

export const getCoalitionById = createServerFn()
  .inputValidator((data: { coalitionId: number }) => data)
  .handler(async ({ data }) => {
    const [coalition] = await db
      .select()
      .from(coalitions)
      .where(eq(coalitions.id, data.coalitionId))
      .limit(1);
    return coalition ?? null;
  });

export const getCoalitionParties = createServerFn()
  .inputValidator((data: { coalitionId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        ...getTableColumns(parties),
        joinDate: coalitionMembers.joinDate,
        memberCount: sql<number>`count(${users.id})`.as("memberCount"),
      })
      .from(coalitionMembers)
      .innerJoin(parties, eq(parties.id, coalitionMembers.partyId))
      .leftJoin(users, eq(users.partyId, parties.id))
      .where(eq(coalitionMembers.coalitionId, data.coalitionId))
      .groupBy(parties.id, coalitionMembers.joinDate);
    return rows;
  });

export const getCoalitionJoinRequests = createServerFn()
  .inputValidator((data: { coalitionId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: joinRequests.id,
        partyId: joinRequests.partyId,
        partyName: parties.name,
        partyColor: parties.color,
        partyLogo: parties.logo,
        status: joinRequests.status,
        createdAt: joinRequests.createdAt,
      })
      .from(joinRequests)
      .innerJoin(parties, eq(parties.id, joinRequests.partyId))
      .where(
        and(
          eq(joinRequests.coalitionId, data.coalitionId),
          eq(joinRequests.status, "Pending"),
        ),
      );
    return rows;
  });

export const getCoalitionDetails = createServerFn()
  .inputValidator(
    (data: { coalitionId: number; userId: number | null }) => data,
  )
  .handler(async ({ data }) => {
    const coalition = await getCoalitionById({
      data: { coalitionId: data.coalitionId },
    });
    const memberParties = await getCoalitionParties({
      data: { coalitionId: data.coalitionId },
    });
    const pendingRequests = await getCoalitionJoinRequests({
      data: { coalitionId: data.coalitionId },
    });

    let isMemberPartyLeader = false;
    let callerPartyId: number | null = null;
    let callerCoalitionId: number | null = null;

    if (data.userId) {
      const user = await db
        .select({ id: users.id, partyId: users.partyId })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);

      if (user[0]?.partyId) {
        callerPartyId = user[0].partyId;
        callerCoalitionId = await getPartyCoalitionId(user[0].partyId);
        const memberPartyIds = memberParties.map((p) => p.id);
        if (memberPartyIds.includes(user[0].partyId)) {
          isMemberPartyLeader = await isPartyLeader(
            data.userId,
            user[0].partyId,
          );
        }
      }
    }

    return {
      coalition,
      memberParties,
      pendingRequests,
      isMemberPartyLeader,
      callerPartyId,
      callerCoalitionId,
    };
  });

export const createCoalition = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) => CreateCoalitionSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can create a coalition");
    }

    const existing = await getPartyCoalitionId(user.partyId);
    if (existing) throw new Error("Your party is already in a coalition");

    const result = await db.transaction(async (tx) => {
      const [newCoalition] = await tx
        .insert(coalitions)
        .values({
          name: data.name,
          color: data.color,
          logo: data.logo ?? null,
          bio: data.bio ?? null,
        })
        .returning();

      await tx.insert(coalitionMembers).values({
        coalitionId: newCoalition.id,
        partyId: user.partyId!,
      });

      return newCoalition;
    });

    return result;
  });

export const requestJoinCoalition = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { coalitionId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can request to join a coalition");
    }

    const existing = await getPartyCoalitionId(user.partyId);
    if (existing) throw new Error("Your party is already in a coalition");

    const [existingReq] = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.partyId, user.partyId),
          eq(joinRequests.coalitionId, data.coalitionId),
          eq(joinRequests.status, "Pending"),
        ),
      )
      .limit(1);

    if (existingReq) throw new Error("You already have a pending request");

    await db.insert(joinRequests).values({
      partyId: user.partyId,
      coalitionId: data.coalitionId,
      status: "Pending",
    });

    return true;
  });

export const acceptJoinRequest = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { requestId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    const [request] = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, data.requestId))
      .limit(1);

    if (!request || request.status !== "Pending") {
      throw new Error("Request not found or already processed");
    }

    if (!(await isPartyInCoalition(user.partyId, request.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can accept join requests");
    }

    const alreadyIn = await getPartyCoalitionId(request.partyId);
    if (alreadyIn) throw new Error("That party is already in a coalition");

    await db.transaction(async (tx) => {
      await tx
        .update(joinRequests)
        .set({ status: "Accepted" })
        .where(eq(joinRequests.id, data.requestId));

      await tx.insert(coalitionMembers).values({
        coalitionId: request.coalitionId,
        partyId: request.partyId,
      });
    });

    return true;
  });

export const declineJoinRequest = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { requestId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    const [request] = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, data.requestId))
      .limit(1);

    if (!request || request.status !== "Pending") {
      throw new Error("Request not found or already processed");
    }

    if (!(await isPartyInCoalition(user.partyId, request.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can decline join requests");
    }

    await db
      .update(joinRequests)
      .set({ status: "Declined" })
      .where(eq(joinRequests.id, data.requestId));

    return true;
  });

export const updateCoalition = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) => UpdateCoalitionSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    if (!(await isPartyInCoalition(user.partyId, data.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can update coalition information");
    }

    await db
      .update(coalitions)
      .set({
        name: data.name,
        color: data.color,
        logo: data.logo ?? null,
        bio: data.bio ?? null,
      })
      .where(eq(coalitions.id, data.coalitionId));

    return true;
  });

export const leaveCoalition = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { coalitionId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");

    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");

    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only a party leader can leave a coalition");
    }

    if (!(await isPartyInCoalition(user.partyId, data.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    await db
      .delete(coalitionMembers)
      .where(
        and(
          eq(coalitionMembers.coalitionId, data.coalitionId),
          eq(coalitionMembers.partyId, user.partyId),
        ),
      );

    const remaining = await db
      .select()
      .from(coalitionMembers)
      .where(eq(coalitionMembers.coalitionId, data.coalitionId));

    if (remaining.length === 0) {
      await db.transaction(async (tx) => {
        await tx
          .delete(joinRequests)
          .where(eq(joinRequests.coalitionId, data.coalitionId));
        await tx.delete(coalitions).where(eq(coalitions.id, data.coalitionId));
      });
    }

    return true;
  });
