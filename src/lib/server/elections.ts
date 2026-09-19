import { createServerFn } from "@tanstack/react-start";
import { and, eq, like, not, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  candidates,
  coalitionMembers,
  coalitions,
  elections,
  parties,
  primaryCandidates,
  users,
  votes,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";
import { scoreRankedBallot } from "@/lib/utils/ranked-choice";

const electionTypeSchema = z.enum(["President", "Senate"]);

export type ElectionInfo = {
  election: string;
  status: string;
  seats: number | null;
  daysLeft: number;
};

export type Candidate = {
  id: number;
  userId: number | null;
  election: string | null;
  votes: number | null;
  haswon: boolean | null;
  username: string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
  partyLogo: string | null;
  coalitionId: number | null;
  coalitionName: string | null;
  coalitionColor: string | null;
  coalitionLogo: string | null;
};

export type VotingStatus = {
  hasVoted: boolean;
  ranking: Array<number>;
};

const getAuthenticatedUserId = async (email?: string) => {
  if (!email) throw new Error("Authentication required");

  const [currentUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, sql`lower(${email})`))
    .limit(1);

  if (!currentUser) throw new Error("User not found");
  return currentUser.id;
};

const rejectForgedUserId = (
  providedUserId: number | undefined,
  userId: number,
) => {
  if (providedUserId !== undefined && providedUserId !== userId) {
    throw new Error(
      "You can only perform election actions as your own account",
    );
  }
};

export const getElectionInfo = createServerFn()
  .inputValidator(z.object({ election: electionTypeSchema }))
  .handler(async ({ data }) => {
    const [electionInfo] = await db
      .select()
      .from(elections)
      .where(eq(elections.election, data.election))
      .limit(1);
    return electionInfo || null;
  });

export const getCandidates = createServerFn()
  .inputValidator(z.object({ election: electionTypeSchema }))
  .handler(async ({ data }) =>
    db
      .select({
        id: candidates.id,
        userId: candidates.userId,
        election: candidates.election,
        votes: candidates.votes,
        haswon: candidates.haswon,
        username: users.username,
        partyId: users.partyId,
        partyName: parties.name,
        partyColor: parties.color,
        partyLogo: parties.logo,
        coalitionId: coalitionMembers.coalitionId,
        coalitionName: coalitions.name,
        coalitionColor: coalitions.color,
        coalitionLogo: coalitions.logo,
      })
      .from(candidates)
      .innerJoin(users, eq(candidates.userId, users.id))
      .leftJoin(parties, eq(users.partyId, parties.id))
      .leftJoin(coalitionMembers, eq(parties.id, coalitionMembers.partyId))
      .leftJoin(coalitions, eq(coalitionMembers.coalitionId, coalitions.id))
      .where(
        and(
          eq(candidates.election, data.election),
          not(like(users.username, "Banned User%")),
        ),
      ),
  );

export const declareCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      userId: z.number().int().positive().optional(),
      election: electionTypeSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = await getAuthenticatedUserId(context.user?.email);
    rejectForgedUserId(data.userId, userId);

    const candidate = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${data.election} FOR UPDATE`,
      );

      const [election] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, data.election))
        .limit(1);
      if (!election || election.status !== "Candidate") {
        throw new Error("Candidacy is not open for this election");
      }

      const [currentUser] = await tx
        .select({ role: users.role, partyId: users.partyId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (data.election === "Senate" && currentUser?.role === "President") {
        throw new Error("The President cannot run for Senate");
      }
      if (data.election === "President" && currentUser?.role === "Senator") {
        throw new Error("A serving Senator cannot run for President");
      }
      if (data.election === "President" && currentUser?.partyId) {
        throw new Error(
          "Party members must qualify through their party primary",
        );
      }

      const [existing] = await tx
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.userId, userId))
        .limit(1);
      if (existing) throw new Error("You are already a candidate");

      const [primaryCandidacy] = await tx
        .select({ id: primaryCandidates.id })
        .from(primaryCandidates)
        .where(eq(primaryCandidates.userId, userId))
        .limit(1);
      if (primaryCandidacy) {
        throw new Error(
          "You are already a candidate in a presidential primary",
        );
      }

      const [newCandidate] = await tx
        .insert(candidates)
        .values({ userId, election: data.election, votes: 0, haswon: false })
        .returning();
      return newCandidate;
    });
    await addFeedItem({
      data: {
        userId,
        content: `Is running as a candidate for the ${data.election}.`,
      },
    });
    return candidate;
  });

export const revokeCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      userId: z.number().int().positive().optional(),
      election: electionTypeSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = await getAuthenticatedUserId(context.user?.email);
    rejectForgedUserId(data.userId, userId);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${data.election} FOR UPDATE`,
      );
      const [election] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, data.election))
        .limit(1);
      if (!election || election.status !== "Candidate") {
        throw new Error(
          "Candidacy can only be withdrawn during the candidacy phase",
        );
      }

      const result = await tx
        .delete(candidates)
        .where(
          and(
            eq(candidates.userId, userId),
            eq(candidates.election, data.election),
          ),
        )
        .returning();
      if (!result.length) throw new Error("Candidacy not found");
    });

    await addFeedItem({
      data: {
        userId,
        content: `Is no longer running as a candidate for the ${data.election}.`,
      },
    });
    return { success: true };
  });

