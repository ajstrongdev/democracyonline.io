import { createServerFn } from "@tanstack/react-start";
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  coalitionFormerMembers,
  coalitionMembers,
  coalitions,
  feed,
  joinRequests,
  organizationLifecycleEvents,
  parties,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";
import { isAdminEmail } from "@/lib/server/admin";
import { canReviveCoalition } from "@/lib/organizations/lifecycle";
import { leaveCoalitionMembership } from "@/lib/server/organization-lifecycle";

async function requireNoActiveElection() {
  const result = await db.execute(sql`SELECT status FROM elections LIMIT 1`);
  const row = result.rows[0] as { status?: string } | undefined;
  if (row?.status === "CANDIDACY" || row?.status === "VOTING") {
    throw new Error(
      "Coalition membership changes are frozen during active primaries or elections",
    );
  }
}

const CreateCoalitionSchema = z.object({
  name: z.string().trim().min(1, "Coalition name is required").max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  logo: z.string().max(255).nullable().optional(),
  bio: z.string().max(1000).optional(),
});

const UpdateCoalitionSchema = z.object({
  coalitionId: z.number(),
  name: z.string().trim().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logo: z.string().max(255).nullable().optional(),
  bio: z.string().max(1000).optional(),
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
    .where(and(eq(parties.id, partyId), isNull(parties.archivedAt)))
    .limit(1);
  return party?.leaderId === userId;
}

async function getPartyCoalitionId(partyId: number) {
  const [row] = await db
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .innerJoin(coalitions, eq(coalitions.id, coalitionMembers.coalitionId))
    .where(
      and(eq(coalitionMembers.partyId, partyId), isNull(coalitions.archivedAt)),
    )
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
      .where(and(eq(coalitions.id, coalitionId), isNull(coalitions.archivedAt)))
      .limit(1);
    return coalition ?? null;
  });

export const getCoalitionManagementState = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) {
      return { partyId: null, isPartyLeader: false, coalitionId: null };
    }
    const user = await resolveUser(context.user.email);
    if (!user?.partyId) {
      return { partyId: null, isPartyLeader: false, coalitionId: null };
    }
    return {
      partyId: user.partyId,
      isPartyLeader: await isPartyLeader(user.id, user.partyId),
      coalitionId: await getPartyCoalitionId(user.partyId),
    };
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
    const [coalition] = await db
      .select({ archivedAt: coalitions.archivedAt })
      .from(coalitions)
      .where(eq(coalitions.id, data.coalitionId))
      .limit(1);
    if (coalition?.archivedAt) {
      return db
        .select({
          ...getTableColumns(parties),
          joinDate: coalitionFormerMembers.firstJoinedAt,
          memberCount: sql<number>`count(${users.id})::int`.as("memberCount"),
        })
        .from(coalitionFormerMembers)
        .innerJoin(parties, eq(parties.id, coalitionFormerMembers.partyId))
        .leftJoin(users, eq(users.partyId, parties.id))
        .where(eq(coalitionFormerMembers.coalitionId, data.coalitionId))
        .groupBy(parties.id, coalitionFormerMembers.firstJoinedAt);
    }
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
      .innerJoin(coalitions, eq(coalitions.id, joinRequests.coalitionId))
      .where(
        and(
          eq(joinRequests.coalitionId, data.coalitionId),
          eq(joinRequests.status, "Pending"),
          isNull(parties.archivedAt),
          isNull(coalitions.archivedAt),
        ),
      );
    return rows;
  });

