import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql, not, like } from "drizzle-orm";
import { db } from "@/db";
import {
  elections,
  candidates,
  votes,
  users,
  parties,
  transactionHistory,
  donationHistory,
  candidateSnapshots,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";

// Types
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
  donations: number | null;
  haswon: boolean | null;
  username: string;
  partyName: string | null;
  partyColor: string | null;
};

export type VotingStatus = {
  hasVoted: boolean;
  votesUsed: number;
  maxVotes: number;
  votesRemaining: number;
  votedCandidateIds: number[];
};

// Get election info by election type (Senate or President)
export const getElectionInfo = createServerFn()
  .inputValidator((data: { election: string }) => data)
  .handler(async ({ data }) => {
    const [electionInfo] = await db
      .select({
        election: elections.election,
        status: elections.status,
        seats: elections.seats,
        daysLeft: elections.daysLeft,
      })
      .from(elections)
      .where(eq(elections.election, data.election))
      .limit(1);

    return electionInfo || null;
  });

// Get candidates for an election
export const getCandidates = createServerFn()
  .inputValidator((data: { election: string }) => data)
  .handler(async ({ data }) => {
    const candidatesList = await db
      .select({
        id: candidates.id,
        userId: candidates.userId,
        election: candidates.election,
        votes: candidates.votes,
        donations: candidates.donations,
        haswon: candidates.haswon,
        username: users.username,
        partyName: parties.name,
        partyColor: parties.color,
      })
      .from(candidates)
      .innerJoin(users, eq(candidates.userId, users.id))
      .leftJoin(parties, eq(users.partyId, parties.id))
      .where(
        and(
          eq(candidates.election, data.election),
          not(like(users.username, "Banned User%")),
        ),
      );

    return candidatesList;
  });

// Declare candidacy for an election
export const declareCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; election: string }) => data)
  .handler(async ({ data }) => {
    // Check if user is already a candidate in any election
    const existingCandidacy = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.userId, data.userId))
      .limit(1);

    if (existingCandidacy.length > 0) {
      throw new Error(
        "You are already a candidate in an election. You cannot run in multiple elections simultaneously.",
      );
    }

    // Insert new candidacy
    const [newCandidate] = await db
      .insert(candidates)
      .values({
        userId: data.userId,
        election: data.election,
      })
      .returning();

    // Add feed item
    await addFeedItem({
      data: {
        userId: data.userId,
        content: `Is running as a candidate for the ${data.election}.`,
      },
    });

    return newCandidate;
  });

