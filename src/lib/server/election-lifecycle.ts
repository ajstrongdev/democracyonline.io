import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ElectionTiming } from "@/lib/elections/timing";
import { db } from "@/db";
import {
  candidates,
  electionNightUpdates,
  elections,
  feed,
  primaryCandidates,
  primaryVotes,
  users,
  votes,
} from "@/db/schema";
import {
  isElectionStageOverdue,
  normalizeElectionStatus,
} from "@/lib/elections/lifecycle";
import { generateElectionNightPlan } from "@/lib/elections/reveal";
import {
  DEFAULT_ELECTION_TIMING,
  getLondonElectionNightWindowForDate,
  getNextLondonElectionNightWindow,
} from "@/lib/elections/timing";
import { archiveElection } from "@/lib/server/history";
import { ensureElectionSchedule } from "@/lib/server/election-schedule";
import { ensureElectionConclusionTask } from "@/lib/server/election-tasks";
import { resolvePrimaryWinners } from "@/lib/server/primaries-resolve";

type ElectionType = "President" | "Senate";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recomputeCandidateTotals(
  tx: Transaction,
  election: ElectionType,
) {
  const roster = await tx
    .select({ id: candidates.id, name: users.username })
    .from(candidates)
    .innerJoin(users, eq(candidates.userId, users.id))
    .where(eq(candidates.election, election))
    .orderBy(candidates.id);
  const voteTotals = await tx
    .select({
      candidateId: votes.candidateId,
      total: sql<number>`coalesce(sum(${votes.points}), 0)::int`,
    })
    .from(votes)
    .innerJoin(candidates, eq(votes.candidateId, candidates.id))
    .where(and(eq(votes.voteType, election), eq(candidates.election, election)))
    .groupBy(votes.candidateId);
  const totals = new Map(voteTotals.map((row) => [row.candidateId, row.total]));

  for (const candidate of roster) {
    await tx
      .update(candidates)
      .set({ votes: totals.get(candidate.id) ?? 0 })
      .where(eq(candidates.id, candidate.id));
  }
  return roster.map((candidate) => ({
    ...candidate,
    total: totals.get(candidate.id) ?? 0,
  }));
}

