import { and, eq, gt, inArray, like, not, sql } from "drizzle-orm";
import { db } from "@/db";
import { bills, candidates, coalitionMembers, coalitionProposals, coalitionVotes, committeeAssessments, elections, parties, primaryCandidates, primaryVotes, users, votes } from "@/db/schema";
import { primaryNextMoves } from "@/lib/dashboard/action-eligibility";
import { canDeclareNationalCandidacy } from "@/lib/elections/dashboard-actions";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { officeVotingConfig } from "@/lib/server/dashboard/office-votes";
import { getPendingBillGuidance } from "@/lib/server/bills/pending-guidance";

export type NextMove = { key: string; title: string; url: string };

/** The same election/primary eligibility helpers and bill-vote predicates as Your next moves. */
export async function getPendingNextMoves(email: string): Promise<Array<NextMove>> {
  const [player] = await db.select({
    id: users.id,
    role: users.role,
    partyId: users.partyId,
    partyName: parties.name,
    partyLeaderId: parties.leaderId,
    partyArchivedAt: parties.archivedAt,
    active: users.isActive,
  }).from(users).leftJoin(parties, eq(parties.id, users.partyId))
    .where(userEmailEquals(email)).limit(1);
  if (!player || !player.active) return [];

  const raceNames = ["President", "Senate"];
  const [electionRows, candidateRows, votedRows, primaryCandidateRows] = await Promise.all([
    db.select({ election: elections.election, status: elections.status, cycle: elections.cycle,
      candidacyEndsAt: elections.candidacyEndsAt }).from(elections)
      .where(inArray(elections.election, raceNames)),
    db.select({ userId: candidates.userId, election: candidates.election })
      .from(candidates).innerJoin(users, eq(users.id, candidates.userId))
      .where(and(inArray(candidates.election, raceNames), not(like(users.username, "Banned User%")))),
    db.select({ voteType: votes.voteType }).from(votes)
      .where(and(eq(votes.userId, player.id), inArray(votes.voteType, raceNames)))
      .groupBy(votes.voteType),
    db.select({ id: primaryCandidates.id }).from(primaryCandidates)
      .where(eq(primaryCandidates.userId, player.id)).limit(1),
  ]);
  const races = electionRows.map((race) => ({
    ...race,
    player: {
      isCandidate: candidateRows.some((candidate) => candidate.election === race.election && candidate.userId === player.id),
      isPrimaryCandidate: primaryCandidateRows.length > 0,
      hasVoted: votedRows.some((vote) => vote.voteType === race.election),
    },
    candidateCount: candidateRows.filter((candidate) => candidate.election === race.election).length,
  }));
  const [presidential] = electionRows.filter((race) => race.election === "President");
  let primary: Parameters<typeof primaryNextMoves>[0] = null;
  if (player.partyId) {
    const [coalition] = await db.select({ coalitionId: coalitionMembers.coalitionId })
      .from(coalitionMembers).where(eq(coalitionMembers.partyId, player.partyId)).limit(1);
    const partyIds = coalition
      ? (await db.select({ partyId: coalitionMembers.partyId }).from(coalitionMembers)
        .where(eq(coalitionMembers.coalitionId, coalition.coalitionId))).map((member) => member.partyId)
      : [player.partyId];
    const [primaryCandidatesInGroup, [ballot]] = await Promise.all([
      db.select({ userId: primaryCandidates.userId }).from(primaryCandidates)
        .where(inArray(primaryCandidates.partyId, partyIds)),
      db.select({ id: primaryVotes.id }).from(primaryVotes)
        .where(eq(primaryVotes.userId, player.id)).limit(1),
    ]);
    primary = {
      electionStatus: presidential?.status ?? null,
      candidacyEndsAt: presidential?.candidacyEndsAt ?? null,
      isCandidate: primaryCandidatesInGroup.some((candidate) => candidate.userId === player.id),
      candidates: primaryCandidatesInGroup,
      hasVoted: Boolean(ballot),
    };
  }
  const primaryActions = primaryNextMoves(primary, player, { races });
  const electionCandidacies = races.filter((race) => canDeclareNationalCandidacy(race, races, player));
  const electionVotes = races.filter((race) => race.status === "VOTING" && !race.player.hasVoted && race.candidateCount > 0);
  const config = officeVotingConfig[player.role as keyof typeof officeVotingConfig];
  const [pendingBillVotes, pendingAssessments, pendingGuidance, pendingCoalitions] = await Promise.all([
    config ? db.select({ id: bills.id, title: bills.title })
      .from(bills).where(and(
        eq(bills.status, "Voting"), eq(bills.stage, config.stage), gt(bills.stageEndsAt, new Date()),
        sql`not exists (select 1 from ${config.votes} where ${config.votes.billId} = ${bills.id} and ${config.votes.voterId} = ${player.id})`,
      )) : Promise.resolve([]),
    player.role === "Senator" ? db.select({ id: bills.id, title: bills.title })
      .from(bills).where(and(
        eq(bills.status, "Committee"), gt(bills.stageEndsAt, new Date()),
        sql`not exists (select 1 from ${committeeAssessments} where ${committeeAssessments.billId} = ${bills.id} and ${committeeAssessments.senatorId} = ${player.id})`,
      )) : Promise.resolve([]),
    getPendingBillGuidance(player),
    player.partyId && player.partyLeaderId === player.id ? db.select({
      id: coalitionProposals.id, coalitionId: coalitionProposals.coalitionId,
      proposalType: coalitionProposals.proposalType,
    }).from(coalitionProposals).innerJoin(coalitionMembers, and(
      eq(coalitionMembers.coalitionId, coalitionProposals.coalitionId),
      eq(coalitionMembers.partyId, player.partyId),
    )).where(and(
      eq(coalitionProposals.status, "open"),
      sql`not exists (select 1 from ${coalitionVotes} where ${coalitionVotes.proposalId} = ${coalitionProposals.id} and ${coalitionVotes.voterPartyId} = ${player.partyId})`,
    )) : Promise.resolve([]),
  ]);

  const primaryCycle = presidential?.cycle ?? 0;
  return [
    ...(!player.partyId ? [{ key: "party:explore", title: "Find your place in Oscana", url: "/dashboard/parties" }] : []),
    ...(primaryActions.stand ? [{ key: `primary:${primaryCycle}:stand`, title: "Stand in your presidential primary", url: "/dashboard/parties/primaries" }] : []),
    ...(primaryActions.withdraw ? [{ key: `primary:${primaryCycle}:withdraw`, title: "Withdraw from your presidential primary", url: "/dashboard/parties/primaries" }] : []),
    ...(primaryActions.vote ? [{ key: `primary:${primaryCycle}:vote`, title: "Vote in your presidential primary", url: "/dashboard/parties/primaries" }] : []),
    ...electionCandidacies.map((race) => ({ key: `election:${race.election}:${race.cycle}:stand`, title: `Stand in the ${race.election} election`, url: `/dashboard/elections/current-${race.election}` })),
    ...electionVotes.map((race) => ({ key: `election:${race.election}:${race.cycle}:vote`, title: `Vote in the ${race.election} election`, url: `/dashboard/elections/current-${race.election}` })),
    ...pendingBillVotes.map((bill) => ({ key: `bill:${bill.id}:${config.stage}:vote`, title: `Vote on ${bill.title}`, url: `/dashboard/bills/${bill.id}` })),
    ...pendingAssessments.map((bill) => ({ key: `bill:${bill.id}:assess`, title: `Assess ${bill.title}`, url: `/dashboard/bills/${bill.id}` })),
    ...pendingGuidance.map((bill) => ({ key: `bill:${bill.id}:${bill.stage}:party:${player.partyId}:guidance`, title: `Issue voting guidance for ${bill.title}`, url: `/dashboard/bills/${bill.id}#party-guidance` })),
    ...pendingCoalitions.map((proposal) => ({ key: `coalition:${proposal.id}:vote`, title: `Vote on a coalition ${proposal.proposalType.replaceAll("_", " ")} proposal`, url: `/dashboard/parties/coalitions/${proposal.coalitionId}` })),
  ];
}
