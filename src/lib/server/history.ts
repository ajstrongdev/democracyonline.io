import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, getTableColumns, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { getOfficeholderSelection } from "@/lib/utils/history";
import { getElectionCoverage } from "@/lib/server/election-coverage";
import { ensureElectionSchedule } from "@/lib/server/election-schedule";
import {
  archivedParties,
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  candidates,
  electionCandidateHistory,
  electionHistory,
  electionOfficeholderHistory,
  elections,
  parties,
  partyMembershipEvents,
  users,
  votes,
} from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function archiveElection(
  tx: Transaction,
  election: "President" | "Senate",
  cycle: number,
  seats: number | null,
) {
  const [existing] = await tx
    .select({ id: electionHistory.id })
    .from(electionHistory)
    .where(
      and(
        eq(electionHistory.election, election),
        eq(electionHistory.cycle, cycle),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [totals] = await tx
    .select({
      totalBallots: sql<number>`count(distinct ${votes.userId})::int`,
      totalPoints: sql<number>`coalesce(sum(${votes.points}), 0)::int`,
    })
    .from(votes)
    .where(eq(votes.voteType, election));

  const [history] = await tx
    .insert(electionHistory)
    .values({
      election,
      cycle,
      seats,
      totalBallots: totals?.totalBallots ?? 0,
      totalPoints: totals?.totalPoints ?? 0,
    })
    .returning({ id: electionHistory.id });

  const results = await tx
    .select({
      userId: users.id,
      username: users.username,
      partyId: parties.id,
      partyName: parties.name,
      partyColor: parties.color,
      points: candidates.votes,
      elected: candidates.haswon,
      firstPreferenceVotes: sql<number>`count(${votes.id}) filter (where ${votes.rank} = 1)::int`,
    })
    .from(candidates)
    .innerJoin(users, eq(candidates.userId, users.id))
    .leftJoin(parties, eq(users.partyId, parties.id))
    .leftJoin(
      votes,
      and(eq(votes.candidateId, candidates.id), eq(votes.voteType, election)),
    )
    .where(eq(candidates.election, election))
    .groupBy(candidates.id, users.id, parties.id)
    .orderBy(desc(candidates.votes), candidates.id);

  if (results.length) {
    await tx.insert(electionCandidateHistory).values(
      results.map((result, index) => ({
        electionHistoryId: history.id,
        userId: result.userId,
        username: result.username,
        partyId: result.partyId,
        partyName: result.partyName,
        partyColor: result.partyColor,
        points: result.points ?? 0,
        firstPreferenceVotes: result.firstPreferenceVotes,
        placement: index + 1,
        elected: result.elected ?? false,
      })),
    );
  }

  const electedIds = new Set(
    results.filter((result) => result.elected).map((result) => result.userId),
  );
  const officeholders = await tx
    .select({
      userId: users.id,
      username: users.username,
      partyId: parties.id,
      partyName: parties.name,
      partyColor: parties.color,
      office: users.role,
    })
    .from(users)
    .leftJoin(parties, eq(users.partyId, parties.id))
    .where(sql`${users.role} in ('Representative', 'Senator', 'President')`)
    .orderBy(users.role, users.username);

  if (officeholders.length) {
    await tx.insert(electionOfficeholderHistory).values(
      officeholders.map((officeholder) => ({
        electionHistoryId: history.id,
        userId: officeholder.userId,
        username: officeholder.username,
        partyId: officeholder.partyId,
        partyName: officeholder.partyName,
        partyColor: officeholder.partyColor,
        office: officeholder.office ?? "Representative",
        selection: getOfficeholderSelection(
          election,
          officeholder.office ?? "Representative",
          electedIds.has(officeholder.userId),
        ),
      })),
    );
  }

  return history.id;
}

const voteCount = (
  table:
    | typeof billVotesHouse
    | typeof billVotesSenate
    | typeof billVotesPresidential,
  yes: boolean,
) =>
  sql<number>`(select count(*)::int from ${table} where ${table.billId} = ${bills.id} and ${table.voteYes} = ${yes})`;

export const getWikiHome = createServerFn().handler(async () => {
  const [
    [playerCount],
    [billCount],
    [electionCount],
    [partyCount],
    recentElections,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.username} not like 'Banned User%'`),
    db.select({ count: sql<number>`count(*)::int` }).from(bills),
    db.select({ count: sql<number>`count(*)::int` }).from(electionHistory),
    db.select({ count: sql<number>`count(*)::int` }).from(parties),
    db
      .select()
      .from(electionHistory)
      .orderBy(desc(electionHistory.concludedAt))
      .limit(4),
  ]);

  return {
    counts: {
      players: playerCount?.count ?? 0,
      bills: billCount?.count ?? 0,
      elections: electionCount?.count ?? 0,
      parties: partyCount?.count ?? 0,
    },
    recentElections,
  };
});

export const getWikiPlayers = createServerFn().handler(() =>
  db
    .select({
      id: users.id,
      username: users.username,
      photoUrl: users.photoUrl,
      bio: users.bio,
      role: users.role,
      politicalLeaning: users.politicalLeaning,
      isActive: users.isActive,
      partyId: parties.id,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(users)
    .leftJoin(parties, eq(users.partyId, parties.id))
    .where(sql`${users.username} not like 'Banned User%'`)
    .orderBy(users.username),
);

export const getWikiPlayer = createServerFn()
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [player] = await db
      .select({
        id: users.id,
        username: users.username,
        photoUrl: users.photoUrl,
        bio: users.bio,
        pronouns: users.pronouns,
        role: users.role,
        politicalLeaning: users.politicalLeaning,
        createdAt: users.createdAt,
        isActive: users.isActive,
        partyId: parties.id,
        partyName: parties.name,
        partyColor: parties.color,
      })
      .from(users)
      .leftJoin(parties, eq(users.partyId, parties.id))
      .where(eq(users.id, data.id))
      .limit(1);
    if (!player) return null;

    const [
      candidacies,
      offices,
      authoredBills,
      houseVotes,
      senateVotes,
      presidentialVotes,
      partyHistory,
    ] = await Promise.all([
      db
        .select({
          historyId: electionHistory.id,
          election: electionHistory.election,
          cycle: electionHistory.cycle,
          concludedAt: electionHistory.concludedAt,
          points: electionCandidateHistory.points,
          firstPreferenceVotes: electionCandidateHistory.firstPreferenceVotes,
          placement: electionCandidateHistory.placement,
          elected: electionCandidateHistory.elected,
          totalPoints: electionHistory.totalPoints,
          totalBallots: electionHistory.totalBallots,
        })
        .from(electionCandidateHistory)
        .innerJoin(
          electionHistory,
          eq(electionCandidateHistory.electionHistoryId, electionHistory.id),
        )
        .where(eq(electionCandidateHistory.userId, data.id))
        .orderBy(desc(electionHistory.concludedAt)),
      db
        .select({
          historyId: electionHistory.id,
          election: electionHistory.election,
          cycle: electionHistory.cycle,
          concludedAt: electionHistory.concludedAt,
          office: electionOfficeholderHistory.office,
          selection: electionOfficeholderHistory.selection,
          partyId: electionOfficeholderHistory.partyId,
          partyName: electionOfficeholderHistory.partyName,
          partyColor: electionOfficeholderHistory.partyColor,
        })
        .from(electionOfficeholderHistory)
        .innerJoin(
          electionHistory,
          eq(electionOfficeholderHistory.electionHistoryId, electionHistory.id),
        )
        .where(eq(electionOfficeholderHistory.userId, data.id))
        .orderBy(desc(electionHistory.concludedAt)),
      db
        .select({ id: bills.id, title: bills.title, status: bills.status })
        .from(bills)
        .where(eq(bills.creatorId, data.id))
        .orderBy(desc(bills.createdAt)),
      getPlayerBillVotes(billVotesHouse, data.id, "House"),
      getPlayerBillVotes(billVotesSenate, data.id, "Senate"),
      getPlayerBillVotes(billVotesPresidential, data.id, "President"),
      db
        .select()
        .from(partyMembershipEvents)
        .where(eq(partyMembershipEvents.userId, data.id))
        .orderBy(desc(partyMembershipEvents.occurredAt)),
    ]);

    return {
      player,
      candidacies,
      offices,
      partyHistory,
      authoredBills,
      billVotes: [...houseVotes, ...senateVotes, ...presidentialVotes].sort(
        (a, b) => b.voteId - a.voteId,
      ),
    };
  });

function getPlayerBillVotes(
  table:
    | typeof billVotesHouse
    | typeof billVotesSenate
    | typeof billVotesPresidential,
  userId: number,
  chamber: string,
) {
  return db
    .select({
      voteId: table.id,
      billId: bills.id,
      billTitle: bills.title,
      billStatus: bills.status,
      voteYes: table.voteYes,
      chamber: sql<string>`${chamber}`,
    })
    .from(table)
    .innerJoin(bills, eq(table.billId, bills.id))
    .where(eq(table.voterId, userId));
}

export const getWikiBills = createServerFn().handler(() =>
  db
    .select({
      ...getTableColumns(bills),
      creator: users.username,
      houseYes: voteCount(billVotesHouse, true),
      houseNo: voteCount(billVotesHouse, false),
      senateYes: voteCount(billVotesSenate, true),
      senateNo: voteCount(billVotesSenate, false),
      presidentYes: voteCount(billVotesPresidential, true),
      presidentNo: voteCount(billVotesPresidential, false),
    })
    .from(bills)
    .leftJoin(users, eq(bills.creatorId, users.id))
    .orderBy(desc(bills.createdAt)),
);

export const getWikiBill = createServerFn()
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [bill] = await db
      .select({ ...getTableColumns(bills), creator: users.username })
      .from(bills)
      .leftJoin(users, eq(bills.creatorId, users.id))
      .where(eq(bills.id, data.id))
      .limit(1);
    if (!bill) return null;

    const [house, senate, president] = await Promise.all([
      getBillRollCall(billVotesHouse, data.id),
      getBillRollCall(billVotesSenate, data.id),
      getBillRollCall(billVotesPresidential, data.id),
    ]);
    return { bill, rollCalls: { house, senate, president } };
  });

function getBillRollCall(
  table:
    | typeof billVotesHouse
    | typeof billVotesSenate
    | typeof billVotesPresidential,
  billId: number,
) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      voteYes: table.voteYes,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(table)
    .leftJoin(users, eq(table.voterId, users.id))
    .leftJoin(parties, eq(users.partyId, parties.id))
    .where(eq(table.billId, billId))
    .orderBy(users.username);
}

export const getWikiElections = createServerFn().handler(async () => {
  await ensureElectionSchedule();
  const [archived, current] = await Promise.all([
    db
      .select()
      .from(electionHistory)
      .orderBy(desc(electionHistory.concludedAt)),
    db.select().from(elections).orderBy(asc(elections.election)),
  ]);
  return {
    archived,
    current: current.filter(
      (election) =>
        !archived.some(
          (record) =>
            record.election === election.election &&
            record.cycle === election.cycle,
        ),
    ),
  };
});

export const getWikiElection = createServerFn()
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    let requestedId = data.id;
    const alias = /^(president|senate)-(\d+)$/i.exec(requestedId);
    if (alias) {
      const electionName =
        alias[1].toLowerCase() === "president" ? "President" : "Senate";
      const cycle = Number(alias[2]);
      const [archived] = await db
        .select({ id: electionHistory.id })
        .from(electionHistory)
        .where(
          and(
            eq(electionHistory.election, electionName),
            eq(electionHistory.cycle, cycle),
          ),
        )
        .limit(1);
      if (archived) requestedId = String(archived.id);
      else {
        const [current] = await db
          .select({ election: elections.election })
          .from(elections)
          .where(
            and(
              eq(elections.election, electionName),
              eq(elections.cycle, cycle),
            ),
          )
          .limit(1);
        if (!current) return null;
        requestedId = `current-${electionName}`;
      }
    }

    if (requestedId.startsWith("current-")) {
      const electionName = requestedId.slice(8);
      if (electionName !== "President" && electionName !== "Senate")
        return null;
      const [election] = await db
        .select()
        .from(elections)
        .where(eq(elections.election, electionName))
        .limit(1);
      if (!election) return null;
      const coverage =
        election.status === "ELECTION_NIGHT"
          ? await getElectionCoverage(electionName, election.cycle)
          : null;
      const liveCandidates = await db
        .select({
          id: candidates.id,
          userId: users.id,
          username: users.username,
          photoUrl: users.photoUrl,
          partyId: parties.id,
          partyName: parties.name,
          partyColor: parties.color,
          certifiedPoints: sql<number>`coalesce(${candidates.votes}, 0)::int`,
          firstPreferenceVotes: sql<number>`count(${votes.id}) filter (where ${votes.rank} = 1)::int`,
          elected: candidates.haswon,
        })
        .from(candidates)
        .innerJoin(users, eq(candidates.userId, users.id))
        .leftJoin(parties, eq(users.partyId, parties.id))
        .leftJoin(votes, eq(votes.candidateId, candidates.id))
        .where(eq(candidates.election, electionName))
        .groupBy(candidates.id, users.id, parties.id);
      liveCandidates.sort((a, b) => election.status === "CONCLUDED"
        ? b.certifiedPoints - a.certifiedPoints || a.username.localeCompare(b.username)
        : a.username.localeCompare(b.username));
      const [ballots] = await db
        .select({ count: sql<number>`count(distinct ${votes.userId})::int` })
        .from(votes)
        .where(eq(votes.voteType, electionName));
      return {
        current: true as const,
        election,
        candidates: liveCandidates.map((candidate, index) => ({
          ...candidate,
          points:
            election.status === "ELECTION_NIGHT"
              ? (coverage?.cumulativeTotals[String(candidate.id)] ?? 0)
              : election.status === "CONCLUDED"
                ? candidate.certifiedPoints
                : 0,
          firstPreferenceVotes:
            election.status === "CONCLUDED"
              ? candidate.firstPreferenceVotes
              : 0,
          placement: index + 1,
        })),
        totalBallots:
          election.status === "ELECTION_NIGHT" ||
          election.status === "CONCLUDED"
            ? (ballots?.count ?? 0)
            : 0,
      };
    }

    const id = Number(requestedId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const [election] = await db
      .select()
      .from(electionHistory)
      .where(eq(electionHistory.id, id))
      .limit(1);
    if (!election) return null;
    const historicalCandidates = await db
      .select({
        ...getTableColumns(electionCandidateHistory),
        photoUrl: users.photoUrl,
      })
      .from(electionCandidateHistory)
      .leftJoin(users, eq(users.id, electionCandidateHistory.userId))
      .where(eq(electionCandidateHistory.electionHistoryId, id))
      .orderBy(electionCandidateHistory.placement);
    return {
      current: false as const,
      election,
      candidates: historicalCandidates,
      totalBallots: election.totalBallots,
    };
  });

export const getWikiParties = createServerFn().handler(async () => {
  const [stored, legacyArchived, historical] = await Promise.all([
    db
      .select({
        id: parties.id,
        name: parties.name,
        color: parties.color,
        bio: parties.bio,
        leaning: parties.leaning,
        archivedAt: parties.archivedAt,
        memberCount: sql<number>`count(${users.id})::int`,
      })
      .from(parties)
      .leftJoin(users, eq(users.partyId, parties.id))
      .groupBy(parties.id),
    db.select().from(archivedParties),
    db
      .select({
        id: electionCandidateHistory.partyId,
        name: electionCandidateHistory.partyName,
        color: electionCandidateHistory.partyColor,
        appearances: sql<number>`count(*)::int`,
        victories: sql<number>`count(*) filter (where ${electionCandidateHistory.elected})::int`,
      })
      .from(electionCandidateHistory)
      .where(sql`${electionCandidateHistory.partyId} is not null`)
      .groupBy(
        electionCandidateHistory.partyId,
        electionCandidateHistory.partyName,
        electionCandidateHistory.partyColor,
      ),
  ]);
  const records = new Map<
    number,
    {
      id: number;
      name: string;
      color: string;
      bio: string | null;
      leaning: string | null;
      memberCount: number;
      appearances: number;
      victories: number;
      current: boolean;
      archivedAt: Date | null;
    }
  >();
  for (const party of stored) {
    records.set(party.id, {
      ...party,
      appearances: 0,
      victories: 0,
      current: !party.archivedAt,
    });
  }
  for (const party of legacyArchived) {
    if (records.has(party.partyId)) continue;
    records.set(party.partyId, {
      id: party.partyId,
      name: party.name,
      color: party.color,
      bio: party.bio,
      leaning: party.leaning,
      memberCount: 0,
      appearances: 0,
      victories: 0,
      current: false,
      archivedAt: party.archivedAt,
    });
  }
  for (const party of historical) {
    if (!party.id || !party.name || !party.color) continue;
    const existing = records.get(party.id);
    records.set(party.id, {
      id: party.id,
      name: existing?.name ?? party.name,
      color: existing?.color ?? party.color,
      bio: existing?.bio ?? null,
      leaning: existing?.leaning ?? null,
      memberCount: existing?.memberCount ?? 0,
      appearances: (existing?.appearances ?? 0) + party.appearances,
      victories: (existing?.victories ?? 0) + party.victories,
      current: existing?.current ?? false,
      archivedAt: existing?.archivedAt ?? null,
    });
  }
  return [...records.values()].sort(
    (left, right) =>
      Number(right.current) - Number(left.current) ||
      right.memberCount - left.memberCount ||
      left.name.localeCompare(right.name),
  );
});

export const getWikiParty = createServerFn()
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [storedParty] = await db
      .select()
      .from(parties)
      .where(eq(parties.id, data.id))
      .limit(1);
    const [archivedParty] = storedParty
      ? []
      : await db
          .select()
          .from(archivedParties)
          .where(eq(archivedParties.partyId, data.id))
          .limit(1);
    const [results, representation, members, defections] = await Promise.all([
      db
        .select({
          historyId: electionHistory.id,
          election: electionHistory.election,
          cycle: electionHistory.cycle,
          concludedAt: electionHistory.concludedAt,
          partyName: electionCandidateHistory.partyName,
          partyColor: electionCandidateHistory.partyColor,
          candidates: sql<number>`count(*)::int`,
          points: sql<number>`sum(${electionCandidateHistory.points})::int`,
          firstPreferences: sql<number>`sum(${electionCandidateHistory.firstPreferenceVotes})::int`,
          elected: sql<number>`count(*) filter (where ${electionCandidateHistory.elected})::int`,
          totalPoints: electionHistory.totalPoints,
        })
        .from(electionCandidateHistory)
        .innerJoin(
          electionHistory,
          eq(electionCandidateHistory.electionHistoryId, electionHistory.id),
        )
        .where(eq(electionCandidateHistory.partyId, data.id))
        .groupBy(
          electionHistory.id,
          electionCandidateHistory.partyName,
          electionCandidateHistory.partyColor,
        )
        .orderBy(desc(electionHistory.concludedAt)),
      db
        .select({
          historyId: electionHistory.id,
          election: electionHistory.election,
          cycle: electionHistory.cycle,
          concludedAt: electionHistory.concludedAt,
          partyName: electionOfficeholderHistory.partyName,
          partyColor: electionOfficeholderHistory.partyColor,
          house: sql<number>`count(*) filter (where ${electionOfficeholderHistory.office} = 'Representative')::int`,
          senate: sql<number>`count(*) filter (where ${electionOfficeholderHistory.office} = 'Senator')::int`,
          president: sql<number>`count(*) filter (where ${electionOfficeholderHistory.office} = 'President')::int`,
        })
        .from(electionOfficeholderHistory)
        .innerJoin(
          electionHistory,
          eq(electionOfficeholderHistory.electionHistoryId, electionHistory.id),
        )
        .where(eq(electionOfficeholderHistory.partyId, data.id))
        .groupBy(
          electionHistory.id,
          electionOfficeholderHistory.partyName,
          electionOfficeholderHistory.partyColor,
        )
        .orderBy(desc(electionHistory.concludedAt)),
      storedParty && !storedParty.archivedAt
        ? db
            .select({
              id: users.id,
              username: users.username,
              photoUrl: users.photoUrl,
              role: users.role,
            })
            .from(users)
            .where(eq(users.partyId, data.id))
            .orderBy(users.username)
        : Promise.resolve([]),
      db
        .select({
          ...getTableColumns(partyMembershipEvents),
          photoUrl: users.photoUrl,
        })
        .from(partyMembershipEvents)
        .leftJoin(users, eq(users.id, partyMembershipEvents.userId))
        .where(
          or(
            eq(partyMembershipEvents.fromPartyId, data.id),
            eq(partyMembershipEvents.toPartyId, data.id),
          ),
        )
        .orderBy(desc(partyMembershipEvents.occurredAt)),
    ]);
    const historicalName =
      archivedParty?.name ??
      results[0]?.partyName ??
      representation[0]?.partyName;
    const historicalColor =
      archivedParty?.color ??
      results[0]?.partyColor ??
      representation[0]?.partyColor;
    if (!storedParty && (!historicalName || !historicalColor)) return null;
    const name = storedParty?.name ?? historicalName;
    const color = storedParty?.color ?? historicalColor;
    if (!name || !color) return null;
    const leaderId =
      storedParty?.leaderId ?? storedParty?.formerLeaderId ?? null;
    const [leader] = leaderId
      ? await db
           .select({ id: users.id, username: users.username, photoUrl: users.photoUrl })
          .from(users)
          .where(eq(users.id, leaderId))
          .limit(1)
      : [];
    return {
      party: {
        id: data.id,
        name,
        color,
        bio: storedParty?.bio ?? archivedParty?.bio ?? null,
        leaning: storedParty?.leaning ?? archivedParty?.leaning ?? null,
        logo: storedParty?.logo ?? archivedParty?.logo ?? null,
        discord: storedParty?.discord ?? null,
        leaderId,
        current: Boolean(storedParty && !storedParty.archivedAt),
        archivedAt:
          storedParty?.archivedAt ?? archivedParty?.archivedAt ?? null,
      },
      leader: leader ?? null,
      members,
      results,
      representation,
      defections,
    };
  });

export const getGovernmentCompositionHistory = createServerFn().handler(
  async () => {
    const [rows, membershipEvents] = await Promise.all([
      db
        .select({
          historyId: electionHistory.id,
          election: electionHistory.election,
          cycle: electionHistory.cycle,
          concludedAt: electionHistory.concludedAt,
          userId: electionOfficeholderHistory.userId,
          username: electionOfficeholderHistory.username,
          office: electionOfficeholderHistory.office,
          partyId: electionOfficeholderHistory.partyId,
          partyName: electionOfficeholderHistory.partyName,
          partyColor: electionOfficeholderHistory.partyColor,
        })
        .from(electionOfficeholderHistory)
        .innerJoin(
          electionHistory,
          eq(electionOfficeholderHistory.electionHistoryId, electionHistory.id),
        )
        .orderBy(electionHistory.concludedAt, electionHistory.id),
      db
        .select()
        .from(partyMembershipEvents)
        .orderBy(partyMembershipEvents.occurredAt, partyMembershipEvents.id),
    ]);

    const snapshots = new Map<
      number,
      {
        id: number;
        election: string;
        cycle: number;
        concludedAt: Date;
        members: typeof rows;
      }
    >();
    for (const row of rows) {
      const snapshot = snapshots.get(row.historyId) ?? {
        id: row.historyId,
        election: row.election,
        cycle: row.cycle,
        concludedAt: row.concludedAt,
        members: [],
      };
      snapshot.members.push(row);
      snapshots.set(row.historyId, snapshot);
    }
    type Composition = {
      key: string;
      name: string;
      color: string;
      house: number;
      senate: number;
      president: number;
    };
    const electionPoints = [...snapshots.values()].map((snapshot) => {
      const composition = new Map<string, Composition>();
      for (const member of snapshot.members) {
        const key = member.partyId ? `party-${member.partyId}` : "independent";
        const entry = composition.get(key) ?? {
          key,
          name: member.partyName ?? "Independent",
          color: member.partyColor ?? "#64748b",
          house: 0,
          senate: 0,
          president: 0,
        };
        if (member.office === "Representative") entry.house += 1;
        if (member.office === "Senator") entry.senate += 1;
        if (member.office === "President") entry.president += 1;
        composition.set(key, entry);
      }
      return {
        kind: "election" as const,
        key: `election-${snapshot.id}`,
        occurredAt: snapshot.concludedAt,
        electionHistoryId: snapshot.id,
        election: snapshot.election,
        cycle: snapshot.cycle,
        event: null,
        composition: [...composition.values()],
      };
    });

    const points = [
      ...electionPoints,
      ...membershipEvents.map((event) => ({
        kind: "defection" as const,
        key: `defection-${event.id}`,
        occurredAt: event.occurredAt,
        electionHistoryId: null,
        election: null,
        cycle: null,
        event,
        composition: [] as Array<Composition>,
      })),
    ].sort(
      (left, right) =>
        left.occurredAt.getTime() - right.occurredAt.getTime() ||
        Number(left.kind === "defection") - Number(right.kind === "defection"),
    );

    let composition: Array<Composition> = [];
    const history = [];
    for (const point of points) {
      if (point.kind === "election") {
        composition = point.composition.map((party) => ({ ...party }));
      } else {
        if (!composition.length) continue;
        const office =
          point.event.office === "Representative"
            ? "house"
            : point.event.office === "Senator"
              ? "senate"
              : point.event.office === "President"
                ? "president"
                : null;
        if (!office) continue;
        const byParty = new Map(composition.map((party) => [party.key, party]));
        const fromKey = point.event.fromPartyId
          ? `party-${point.event.fromPartyId}`
          : "independent";
        const toKey = point.event.toPartyId
          ? `party-${point.event.toPartyId}`
          : "independent";
        const from = byParty.get(fromKey);
        if (from) from[office] = Math.max(0, from[office] - 1);
        const to = byParty.get(toKey) ?? {
          key: toKey,
          name: point.event.toPartyName ?? "Independent",
          color: point.event.toPartyColor ?? "#64748b",
          house: 0,
          senate: 0,
          president: 0,
        };
        to[office] += 1;
        byParty.set(toKey, to);
        composition = [...byParty.values()];
      }
      history.push({
        ...point,
        composition: composition.map((party) => ({ ...party })),
      });
    }
    return history.reverse();
  },
);
