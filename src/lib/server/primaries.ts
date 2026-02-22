import { createServerFn } from "@tanstack/react-start";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  coalitionMembers,
  elections,
  parties,
  primaryCandidates,
  primaryVotes,
  users,
} from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware";

// ── helpers ──────────────────────────────────────────────

async function resolveUser(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      partyId: users.partyId,
      role: users.role,
      username: users.username,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, sql`lower(${email})`))
    .limit(1);
  return user ?? null;
}

async function getPartyCoalitionId(partyId: number): Promise<number | null> {
  const [row] = await db
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.partyId, partyId))
    .limit(1);
  return row?.coalitionId ?? null;
}

/** Get all party IDs in a coalition */
async function getCoalitionPartyIds(coalitionId: number): Promise<number[]> {
  const rows = await db
    .select({ partyId: coalitionMembers.partyId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.coalitionId, coalitionId));
  return rows.map((r) => r.partyId);
}

// ── queries ──────────────────────────────────────────────

/**
 * Get full primaries data for a party / coalition.
 * If the party is in a coalition, returns the coalition‑wide primary.
 * Otherwise returns the party-level primary.
 */
export const getPrimariesData = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");

    // Election info
    const [electionInfo] = await db
      .select()
      .from(elections)
      .where(eq(elections.election, "President"))
      .limit(1);

    const status = electionInfo?.status ?? null;
    const daysLeft = electionInfo?.daysLeft ?? 0;

    // The user's party & coalition
    const partyId = user.partyId;
    let coalitionId: number | null = null;
    let eligiblePartyIds: number[] = [];

    if (partyId) {
      coalitionId = await getPartyCoalitionId(partyId);
      if (coalitionId) {
        eligiblePartyIds = await getCoalitionPartyIds(coalitionId);
      } else {
        eligiblePartyIds = [partyId];
      }
    }

    // Primary candidates that belong to any eligible party
    let candidates: Array<{
      id: number;
      userId: number;
      partyId: number;
      coalitionId: number | null;
      votes: number;
      username: string;
      partyName: string;
      partyColor: string;
      partyLogo: string | null;
    }> = [];

    if (eligiblePartyIds.length > 0) {
      const rows = await db
        .select({
          id: primaryCandidates.id,
          userId: primaryCandidates.userId,
          partyId: primaryCandidates.partyId,
          coalitionId: primaryCandidates.coalitionId,
          votes: primaryCandidates.votes,
          username: users.username,
          partyName: parties.name,
          partyColor: parties.color,
          partyLogo: parties.logo,
        })
        .from(primaryCandidates)
        .innerJoin(users, eq(users.id, primaryCandidates.userId))
        .innerJoin(parties, eq(parties.id, primaryCandidates.partyId))
        .where(inArray(primaryCandidates.partyId, eligiblePartyIds))
        .orderBy(desc(primaryCandidates.votes));

      candidates = rows;
    }

    // Has the current user already voted?
    let hasVoted = false;
    let votedCandidateId: number | null = null;
    if (user.id) {
      const [vote] = await db
        .select({
          candidateId: primaryVotes.candidateId,
        })
        .from(primaryVotes)
        .where(eq(primaryVotes.userId, user.id))
        .limit(1);
      if (vote) {
        hasVoted = true;
        votedCandidateId = vote.candidateId;
      }
    }

    // Is the user already a primary candidate?
    const isCandidate = candidates.some((c) => c.userId === user.id);

    // Party / coalition info for display
    let groupName: string | null = null;
    let groupColor: string | null = null;
    if (coalitionId) {
      const [coal] = await db
        .select({ name: sql<string>`name`, color: sql<string>`color` })
        .from(sql`coalitions`)
        .where(sql`id = ${coalitionId}`)
        .limit(1);
      groupName = coal?.name ?? null;
      groupColor = coal?.color ?? null;
    } else if (partyId) {
      const [party] = await db
        .select({ name: parties.name, color: parties.color })
        .from(parties)
        .where(eq(parties.id, partyId))
        .limit(1);
      groupName = party?.name ?? null;
      groupColor = party?.color ?? null;
    }

    return {
      electionStatus: status,
      daysLeft,
      partyId,
      coalitionId,
      candidates,
      hasVoted,
      votedCandidateId,
      isCandidate,
      userId: user.id,
      userRole: user.role,
      groupName,
      groupColor,
      isCoalitionPrimary: !!coalitionId,
    };
  });

// ── mutations ────────────────────────────────────────────