export const getCoalitionDetails = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ coalitionId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const coalition = await getCoalitionById({
      data: { coalitionId: data.coalitionId },
    });
    const memberParties = await getCoalitionParties({
      data: { coalitionId: data.coalitionId },
    });
    const pendingRequests = await getCoalitionJoinRequests({
      data: { coalitionId: data.coalitionId },
    });

    let isCallerPartyLeader = false;
    let callerPartyId: number | null = null;
    let callerCoalitionId: number | null = null;
    let canRevive = false;

    if (context.user?.email) {
      const user = await db
        .select({ id: users.id, partyId: users.partyId })
        .from(users)
        .where(
          eq(sql`lower(${users.email})`, sql`lower(${context.user.email})`),
        )
        .limit(1);

      if (user[0]?.partyId) {
        callerPartyId = user[0].partyId;
        callerCoalitionId = await getPartyCoalitionId(user[0].partyId);
        isCallerPartyLeader = await isPartyLeader(user[0].id, user[0].partyId);
        const [[callerParty], [formerMembership]] = await Promise.all([
          db
            .select({ archivedAt: parties.archivedAt })
            .from(parties)
            .where(eq(parties.id, user[0].partyId))
            .limit(1),
          db
            .select({ partyId: coalitionFormerMembers.partyId })
            .from(coalitionFormerMembers)
            .where(
              and(
                eq(coalitionFormerMembers.coalitionId, data.coalitionId),
                eq(coalitionFormerMembers.partyId, user[0].partyId),
              ),
            )
            .limit(1),
        ]);
        canRevive = Boolean(
          coalition?.archivedAt &&
          canReviveCoalition({
            actorPartyId: user[0].partyId,
            actorIsPartyLeader: isCallerPartyLeader,
            actorPartyCoalitionId: callerCoalitionId,
            actorPartyWasMember: Boolean(formerMembership),
            actorPartyIsArchived: Boolean(callerParty?.archivedAt),
            isAdmin: isAdminEmail(context.user.email),
          }),
        );
      }
    }

    return {
      coalition,
      memberParties,
      pendingRequests,
      isCallerPartyLeader,
      callerPartyId,
      callerCoalitionId,
      canRevive,
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

    await requireNoActiveElection();

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${user.partyId})`);
      const [existing] = await tx
        .select({ coalitionId: coalitionMembers.coalitionId })
        .from(coalitionMembers)
        .where(eq(coalitionMembers.partyId, user.partyId!))
        .limit(1);
      if (existing) throw new Error("Your party is already in a coalition");

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
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "coalition",
        organizationId: newCoalition.id,
        organizationName: newCoalition.name,
        action: "created",
        actorUserId: user.id,
        sponsorPartyId: user.partyId!,
      });
      await tx.insert(feed).values({
        userId: user.id,
        content: `formed ${newCoalition.name}`,
      });
      await tx
        .update(joinRequests)
        .set({ status: "Declined" })
        .where(
          and(
            eq(joinRequests.partyId, user.partyId!),
            eq(joinRequests.status, "Pending"),
          ),
        );

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

    await requireNoActiveElection();

    const existing = await getPartyCoalitionId(user.partyId);
    if (existing) throw new Error("Your party is already in a coalition");

    const [coalition] = await db
      .select({ id: coalitions.id })
      .from(coalitions)
      .where(
        and(eq(coalitions.id, data.coalitionId), isNull(coalitions.archivedAt)),
      )
      .limit(1);
    if (!coalition) throw new Error("Coalition not found");

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

    await requireNoActiveElection();

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${request.partyId})`);
      const [alreadyIn] = await tx
        .select({ coalitionId: coalitionMembers.coalitionId })
        .from(coalitionMembers)
        .where(eq(coalitionMembers.partyId, request.partyId))
        .limit(1);
      if (alreadyIn) throw new Error("That party is already in a coalition");

      const [accepted] = await tx
        .update(joinRequests)
        .set({ status: "Accepted" })
        .where(
          and(
            eq(joinRequests.id, data.requestId),
            eq(joinRequests.status, "Pending"),
          ),
        )
        .returning({ id: joinRequests.id });
      if (!accepted) throw new Error("Request not found or already processed");

      await tx.insert(coalitionMembers).values({
        coalitionId: request.coalitionId,
        partyId: request.partyId,
      });
      await tx
        .update(joinRequests)
        .set({ status: "Declined" })
        .where(
          and(
            eq(joinRequests.partyId, request.partyId),
            eq(joinRequests.status, "Pending"),
          ),
        );
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

    await requireNoActiveElection();

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

    await requireNoActiveElection();

    await db
      .update(coalitions)
      .set({
        name: data.name,
        color: data.color,
        logo: data.logo ?? null,
        bio: data.bio ?? null,
      })
      .where(
        and(eq(coalitions.id, data.coalitionId), isNull(coalitions.archivedAt)),
      );

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

    await requireNoActiveElection();

    if (!(await isPartyInCoalition(user.partyId, data.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${-data.coalitionId})`);
      await leaveCoalitionMembership(
        tx,
        data.coalitionId,
        user.partyId!,
        user.id,
      );
    });

    return true;
  });

export const reviveCoalition = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ coalitionId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const actorEmail = context.user.email;
    const user = await resolveUser(actorEmail);
    if (!user?.partyId) {
      throw new Error("You must lead an active sponsoring party");
    }
    const sponsorPartyId = user.partyId;

    await requireNoActiveElection();

    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${sponsorPartyId})`);
      await tx.execute(sql`select pg_advisory_xact_lock(${-data.coalitionId})`);
      const [[coalition], [party], [membership], [formerMembership]] =
        await Promise.all([
          tx
            .select({
              id: coalitions.id,
              name: coalitions.name,
              archivedAt: coalitions.archivedAt,
            })
            .from(coalitions)
            .where(eq(coalitions.id, data.coalitionId))
            .limit(1),
          tx
            .select({
              leaderId: parties.leaderId,
              archivedAt: parties.archivedAt,
            })
            .from(parties)
            .where(eq(parties.id, sponsorPartyId))
            .limit(1),
          tx
            .select({ coalitionId: coalitionMembers.coalitionId })
            .from(coalitionMembers)
            .where(eq(coalitionMembers.partyId, sponsorPartyId))
            .limit(1),
          tx
            .select({ partyId: coalitionFormerMembers.partyId })
            .from(coalitionFormerMembers)
            .where(
              and(
                eq(coalitionFormerMembers.coalitionId, data.coalitionId),
                eq(coalitionFormerMembers.partyId, sponsorPartyId),
              ),
            )
            .limit(1),
        ]);
      if (!coalition?.archivedAt)
        throw new Error("Archived coalition not found");
      if (
        !canReviveCoalition({
          actorPartyId: sponsorPartyId,
          actorIsPartyLeader: party?.leaderId === user.id,
          actorPartyCoalitionId: membership?.coalitionId ?? null,
          actorPartyWasMember: Boolean(formerMembership),
          actorPartyIsArchived: Boolean(party?.archivedAt),
          isAdmin: isAdminEmail(actorEmail),
        })
      ) {
        throw new Error(
          "Only an eligible former member party leader or admin can revive this coalition",
        );
      }

      await tx
        .update(coalitions)
        .set({ archivedAt: null })
        .where(eq(coalitions.id, coalition.id));
      await tx.insert(coalitionMembers).values({
        coalitionId: coalition.id,
        partyId: sponsorPartyId,
      });
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "coalition",
        organizationId: coalition.id,
        organizationName: coalition.name,
        action: "revived",
        actorUserId: user.id,
        sponsorPartyId,
        metadata: { restoredPartyIds: [sponsorPartyId] },
      });
      await tx.insert(feed).values({
        userId: user.id,
        content: `revived ${coalition.name} with their party as its sole member`,
      });
      return true;
    });
  });