async function beginVoting(
  tx: Transaction,
  election: ElectionType,
  now: Date,
  timing: ElectionTiming,
) {
  const nominalVotingEnd = new Date(
    now.getTime() + timing.votingDurationMs[election],
  );
  const votingEndsAt =
    timing === DEFAULT_ELECTION_TIMING
      ? getNextLondonElectionNightWindow(
          new Date(nominalVotingEnd.getTime() - 60_000),
        ).startsAt
      : nominalVotingEnd;
  if (election === "President") {
    const primaryRoster = await tx
      .select({
        userId: primaryCandidates.userId,
        partyId: primaryCandidates.partyId,
        coalitionId: primaryCandidates.coalitionId,
        votes: primaryCandidates.votes,
      })
      .from(primaryCandidates)
      .orderBy(desc(primaryCandidates.votes));
    for (const userId of resolvePrimaryWinners(primaryRoster)) {
      await tx
        .insert(candidates)
        .values({ userId, election, votes: 0, haswon: false })
        .onConflictDoNothing();
    }
    await tx.delete(primaryVotes);
    await tx.delete(primaryCandidates);
  } else {
    const [candidateCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(eq(candidates.election, election));
    await tx
      .update(elections)
      .set({
        seats: Math.max(3, Math.ceil((candidateCount?.count ?? 0) * 0.5)),
      })
      .where(eq(elections.election, election));
  }

  await tx
    .update(elections)
    .set({
      status: "VOTING",
      votingStartsAt: now,
      votingEndsAt,
      electionNightStartsAt: null,
      electionNightEndsAt: null,
      concludedAt: null,
      reportingSeed: null,
    })
    .where(eq(elections.election, election));
}

async function beginElectionNight(
  tx: Transaction,
  election: ElectionType,
  cycle: number,
  votingEndsAt: Date | null,
  existingSeed: string | null,
  now: Date,
  timing: ElectionTiming,
) {
  const trueTotals = await recomputeCandidateTotals(tx, election);
  const rawStart = votingEndsAt ?? now;
  const startsAt =
    timing === DEFAULT_ELECTION_TIMING
      ? getLondonElectionNightWindowForDate(rawStart).startsAt
      : rawStart;
  const endsAt =
    timing === DEFAULT_ELECTION_TIMING
      ? getLondonElectionNightWindowForDate(rawStart).endsAt
      : new Date(rawStart.getTime() + timing.electionNightDurationMs);
  const seed = existingSeed ?? `${election}:${cycle}:election-night-v1`;
  const plan = generateElectionNightPlan(trueTotals, {
    seed,
    startsAt,
    durationMs: endsAt.getTime() - startsAt.getTime(),
    updateCount: timing.revealUpdates,
  });

  if (plan.length) {
    await tx
      .insert(electionNightUpdates)
      .values(
        plan.map((update) => ({
          election,
          cycle,
          sequence: update.sequence,
          revealAt: update.revealAt,
          type: update.type,
          headline: update.headline,
          cumulativeTotals: update.cumulativeTotals,
          totalPoints: update.totalPoints,
        })),
      )
      .onConflictDoNothing();
  }
  await tx
    .update(elections)
    .set({
      status: "ELECTION_NIGHT",
      electionNightStartsAt: startsAt,
      electionNightEndsAt: endsAt,
      reportingSeed: seed,
    })
    .where(eq(elections.election, election));
  return endsAt;
}

async function concludeElection(
  tx: Transaction,
  election: ElectionType,
  cycle: number,
  seatsValue: number | null,
  now: Date,
) {
  await recomputeCandidateTotals(tx, election);
  const office = election === "President" ? "President" : "Senator";
  await tx
    .update(users)
    .set({ role: "Representative" })
    .where(eq(users.role, office));

  const allCandidates = await tx
    .select()
    .from(candidates)
    .where(eq(candidates.election, election))
    .orderBy(desc(candidates.votes), candidates.id);
  const seats = election === "President" ? 1 : seatsValue || 1;
  const winners = allCandidates.slice(0, seats);
  const winnerUserIds = winners
    .map((winner) => winner.userId)
    .filter((id): id is number => id !== null);

  if (winnerUserIds.length) {
    await tx
      .update(users)
      .set({ role: office })
      .where(inArray(users.id, winnerUserIds));
    await tx
      .update(candidates)
      .set({ haswon: true })
      .where(
        inArray(
          candidates.id,
          winners.map((winner) => winner.id),
        ),
      );
    await tx.insert(feed).values(
      winners
        .filter((winner) => winner.userId !== null)
        .map((winner) => ({
          userId: winner.userId,
          visibility: "admin" as const,
          content:
            election === "President"
              ? "has been elected as the President!"
              : "has been elected as a Senator!",
        })),
    );
  }

  if (election === "Senate") {
    const remaining = Math.max(0, seats - winnerUserIds.length);
    if (remaining > 0) {
      const fillers = await tx
        .select({ userId: users.id })
        .from(users)
        .where(
          and(
            sql`${users.username} NOT LIKE 'Banned User%'`,
            sql`${users.role} NOT IN ('President', 'Senator')`,
            winnerUserIds.length
              ? sql`${users.id} <> ALL(ARRAY[${sql.join(
                  winnerUserIds.map((id) => sql`${id}::integer`),
                  sql`, `,
                )}])`
              : undefined,
          ),
        )
        .orderBy(sql`RANDOM()`)
        .limit(remaining);
      if (fillers.length) {
        const fillerIds = fillers.map((filler) => filler.userId);
        await tx
          .update(users)
          .set({ role: "Senator" })
          .where(inArray(users.id, fillerIds));
        await tx.insert(feed).values(
          fillerIds.map((userId) => ({
            userId,
            visibility: "admin" as const,
            content: "has been appointed as a Senator!",
          })),
        );
      }
    }
  }

  await archiveElection(tx, election, cycle, seatsValue);
  await tx
    .update(elections)
    .set({
      status: "CONCLUDED",
      concludedAt: now,
    })
    .where(eq(elections.election, election));
}

async function resetElection(
  tx: Transaction,
  election: ElectionType,
  now: Date,
  timing: ElectionTiming,
) {
  await tx.delete(votes).where(eq(votes.voteType, election));
  await tx.delete(candidates).where(eq(candidates.election, election));
  if (election === "President") {
    await tx.delete(primaryVotes);
    await tx.delete(primaryCandidates);
  }
  await tx
    .update(elections)
    .set({
      status: "CANDIDACY",
      cycle: sql`${elections.cycle} + 1`,
      candidacyStartsAt: now,
      candidacyEndsAt: new Date(
        now.getTime() + timing.candidacyDurationMs[election],
      ),
      votingStartsAt: null,
      votingEndsAt: null,
      electionNightStartsAt: null,
      electionNightEndsAt: null,
      concludedAt: null,
      reportingSeed: null,
    })
    .where(eq(elections.election, election));
}

async function advanceOneElection(
  electionType: ElectionType,
  now: Date,
  timing: ElectionTiming,
): Promise<{
  advanced: boolean;
  conclusionTask: { cycle: number; deadline: Date } | null;
}> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = ${electionType} FOR UPDATE`,
    );
    const [election] = await tx
      .select()
      .from(elections)
      .where(eq(elections.election, electionType))
      .limit(1);
    if (!election) return { advanced: false, conclusionTask: null };

    const status = normalizeElectionStatus(election.status);
    if (election.status !== status) {
      await tx
        .update(elections)
        .set({ status })
        .where(eq(elections.election, electionType));
    }
    const overdue = isElectionStageOverdue({ ...election, status }, now);
    if (status === "CANDIDACY" && overdue) {
      await beginVoting(tx, electionType, now, timing);
      return { advanced: true, conclusionTask: null };
    }
    if (status === "VOTING" && overdue) {
      const deadline = await beginElectionNight(
        tx,
        electionType,
        election.cycle,
        election.votingEndsAt,
        election.reportingSeed,
        now,
        timing,
      );
      return {
        advanced: true,
        conclusionTask: { cycle: election.cycle, deadline },
      };
    }
    if (status === "ELECTION_NIGHT" && overdue) {
      await concludeElection(
        tx,
        electionType,
        election.cycle,
        election.seats,
        now,
      );
      return { advanced: true, conclusionTask: null };
    }
    if (
      status === "CONCLUDED" &&
      election.concludedAt &&
      election.concludedAt.getTime() +
        timing.concludedDurationMs[electionType] <=
        now.getTime()
    ) {
      await resetElection(tx, electionType, now, timing);
      return { advanced: true, conclusionTask: null };
    }
    return {
      advanced: false,
      conclusionTask:
        status === "ELECTION_NIGHT" && election.electionNightEndsAt
          ? {
              cycle: election.cycle,
              deadline: election.electionNightEndsAt,
            }
          : null,
    };
  });
}

export async function advanceElectionLifecycle(options?: {
  now?: Date;
  timing?: ElectionTiming;
}) {
  const now = options?.now ?? new Date();
  const timing = options?.timing ?? DEFAULT_ELECTION_TIMING;
  await ensureElectionSchedule({ now, timing });
  for (const election of ["President", "Senate"] as const) {
    for (let transition = 0; transition < 4; transition++) {
      const result = await advanceOneElection(election, now, timing);
      if (result.conclusionTask) {
        await ensureElectionConclusionTask({
          election,
          cycle: result.conclusionTask.cycle,
          deadline: result.conclusionTask.deadline,
        });
      }
      if (!result.advanced) break;
    }
  }
}