export const submitRankedBallot = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      election: electionTypeSchema,
      rankedCandidateIds: z.array(z.number().int().positive()).min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = await getAuthenticatedUserId(context.user?.email);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${data.election} FOR UPDATE`,
      );
      const [election] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, data.election))
        .limit(1);
      if (!election || election.status !== "Voting") {
        throw new Error("This election is not accepting ballots");
      }

      const roster = await tx
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.election, data.election))
        .orderBy(candidates.id);
      const scored = scoreRankedBallot(
        roster.map((candidate) => candidate.id),
        data.rankedCandidateIds,
      );

      const existing = await tx
        .select({ id: votes.id })
        .from(votes)
        .where(and(eq(votes.userId, userId), eq(votes.voteType, data.election)))
        .limit(1);
      if (existing.length)
        throw new Error("You have already submitted a ballot");

      await tx.insert(votes).values(
        scored.map(({ candidateId, rank, points }) => ({
          userId,
          voteType: data.election,
          candidateId,
          rank,
          points,
        })),
      );

      for (const entry of scored) {
        await tx
          .update(candidates)
          .set({
            votes: sql`COALESCE(${candidates.votes}, 0) + ${entry.points}`,
          })
          .where(eq(candidates.id, entry.candidateId));
      }
      return { success: true };
    });
  });

export const getUserVotingStatus = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      userId: z.number().int().positive().optional(),
      election: electionTypeSchema,
    }),
  )
  .handler(async ({ data, context }): Promise<VotingStatus> => {
    if (!context.user?.email) return { hasVoted: false, ranking: [] };
    const userId = await getAuthenticatedUserId(context.user.email);
    rejectForgedUserId(data.userId, userId);
    const ballot = await db
      .select({ candidateId: votes.candidateId })
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.voteType, data.election)))
      .orderBy(votes.rank);
    return {
      hasVoted: ballot.length > 0,
      ranking: ballot.map((row) => row.candidateId),
    };
  });

export const isUserAnyCandidate = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [candidate] = await db
      .select({ election: candidates.election })
      .from(candidates)
      .where(eq(candidates.userId, data.userId))
      .limit(1);
    return {
      isCandidate: Boolean(candidate),
      election: candidate?.election ?? null,
    };
  });

export const electionPageData = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      election: electionTypeSchema,
      userId: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const electionInfo = await getElectionInfo({
      data: { election: data.election },
    });
    const candidatesList = await getCandidates({
      data: { election: data.election },
    });
    const votingStatus = data.userId
      ? await getUserVotingStatus({
          data: { userId: data.userId, election: data.election },
        })
      : null;
    const isCandidateInAny = data.userId
      ? await isUserAnyCandidate({ data: { userId: data.userId } })
      : { isCandidate: false, election: null };
    return {
      electionInfo,
      candidates: candidatesList,
      votingStatus,
      isCandidateInAny,
    };
  });
