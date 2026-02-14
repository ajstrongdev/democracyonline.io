import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  bills,
  parties,
  transactionHistory,
  users,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";

// Types
export type HouseBill = {
  id: number;
  title: string;
  content: string;
  status: string;
  stage: string;
  creatorId: number | null;
  createdAt: Date | null;
  pool: number | null;
  creator: string | null;
};

export type HouseBillVotes = {
  for: number;
  against: number;
};

export type Representative = {
  id: number;
  username: string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
};

// Get bills currently in House voting stage
export const getHouseBills = createServerFn().handler(async () => {
  const houseBills = await db
    .select({
      id: bills.id,
      title: bills.title,
      content: bills.content,
      status: bills.status,
      stage: bills.stage,
      creatorId: bills.creatorId,
      createdAt: bills.createdAt,
      pool: bills.pool,
      creator: users.username,
    })
    .from(bills)
    .leftJoin(users, eq(users.id, bills.creatorId))
    .where(and(eq(bills.status, "Voting"), eq(bills.stage, "House")));

  return houseBills;
});

// Get vote counts for a specific bill in house
export const getHouseBillVotes = createServerFn()
  .inputValidator((data: { billId: number }) => data)
  .handler(async ({ data }) => {
    const votes = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE vote_yes = TRUE) as yes_count,
        COUNT(*) FILTER (WHERE vote_yes = FALSE) as no_count
      FROM bill_votes_house
      WHERE bill_id = ${data.billId}
    `);

    const row = votes.rows[0] as { yes_count: string; no_count: string };
    return {
      for: parseInt(row.yes_count, 10),
      against: parseInt(row.no_count, 10),
    };
  });

// Get list of active representatives
export const getRepresentatives = createServerFn().handler(async () => {
  const representatives = await db
    .select({
      id: users.id,
      username: users.username,
      partyId: users.partyId,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(users)
    .leftJoin(parties, eq(parties.id, users.partyId))
    .where(and(eq(users.role, "Representative"), eq(users.isActive, true)));

  return representatives;
});

// Check if user can vote on house bills (is a Representative)
// TODO: Refactor role check to middleware
export const canVoteOnHouseBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    return user?.role === "Representative";
  });

// Check if user has already voted on a specific bill
export const hasVotedOnHouseBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number; billId: number }) => data)
  .handler(async ({ data }) => {
    const existingVote = await db
      .select({ id: billVotesHouse.id })
      .from(billVotesHouse)
      .where(
        and(
          eq(billVotesHouse.voterId, data.userId),
          eq(billVotesHouse.billId, data.billId),
        ),
      )
      .limit(1);

    return existingVote.length > 0;
  });

// Vote on a house bill
// TODO: Refactor role check to middleware
export const voteOnHouseBill = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: { userId: number; billId: number; voteYes: boolean }) => data,
  )
  .handler(async ({ data }) => {
    // Check if user is a Representative
    const [user] = await db
      .select({ role: users.role, username: users.username })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (user?.role !== "Representative") {
      throw new Error(
        "You must be a Representative to vote on House of Representatives bills",
      );
    }

    // Check if bill exists and is in House voting stage
    const [bill] = await db
      .select({ id: bills.id, title: bills.title })
      .from(bills)
      .where(
        and(
          eq(bills.id, data.billId),
          eq(bills.status, "Voting"),
          eq(bills.stage, "House"),
        ),
      )
      .limit(1);

    if (!bill) {
      throw new Error(
        "Bill not found or not in House of Representatives voting stage",
      );
    }

    // Check if user has already voted
    const existingVote = await db
      .select({ id: billVotesHouse.id })
      .from(billVotesHouse)
      .where(
        and(
          eq(billVotesHouse.voterId, data.userId),
          eq(billVotesHouse.billId, data.billId),
        ),
      )
      .limit(1);

    if (existingVote.length > 0) {
      throw new Error("You have already voted on this bill");
    }

    // Insert the vote
    await db.insert(billVotesHouse).values({
      billId: data.billId,
      voterId: data.userId,
      voteYes: data.voteYes,
    });

    // Reward user with $500
    await db
      .update(users)
      .set({ money: sql`${users.money} + 500` })
      .where(eq(users.id, data.userId));

    // Add transaction history
    await db.insert(transactionHistory).values({
      userId: data.userId,
      description: `+$500 for voting ${data.voteYes ? "FOR" : "AGAINST"} Bill #${data.billId} in the House`,
    });

    // Add feed item
    await addFeedItem({
      data: {
        userId: data.userId,
        content: `Voted ${data.voteYes ? "FOR" : "AGAINST"} bill #${data.billId} in the House of Representatives.`,
      },
    });

    return { success: true };
  });

// Get all house bill data needed for the page (combined loader function)
export const houseBillsPageData = createServerFn()
  .middleware([authMiddleware])
  .handler(async () => {
    const houseBills = await getHouseBills();
    const representatives = await getRepresentatives();

    // Get votes for each bill
    const billsWithVotes = await Promise.all(
      houseBills.map(async (bill) => {
        const votes = await getHouseBillVotes({ data: { billId: bill.id } });
        return { ...bill, votes };
      }),
    );

    return {
      bills: billsWithVotes,
      representatives,
    };
  });
