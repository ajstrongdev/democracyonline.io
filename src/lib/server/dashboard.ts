import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  committeeAssessments,
  electionCandidateHistory,
  feed,
  nations,
  parties,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { getCurrentElectionDashboard } from "@/lib/server/elections";
import { userEmailEquals } from "@/lib/server/user-email";
import { getWikiHome } from "@/lib/server/history";

const officeVotingConfig = {
  Representative: {
    stage: "House",
    chamber: "House of Representatives",
    route: "/dashboard/bills",
    votes: billVotesHouse,
  },
  Senator: {
    stage: "Senate",
    chamber: "Senate",
    route: "/dashboard/bills",
    votes: billVotesSenate,
  },
  President: {
    stage: "Presidential",
    chamber: "Oval Office",
    route: "/dashboard/bills",
    votes: billVotesPresidential,
  },
} as const;

export const getDashboardData = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [record, activity, electionDashboard, nation] = await Promise.all([
      getWikiHome(),
      db
        .select({
          id: feed.id,
          userId: feed.userId,
          username: users.username,
          content: feed.content,
          createdAt: feed.createdAt,
        })
        .from(feed)
        .leftJoin(users, eq(feed.userId, users.id))
        .orderBy(desc(feed.createdAt))
        .limit(6),
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
        activity,
        electionDashboard,
        nation,
        recentElectionCandidateData,
        ...record,
      };
    }

    const [currentUser] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        politicalLeaning: users.politicalLeaning,
        active: users.isActive,
        partyId: parties.id,
        partyName: parties.name,
        partyColor: parties.color,
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
        activity,
        electionDashboard,
        nation,
        recentElectionCandidateData,
        ...record,
      };
    }

    const config =
      officeVotingConfig[currentUser.role as keyof typeof officeVotingConfig];
    const [pendingBillVotes, pendingCommitteeAssessments] = await Promise.all([
      config
        ? db
            .select({ id: bills.id, title: bills.title })
            .from(bills)
            .where(
              and(
                eq(bills.status, "Voting"),
                eq(bills.stage, config.stage),
                sql`not exists (select 1 from ${config.votes} where ${config.votes.billId} = ${bills.id} and ${config.votes.voterId} = ${currentUser.id})`,
              ),
            )
            .orderBy(bills.createdAt)
        : Promise.resolve([]),
      currentUser.role === "Senator" && currentUser.active
        ? db
            .select({ id: bills.id, title: bills.title })
            .from(bills)
            .where(
              and(
                eq(bills.status, "Committee"),
                sql`not exists (select 1 from ${committeeAssessments} where ${committeeAssessments.billId} = ${bills.id} and ${committeeAssessments.senatorId} = ${currentUser.id})`,
              ),
            )
            .orderBy(bills.createdAt)
        : Promise.resolve([]),
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
      activity,
      electionDashboard,
      nation,
      recentElectionCandidateData,
      ...record,
    };
  });