/** Declare as a primary candidate */
export const declarePrimaryCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");
    if (!user.partyId)
      throw new Error("You must be in a party to run in a primary");

    // Must be Candidate phase
    const [electionInfo] = await db
      .select({ status: elections.status })
      .from(elections)
      .where(eq(elections.election, "President"))
      .limit(1);

    if (electionInfo?.status !== "Candidate") {
      throw new Error("Primaries are only open during the Candidate phase");
    }

    // Cannot run if already a Senator
    if (user.role === "Senator") {
      throw new Error("Senators cannot run for President");
    }

    // Check not already a primary candidate
    const [existing] = await db
      .select({ id: primaryCandidates.id })
      .from(primaryCandidates)
      .where(eq(primaryCandidates.userId, user.id))
      .limit(1);

    if (existing) throw new Error("You are already a primary candidate");

    const coalitionId = await getPartyCoalitionId(user.partyId);

    const [newCandidate] = await db
      .insert(primaryCandidates)
      .values({
        userId: user.id,
        partyId: user.partyId,
        coalitionId,
      })
      .returning();

    return newCandidate;
  });

/** Withdraw from the primary, optionally endorsing another candidate (transfers votes) */
export const withdrawPrimaryCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { endorseCandidateId?: number | null }) => data ?? {})
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");

    // Must be Candidate phase
    const [electionInfo] = await db
      .select({ status: elections.status })
      .from(elections)
      .where(eq(elections.election, "President"))
      .limit(1);

    if (electionInfo?.status !== "Candidate") {
      throw new Error("Cannot withdraw outside the Candidate phase");
    }

    const [candidate] = await db
      .select({ id: primaryCandidates.id, votes: primaryCandidates.votes })
      .from(primaryCandidates)
      .where(eq(primaryCandidates.userId, user.id))
      .limit(1);

    if (!candidate) throw new Error("You are not a primary candidate");

    await db.transaction(async (tx) => {
      // If endorsing another candidate, transfer our vote total to them
      if (data.endorseCandidateId) {
        const [endorsed] = await tx
          .select({ id: primaryCandidates.id })
          .from(primaryCandidates)
          .where(eq(primaryCandidates.id, data.endorseCandidateId))
          .limit(1);

        if (!endorsed) throw new Error("Endorsed candidate not found");
        if (endorsed.id === candidate.id)
          throw new Error("You cannot endorse yourself");

        // Transfer votes
        await tx
          .update(primaryCandidates)
          .set({
            votes: sql`${primaryCandidates.votes} + ${candidate.votes}`,
          })
          .where(eq(primaryCandidates.id, data.endorseCandidateId));

        // Re-point all vote records to the endorsed candidate
        await tx
          .update(primaryVotes)
          .set({ candidateId: data.endorseCandidateId })
          .where(eq(primaryVotes.candidateId, candidate.id));
      } else {
        // No endorsement — just delete the votes
        await tx
          .delete(primaryVotes)
          .where(eq(primaryVotes.candidateId, candidate.id));
      }

      await tx
        .delete(primaryCandidates)
        .where(eq(primaryCandidates.userId, user.id));
    });

    return true;
  });

/** Vote for a primary candidate */
export const voteInPrimary = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { candidateId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");
    if (!user.partyId) throw new Error("You must be in a party to vote");

    // Must be Candidate phase
    const [electionInfo] = await db
      .select({ status: elections.status })
      .from(elections)
      .where(eq(elections.election, "President"))
      .limit(1);

    if (electionInfo?.status !== "Candidate") {
      throw new Error("Voting is only open during the Candidate phase");
    }

    // Already voted?
    const [existingVote] = await db
      .select({ id: primaryVotes.id })
      .from(primaryVotes)
      .where(eq(primaryVotes.userId, user.id))
      .limit(1);

    if (existingVote) throw new Error("You have already voted in this primary");

    // Validate candidate exists and belongs to the user's primary group
    const [candidate] = await db
      .select({
        id: primaryCandidates.id,
        partyId: primaryCandidates.partyId,
        coalitionId: primaryCandidates.coalitionId,
      })
      .from(primaryCandidates)
      .where(eq(primaryCandidates.id, data.candidateId))
      .limit(1);

    if (!candidate) throw new Error("Candidate not found");

    // Check the voter belongs to the same party or coalition
    const voterCoalitionId = await getPartyCoalitionId(user.partyId);

    if (candidate.coalitionId) {
      // Coalition primary — voter must be in the same coalition
      if (voterCoalitionId !== candidate.coalitionId) {
        throw new Error("You can only vote in your own coalition's primary");
      }
    } else {
      // Party-only primary — voter must be in the same party
      if (user.partyId !== candidate.partyId) {
        throw new Error("You can only vote in your own party's primary");
      }
    }

    // Cast vote
    await db.transaction(async (tx) => {
      await tx.insert(primaryVotes).values({
        userId: user.id,
        candidateId: data.candidateId,
      });

      await tx
        .update(primaryCandidates)
        .set({ votes: sql`${primaryCandidates.votes} + 1` })
        .where(eq(primaryCandidates.id, data.candidateId));
    });

    return true;
  });
