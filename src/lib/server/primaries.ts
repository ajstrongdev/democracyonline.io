import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coalitionMembers,
  candidates as electionCandidates,
  elections,
  parties,
  primaryCandidates,
  primaryVotes,
  users,
} from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware";

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

async function getCoalitionPartyIds(
  coalitionId: number,
): Promise<Array<number>> {
  const rows = await db
    .select({ partyId: coalitionMembers.partyId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.coalitionId, coalitionId));
  return rows.map((r) => r.partyId);
}

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
    let eligiblePartyIds: Array<number> = [];

    if (partyId) {
      coalitionId = await getPartyCoalitionId(partyId);
      if (coalitionId) {
        eligiblePartyIds = await getCoalitionPartyIds(coalitionId);
      } else {
        eligiblePartyIds = [partyId];
      }
    }

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

export const declarePrimaryCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");
    const partyId = user.partyId;
    if (!partyId) throw new Error("You must be in a party to run in a primary");

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

    const coalitionId = await getPartyCoalitionId(partyId);

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${user.id})`);
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
      );

      const [lockedElection] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, "President"))
        .limit(1);
      if (lockedElection?.status !== "Candidate") {
        throw new Error("Primaries are only open during the Candidate phase");
      }

      const [existing] = await tx
        .select({ id: primaryCandidates.id })
        .from(primaryCandidates)
        .where(eq(primaryCandidates.userId, user.id))
        .limit(1);
      if (existing) throw new Error("You are already a primary candidate");

      const [generalCandidacy] = await tx
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(eq(electionCandidates.userId, user.id))
        .limit(1);
      if (generalCandidacy) {
        throw new Error("You are already a candidate in another election");
      }

      const [newCandidate] = await tx
        .insert(primaryCandidates)
        .values({
          userId: user.id,
          partyId,
          coalitionId,
        })
        .returning();
      return newCandidate;
    });
  });

export const withdrawPrimaryCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { endorseCandidateId?: number | null }) => data ?? {})
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
      );
      const [electionInfo] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, "President"))
        .limit(1);
      if (electionInfo?.status !== "Candidate") {
        throw new Error("Cannot withdraw outside the Candidate phase");
      }

      const [candidate] = await tx
        .select({
          id: primaryCandidates.id,
          votes: primaryCandidates.votes,
          partyId: primaryCandidates.partyId,
          coalitionId: primaryCandidates.coalitionId,
        })
        .from(primaryCandidates)
        .where(eq(primaryCandidates.userId, user.id))
        .limit(1);
      if (!candidate) throw new Error("You are not a primary candidate");

      if (data.endorseCandidateId) {
        const [endorsed] = await tx
          .select({
            id: primaryCandidates.id,
            partyId: primaryCandidates.partyId,
            coalitionId: primaryCandidates.coalitionId,
          })
          .from(primaryCandidates)
          .where(eq(primaryCandidates.id, data.endorseCandidateId))
          .limit(1);

        if (!endorsed) throw new Error("Endorsed candidate not found");
        if (endorsed.id === candidate.id)
          throw new Error("You cannot endorse yourself");
        const samePrimary = candidate.coalitionId
          ? endorsed.coalitionId === candidate.coalitionId
          : !endorsed.coalitionId && endorsed.partyId === candidate.partyId;
        if (!samePrimary) {
          throw new Error("You can only endorse a candidate in your primary");
        }

        // Transfer votes
        await tx
          .update(primaryCandidates)
          .set({
            votes: sql`${primaryCandidates.votes} + ${candidate.votes}`,
          })
          .where(eq(primaryCandidates.id, data.endorseCandidateId));

        await tx
          .update(primaryVotes)
          .set({ candidateId: data.endorseCandidateId })
          .where(eq(primaryVotes.candidateId, candidate.id));
      } else {
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

export const voteInPrimary = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { candidateId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user) throw new Error("User not found");
    const partyId = user.partyId;
    if (!partyId) throw new Error("You must be in a party to vote");
    const voterCoalitionId = await getPartyCoalitionId(partyId);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
      );
      const [electionInfo] = await tx
        .select({ status: elections.status })
        .from(elections)
        .where(eq(elections.election, "President"))
        .limit(1);
      if (electionInfo?.status !== "Candidate") {
        throw new Error("Voting is only open during the Candidate phase");
      }

      const [existingVote] = await tx
        .select({ id: primaryVotes.id })
        .from(primaryVotes)
        .where(eq(primaryVotes.userId, user.id))
        .limit(1);
      if (existingVote)
        throw new Error("You have already voted in this primary");

      const [candidate] = await tx
        .select({
          id: primaryCandidates.id,
          partyId: primaryCandidates.partyId,
          coalitionId: primaryCandidates.coalitionId,
        })
        .from(primaryCandidates)
        .where(eq(primaryCandidates.id, data.candidateId))
        .limit(1);
      if (!candidate) throw new Error("Candidate not found");

      if (
        candidate.coalitionId
          ? voterCoalitionId !== candidate.coalitionId
          : partyId !== candidate.partyId
      ) {
        throw new Error(
          "You can only vote in your own party or coalition primary",
        );
      }

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