// Revoke candidacy
export const revokeCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; election: string }) => data)
  .handler(async ({ data }) => {
    const result = await db
      .delete(candidates)
      .where(
        and(
          eq(candidates.userId, data.userId),
          eq(candidates.election, data.election),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new Error("Candidacy not found");
    }

    // Add feed item
    await addFeedItem({
      data: {
        userId: data.userId,
        content: `Is no longer running as a candidate for the ${data.election}.`,
      },
    });

    return { success: true, candidate: result[0] };
  });

// Vote for a candidate in an election
export const voteForCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: { userId: number; candidateId: number; election: string }) => data,
  )
  .handler(async ({ data }) => {
    // Get the candidate to verify they're in the specified election
    const [candidate] = await db
      .select({ election: candidates.election })
      .from(candidates)
      .where(eq(candidates.id, data.candidateId))
      .limit(1);

    if (!candidate || candidate.election !== data.election) {
      throw new Error("Candidate not found in this election");
    }

    // Get election info to find max votes (seats)
    const [electionInfo] = await db
      .select({ seats: elections.seats })
      .from(elections)
      .where(eq(elections.election, data.election))
      .limit(1);

    if (!electionInfo) {
      throw new Error("Election not found");
    }

    const maxVotes = electionInfo.seats || 1;

    // Get all candidates in this election
    const electionCandidates = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.election, data.election));

    const candidateIds = electionCandidates.map((c) => c.id);

    // Check how many votes the user has already cast in this election
    const existingVotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(
        and(
          eq(votes.userId, data.userId),
          sql`${votes.candidateId} IN (${sql.join(
            candidateIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    const votesUsed = Number(existingVotes[0]?.count || 0);

    if (votesUsed >= maxVotes) {
      throw new Error(
        `You have already used all your votes (${maxVotes}) for this election`,
      );
    }

    // Check if user has already voted for this candidate
    const existingVoteForCandidate = await db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(
          eq(votes.userId, data.userId),
          eq(votes.candidateId, data.candidateId),
        ),
      )
      .limit(1);

    if (existingVoteForCandidate.length > 0) {
      throw new Error("You have already voted for this candidate");
    }

    // Insert vote
    await db.insert(votes).values({
      userId: data.userId,
      voteType: data.election,
      candidateId: data.candidateId,
    });

    // Update candidate's vote count
    await db
      .update(candidates)
      .set({ votes: sql`${candidates.votes} + 1` })
      .where(eq(candidates.id, data.candidateId));

    // Reward user with $500
    await db
      .update(users)
      .set({ money: sql`${users.money} + 500` })
      .where(eq(users.id, data.userId));

    // Get candidate name for transaction
    const [candidateUser] = await db
      .select({ username: users.username })
      .from(candidates)
      .innerJoin(users, eq(candidates.userId, users.id))
      .where(eq(candidates.id, data.candidateId))
      .limit(1);

    // Add transaction history
    await db.insert(transactionHistory).values({
      userId: data.userId,
      description: `+$500 for voting for ${candidateUser?.username || "candidate"} in ${data.election} election`,
    });

    return { success: true };
  });

// Get user's voting status for an election
export const getUserVotingStatus = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number; election: string }) => data)
  .handler(async ({ data }): Promise<VotingStatus> => {
    // Get election info for max votes
    const [electionInfo] = await db
      .select({ seats: elections.seats })
      .from(elections)
      .where(eq(elections.election, data.election))
      .limit(1);

    if (!electionInfo) {
      return {
        hasVoted: false,
        votesUsed: 0,
        maxVotes: 0,
        votesRemaining: 0,
        votedCandidateIds: [],
      };
    }

    const maxVotes = electionInfo.seats || 1;

    // Get all candidates in this election
    const electionCandidates = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.election, data.election));

    const candidateIds = electionCandidates.map((c) => c.id);

    if (candidateIds.length === 0) {
      return {
        hasVoted: false,
        votesUsed: 0,
        maxVotes,
        votesRemaining: maxVotes,
        votedCandidateIds: [],
      };
    }

    // Count user's votes in this election
    const voteCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(
        and(
          eq(votes.userId, data.userId),
          sql`${votes.candidateId} IN (${sql.join(
            candidateIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    const votesUsed = Number(voteCount[0]?.count || 0);

    // Get list of candidate IDs the user has voted for
    const votedFor = await db
      .select({ candidateId: votes.candidateId })
      .from(votes)
      .where(
        and(
          eq(votes.userId, data.userId),
          sql`${votes.candidateId} IN (${sql.join(
            candidateIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    const votedCandidateIds = votedFor
      .map((v) => v.candidateId)
      .filter((id): id is number => id !== null);

    return {
      hasVoted: votesUsed > 0,
      votesUsed,
      maxVotes,
      votesRemaining: maxVotes - votesUsed,
      votedCandidateIds,
    };
  });

// Check if user is a candidate in any election
export const isUserAnyCandidate = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const existingCandidacy = await db
      .select({ id: candidates.id, election: candidates.election })
      .from(candidates)
      .where(eq(candidates.userId, data.userId))
      .limit(1);

    return {
      isCandidate: existingCandidacy.length > 0,
      election: existingCandidacy[0]?.election || null,
    };
  });

// Combined loader for election page data
export const electionPageData = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { election: string; userId?: number }) => data)
  .handler(async ({ data }) => {
    const electionInfo = await getElectionInfo({
      data: { election: data.election },
    });

    const candidatesList = await getCandidates({
      data: { election: data.election },
    });

    let votingStatus: VotingStatus | null = null;
    let isCandidateInAny = {
      isCandidate: false,
      election: null as string | null,
    };

    if (data.userId) {
      if (electionInfo?.status === "Voting") {
        votingStatus = await getUserVotingStatus({
          data: { userId: data.userId, election: data.election },
        });
      }

      isCandidateInAny = await isUserAnyCandidate({
        data: { userId: data.userId },
      });
    }

    return {
      electionInfo,
      candidates: candidatesList,
      votingStatus,
      isCandidateInAny,
    };
  });

export const donateToCandidate = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: { userId: number; candidateId: number; amount: number }) => data,
  )
  .handler(async ({ data }) => {
    // Get candidate and associated user
    const [candidate] = await db
      .select({
        id: candidates.id,
        userId: candidates.userId,
        election: candidates.election,
        username: users.username,
      })
      .from(candidates)
      .innerJoin(users, eq(candidates.userId, users.id))
      .where(eq(candidates.id, data.candidateId))
      .limit(1);

    if (!candidate) {
      throw new Error("Candidate not found");
    }

    if (data.amount <= 0) {
      throw new Error("Donation amount must be greater than zero");
    }

    // Update candidate's user's money
    if (candidate.userId === null) {
      throw new Error("Candidate does not have a valid userId");
    }
    await db
      .update(candidates)
      .set({ donations: sql`${candidates.donations} + ${data.amount}` })
      .where(eq(candidates.userId, candidate.userId));
    await db
      .update(users)
      .set({ money: sql`${users.money} - ${data.amount}` })
      .where(eq(users.id, data.userId));

    // Add transaction history for donor
    await db.insert(transactionHistory).values({
      userId: data.userId,
      description: `-$${data.amount} donated to ${candidate.username}'s campaign in the ${candidate.election} election`,
    });
    // Add transaction history for candidate
    await db.insert(donationHistory).values({
      candidateId: candidate.id,
      amount: data.amount,
    });

    return { success: true };
  });

// Get campaign history (snapshots) for an election
export const getCampaignHistory = createServerFn()
  .inputValidator((data: { election: string }) => data)
  .handler(async ({ data }) => {
    const snapshots = await db
      .select({
        id: candidateSnapshots.id,
        candidateId: candidateSnapshots.candidateId,
        election: candidateSnapshots.election,
        votes: candidateSnapshots.votes,
        donations: candidateSnapshots.donations,
        snapshotAt: candidateSnapshots.snapshotAt,
      })
      .from(candidateSnapshots)
      .where(eq(candidateSnapshots.election, data.election))
      .orderBy(candidateSnapshots.snapshotAt);

    return snapshots;
  });
