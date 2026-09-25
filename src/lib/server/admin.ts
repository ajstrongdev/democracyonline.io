import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, sql } from "drizzle-orm";
import { env } from "@/env";
import { authMiddleware } from "@/middleware/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  candidates,
  chats,
  electionNightUpdates,
  elections,
  feed,
  parties,
  users,
  votes,
} from "@/db/schema";
import { generateElectionNightPlan } from "@/lib/elections/reveal";
import { advanceElectionLifecycle } from "@/lib/server/election-lifecycle";
import { resolveElectionTiming } from "@/lib/server/game-speed";
import { archivePartyIfEmpty } from "@/lib/server/organization-lifecycle";

async function getAdminElectionTiming() {
  return resolveElectionTiming();
}

export function isAdminEmail(email: string) {
  return env.ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase(),
  );
}

export const checkIsAdmin = createServerFn()
  .middleware([authMiddleware])
  .handler(({ context }) => {
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

export const forceNextElectionStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { election: "President" | "Senate" }) => data)
  .handler(async ({ context, data }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) throw new Error("Unauthorized");

    const now = new Date();
    const ELECTION_TIMING = await getAdminElectionTiming();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${data.election} FOR UPDATE`,
      );
      const [election] = await tx
        .select({ status: elections.status, cycle: elections.cycle })
        .from(elections)
        .where(eq(elections.election, data.election))
        .limit(1);
      if (!election) throw new Error("Election not found");

      if (election.status === "CANDIDACY") {
        await tx
          .update(elections)
          .set({ candidacyEndsAt: now })
          .where(eq(elections.election, data.election));
      } else if (election.status === "VOTING") {
        const seed = `${data.election}:${election.cycle}:election-night-v1`;
        const voteTotals = await tx
          .select({
            candidateId: votes.candidateId,
            total: sql<number>`coalesce(sum(${votes.points}), 0)::int`,
          })
          .from(votes)
          .innerJoin(candidates, eq(votes.candidateId, candidates.id))
          .where(
            and(
              eq(votes.voteType, data.election),
              eq(candidates.election, data.election),
            ),
          )
          .groupBy(votes.candidateId);
        const totalsMap = new Map(
          voteTotals.map((row) => [row.candidateId, row.total]),
        );
        const roster = await tx
          .select({ id: candidates.id, name: users.username })
          .from(candidates)
          .innerJoin(users, eq(candidates.userId, users.id))
          .where(eq(candidates.election, data.election))
          .orderBy(candidates.id);
        const trueTotals = roster.map((c) => ({
          id: c.id,
          name: c.name,
          total: totalsMap.get(c.id) ?? 0,
        }));
        const endsAt = new Date(
          now.getTime() + ELECTION_TIMING.electionNightDurationMs,
        );
        const plan = generateElectionNightPlan(trueTotals, {
          seed,
          startsAt: now,
          durationMs: ELECTION_TIMING.electionNightDurationMs,
        });
        if (plan.length) {
          await tx
            .insert(electionNightUpdates)
            .values(
              plan.map((u) => ({
                election: data.election,
                cycle: election.cycle,
                sequence: u.sequence,
                revealAt: u.revealAt,
                type: u.type,
                headline: u.headline,
                cumulativeTotals: u.cumulativeTotals,
                totalPoints: u.totalPoints,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .update(elections)
          .set({
            status: "ELECTION_NIGHT",
            votingEndsAt: now,
            electionNightStartsAt: now,
            electionNightEndsAt: endsAt,
            reportingSeed: seed,
          })
          .where(eq(elections.election, data.election));
      } else if (election.status === "ELECTION_NIGHT") {
        await tx
          .update(elections)
          .set({ electionNightEndsAt: now })
          .where(eq(elections.election, data.election));
      } else if (election.status === "CONCLUDED") {
        await tx
          .update(elections)
          .set({
            concludedAt: new Date(
              now.getTime() -
                ELECTION_TIMING.concludedDurationMs[data.election],
            ),
          })
          .where(eq(elections.election, data.election));
      }
    });

    await advanceElectionLifecycle({ now });
    return { success: true };
  });

export const setElectionStageDeadline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { election: "President" | "Senate"; seconds: number }) => data,
  )
  .handler(async ({ context, data }) => {
    const email = context.user?.email;
    if (!email || !isAdminEmail(email)) throw new Error("Unauthorized");
    if (
      !Number.isInteger(data.seconds) ||
      data.seconds < 5 ||
      data.seconds > 300
    ) {
      throw new Error("Test deadline must be between 5 and 300 seconds");
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + data.seconds * 1_000);
    const ELECTION_TIMING = await getAdminElectionTiming();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${data.election} FOR UPDATE`,
      );
      const [election] = await tx
        .select({ status: elections.status, cycle: elections.cycle })
        .from(elections)
        .where(eq(elections.election, data.election))
        .limit(1);
      if (!election) throw new Error("Election not found");

      if (election.status === "CANDIDACY") {
        await tx
          .update(elections)
          .set({ candidacyEndsAt: deadline })
          .where(eq(elections.election, data.election));
      } else if (election.status === "VOTING") {
        const seed = `${data.election}:${election.cycle}:election-night-v1`;
        const voteTotals = await tx
          .select({
            candidateId: votes.candidateId,
            total: sql<number>`coalesce(sum(${votes.points}), 0)::int`,
          })
          .from(votes)
          .innerJoin(candidates, eq(votes.candidateId, candidates.id))
          .where(
            and(
              eq(votes.voteType, data.election),
              eq(candidates.election, data.election),
            ),
          )
          .groupBy(votes.candidateId);
        const totalsMap = new Map(
          voteTotals.map((row) => [row.candidateId, row.total]),
        );
        const roster = await tx
          .select({ id: candidates.id, name: users.username })
          .from(candidates)
          .innerJoin(users, eq(candidates.userId, users.id))
          .where(eq(candidates.election, data.election))
          .orderBy(candidates.id);
        const trueTotals = roster.map((c) => ({
          id: c.id,
          name: c.name,
          total: totalsMap.get(c.id) ?? 0,
        }));
        const plan = generateElectionNightPlan(trueTotals, {
          seed,
          startsAt: now,
          durationMs: data.seconds * 1_000,
        });
        if (plan.length) {
          await tx
            .insert(electionNightUpdates)
            .values(
              plan.map((u) => ({
                election: data.election,
                cycle: election.cycle,
                sequence: u.sequence,
                revealAt: u.revealAt,
                type: u.type,
                headline: u.headline,
                cumulativeTotals: u.cumulativeTotals,
                totalPoints: u.totalPoints,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .update(elections)
          .set({
            status: "ELECTION_NIGHT",
            votingEndsAt: now,
            electionNightStartsAt: now,
            electionNightEndsAt: deadline,
            reportingSeed: seed,
          })
          .where(eq(elections.election, data.election));
        return { success: true, deadline };
      } else if (election.status === "ELECTION_NIGHT") {
        await tx
          .update(elections)
          .set({ electionNightEndsAt: deadline })
          .where(eq(elections.election, data.election));
        await tx.execute(sql`
          UPDATE "election_night_updates"
          SET "reveal_at" = ${now}::timestamptz
            + (${data.seconds} * interval '1 second')
            * "sequence"::double precision
            / GREATEST((
                SELECT max(updates.sequence) + 1
                FROM "election_night_updates" updates
                WHERE updates.election = ${data.election}
                  AND updates.cycle = ${election.cycle}
              ), 1)
          WHERE "election" = ${data.election}
            AND "cycle" = ${election.cycle}
        `);
      } else if (election.status === "CONCLUDED") {
        const concludedDuration =
          ELECTION_TIMING.concludedDurationMs[data.election];
        await tx
          .update(elections)
          .set({
            concludedAt: new Date(deadline.getTime() - concludedDuration),
          })
          .where(eq(elections.election, data.election));
      }
    });

    await advanceElectionLifecycle({ now });
    return { success: true, deadline };
  });

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
        moderationRole: users.moderationRole,
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

      const [submittedBallot] = await db
        .select({ id: votes.id })
        .from(votes)
        .where(eq(votes.userId, data.userId))
        .limit(1);
      if (submittedBallot) {
        throw new Error(
          "Cannot purge a user while their election ballot is active",
        );
      }

      const [lockedCandidacy] = await db
        .select({ id: candidates.id })
        .from(candidates)
        .innerJoin(elections, eq(elections.election, candidates.election))
        .where(
          and(
            eq(candidates.userId, data.userId),
            inArray(elections.status, [
              "VOTING",
              "ELECTION_NIGHT",
              "CONCLUDED",
            ]),
          ),
        )
        .limit(1);
      if (lockedCandidacy) {
        throw new Error("Cannot purge a candidate during an active election");
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

      const [userMembership] = await db
        .select({ partyId: users.partyId })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);

      await db.transaction(async (tx) => {
        if (userMembership?.partyId) {
          await tx
            .update(users)
            .set({ partyId: null })
            .where(eq(users.id, data.userId));
          await archivePartyIfEmpty(tx, userMembership.partyId);
        }
        await tx
          .update(parties)
          .set({ leaderId: null })
          .where(eq(parties.leaderId, data.userId));
        await tx.delete(users).where(eq(users.id, data.userId));
      });

      return { success: true, message: "User purged from database" };
    },
  );
