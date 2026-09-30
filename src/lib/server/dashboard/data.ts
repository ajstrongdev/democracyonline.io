import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  committeeAssessments,
  electionCandidateHistory,
  nations,
  parties,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { getCurrentElectionDashboard } from "@/lib/server/elections/elections";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { getWikiHome } from "@/lib/server/history/history";
import { getFeedItems } from "@/lib/server/dashboard/feed";
import { getZNotificationPage } from "@/lib/server/notifications/social-notifications";
import {
  getPrimariesData,
  getPrimaryRaces,
} from "@/lib/server/organizations/primaries";
import { primaryNextMoves } from "@/lib/dashboard/action-eligibility";
import { officeVotingConfig } from "@/lib/server/dashboard/office-votes";
import { getPendingBillGuidance } from "@/lib/server/bills/pending-guidance";
import { getPartyFormationInvites } from "@/lib/server/organizations/party";
import { getPartyLeaderActions } from "@/lib/server/dashboard/party-leader-actions";

export const getDashboardData = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [
      record,
      activity,
      electionDashboard,
      nation,
      recentBills,
      primaryRaces,
    ] = await Promise.all([
      getWikiHome(),
      getFeedItems({ data: { limit: 7, offset: 0 } }),
      getCurrentElectionDashboard(),
      db
        .select({
          name: nations.name,
          civilRights: nations.civilRights,
          economy: nations.economy,
          politicalFreedoms: nations.politicalFreedoms,
        })
        .from(nations)
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: bills.id,
          title: bills.title,
          status: bills.status,
          stage: bills.stage,
          stageEndsAt: bills.stageEndsAt,
        })
        .from(bills)
        .orderBy(
          sql`case when ${bills.status} in ('Voting', 'Committee') then 0 else 1 end`,
          desc(bills.createdAt),
        )
        .limit(6),
      getPrimaryRaces(),
    ]);

    const recentElectionCandidateData = await Promise.all(
      record.recentElections.map(async (election) => {
        const historyId = election.id;
        const candidates = await db
          .select({
            username: electionCandidateHistory.username,
            partyName: electionCandidateHistory.partyName,
            partyColor: electionCandidateHistory.partyColor,
            points: electionCandidateHistory.points,
            haswon: electionCandidateHistory.elected,
          })
          .from(electionCandidateHistory)
          .where(eq(electionCandidateHistory.electionHistoryId, historyId))
          .orderBy(desc(electionCandidateHistory.points));
        return { election, candidates };
      }),
    );

    if (!context.user?.email) {
      return {
        currentUser: null,
        pendingBillVotes: [],
        pendingCommitteeAssessments: [],
        pendingBillGuidance: [],
        pendingPartyJoinRequests: [],
        pendingCoalitionJoinRequests: [],
        vacantPartyOffices: [],
        partyFormationInvites: [],
        primaryActions: {
          stand: false,
          withdraw: false,
          vote: false,
          hasVoted: false,
          deadline: null,
        },
        primaryRaces,
        pendingCoalitionProposals: [],
        zMentionSummary: {
          notifications: 0,
          accounts: 0,
          entries: [],
          hasMore: false,
        },
        activity,
        electionDashboard,
        nation,
        recentBills,
        recentElectionCandidateData,
        ...record,
      };
    }

    const [currentUser] = await db
      .select({
        id: users.id,
        username: users.username,
        photoUrl: users.photoUrl,
        role: users.role,
        politicalLeaning: users.politicalLeaning,
        active: users.isActive,
        partyId: parties.id,
        partyName: parties.name,
        partyColor: parties.color,
        partyLeaderId: parties.leaderId,
        partyChiefWhipId: parties.chiefWhipId,
        partySocialMediaOfficerId: parties.socialMediaOfficerId,
        partyArchivedAt: parties.archivedAt,
      })
      .from(users)
      .leftJoin(parties, eq(users.partyId, parties.id))
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser) {
      return {
        currentUser: null,
        pendingBillVotes: [],
        pendingCommitteeAssessments: [],
        pendingBillGuidance: [],
        pendingPartyJoinRequests: [],
        pendingCoalitionJoinRequests: [],
        vacantPartyOffices: [],
        partyFormationInvites: [],
        primaryActions: {
          stand: false,
          withdraw: false,
          vote: false,
          hasVoted: false,
          deadline: null,
        },
        primaryRaces,
        pendingCoalitionProposals: [],
        zMentionSummary: {
          notifications: 0,
          accounts: 0,
          entries: [],
          hasMore: false,
        },
        activity,
        electionDashboard,
        nation,
        recentBills,
        recentElectionCandidateData,
        ...record,
      };
    }

    const [zMentionSummary, primary, partyFormationInvites] = await Promise.all(
      [
        getZNotificationPage({ data: { limit: 5, offset: 0 } }),
        currentUser.partyId && currentUser.active
          ? getPrimariesData()
          : Promise.resolve(null),
        getPartyFormationInvites().then((rows) =>
          rows.filter((row) => row.status === "pending"),
        ),
      ],
    );
    const primaryActions = primaryNextMoves(
      primary,
      currentUser,
      electionDashboard,
    );
    const config =
      officeVotingConfig[currentUser.role as keyof typeof officeVotingConfig];
    const [
      pendingBillVotes,
      pendingCommitteeAssessments,
      pendingBillGuidance,
      leaderActions,
    ] = await Promise.all([
      config && currentUser.active
        ? db
            .select({
              id: bills.id,
              title: bills.title,
              stageEndsAt: bills.stageEndsAt,
              enforcedPosition: sql<
                string | null
              >`(select position from bill_party_whips where bill_id = ${bills.id} and party_id = ${currentUser.partyId} and enforced_at is not null limit 1)`,
            })
            .from(bills)
            .where(
              and(
                eq(bills.status, "Voting"),
                eq(bills.stage, config.stage),
                gt(bills.stageEndsAt, new Date()),
                sql`not exists (select 1 from ${config.votes} where ${config.votes.billId} = ${bills.id} and ${config.votes.voterId} = ${currentUser.id})`,
              ),
            )
            .orderBy(bills.createdAt)
        : Promise.resolve([]),
      currentUser.role === "Senator" && currentUser.active
        ? db
            .select({
              id: bills.id,
              title: bills.title,
              stageEndsAt: bills.stageEndsAt,
            })
            .from(bills)
            .where(
              and(
                eq(bills.status, "Committee"),
                gt(bills.stageEndsAt, new Date()),
                sql`not exists (select 1 from ${committeeAssessments} where ${committeeAssessments.billId} = ${bills.id} and ${committeeAssessments.senatorId} = ${currentUser.id})`,
              ),
            )
            .orderBy(bills.createdAt)
        : Promise.resolve([]),
      getPendingBillGuidance(currentUser),
      getPartyLeaderActions(currentUser),
    ]);

    return {
      currentUser,
      pendingBillVotes: pendingBillVotes.map((bill) => ({
        ...bill,
        chamber: config?.chamber ?? "your chamber",
        route: config?.route ?? "/bills",
        stage: config?.stage ?? "House",
      })),
      pendingCommitteeAssessments,
      pendingBillGuidance,
      pendingPartyJoinRequests: leaderActions.membershipRequests,
      pendingCoalitionJoinRequests: leaderActions.coalitionJoinRequests,
      vacantPartyOffices: leaderActions.vacantOffices,
      partyFormationInvites,
      pendingCoalitionProposals: leaderActions.coalitionVotes,
      primaryActions,
      primaryRaces,
      zMentionSummary,
      activity,
      electionDashboard,
      nation,
      recentBills,
      recentElectionCandidateData,
      ...record,
    };
  });
