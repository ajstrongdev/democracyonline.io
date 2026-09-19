import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  candidates,
  elections,
  feed,
  parties,
  users,
  votes,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
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
    const [record, activity, electionRows] = await Promise.all([
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
      db
        .select()
        .from(elections)
        .where(inArray(elections.election, ["President", "Senate"])),
    ]);

    if (!context.user?.email) {
      return {
        currentUser: null,
        pendingBillVotes: [],
        pendingElectionBallots: [],
        activity,
        electionRows,
        ...record,
      };
    }

    const [currentUser] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        politicalLeaning: users.politicalLeaning,
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
        pendingElectionBallots: [],
        activity,
        electionRows,
        ...record,
      };
    }

    const config =
      officeVotingConfig[currentUser.role as keyof typeof officeVotingConfig];
    const [pendingBillVotes, ballotRows, candidateCounts] = await Promise.all([
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
      db
        .select({ voteType: votes.voteType })
        .from(votes)
        .where(eq(votes.userId, currentUser.id))
        .groupBy(votes.voteType),
      db
        .select({
          election: candidates.election,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .where(inArray(candidates.election, ["President", "Senate"]))
        .groupBy(candidates.election),
    ]);

    const votedIn = new Set(ballotRows.map((row) => row.voteType));
    const countsByElection = new Map(
      candidateCounts.map((row) => [row.election, row.count]),
    );
    const pendingElectionBallots = electionRows
      .filter(
        (election) =>
          election.status === "Voting" &&
          !votedIn.has(election.election) &&
          (countsByElection.get(election.election) ?? 0) > 0,
      )
      .map((election) => ({
        election: election.election,
        daysLeft: election.daysLeft,
        candidateCount: countsByElection.get(election.election) ?? 0,
      }));

    return {
      currentUser,
      pendingBillVotes: pendingBillVotes.map((bill) => ({
        ...bill,
        chamber: config?.chamber ?? "your chamber",
        route: config?.route ?? "/bills",
        stage: config?.stage ?? "House",
      })),
      pendingElectionBallots,
      activity,
      electionRows,
      ...record,
    };
  });
