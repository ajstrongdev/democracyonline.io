import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  billVotesPresidential,
  users,
  parties,
  transactionHistory,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";

// Types
export type PresidentialBill = {
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

export type PresidentialBillVotes = {
  signed: number;
  vetoed: number;
};

export type President = {
  id: number;
  username: string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
};

// Get bills currently in Presidential voting stage
export const getPresidentialBills = createServerFn().handler(async () => {
  const presidentialBills = await db
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
    .where(and(eq(bills.status, "Voting"), eq(bills.stage, "Presidential")));

  return presidentialBills;
});

// Get vote counts for a specific bill in presidential stage (signed/vetoed)
export const getPresidentialBillVotes = createServerFn()
  .inputValidator((data: { billId: number }) => data)
  .handler(async ({ data }) => {
    const votes = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE vote_yes = TRUE) as signed_count,
        COUNT(*) FILTER (WHERE vote_yes = FALSE) as vetoed_count
      FROM bill_votes_presidential
      WHERE bill_id = ${data.billId}
    `);

    const row = votes.rows[0] as { signed_count: string; vetoed_count: string };
    return {
      signed: parseInt(row.signed_count, 10),
      vetoed: parseInt(row.vetoed_count, 10),
    };
  });

// Get list of presidents
export const getPresidents = createServerFn().handler(async () => {
  const presidents = await db
    .select({
      id: users.id,
      username: users.username,
      partyId: users.partyId,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(users)
    .leftJoin(parties, eq(parties.id, users.partyId))
    .where(eq(users.role, "President"));

  return presidents;
});

// Check if user can vote on presidential bills (is a President)
export const canVoteOnPresidentialBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    return user?.role === "President";
  });

// Check if user has already voted (signed/vetoed) on a specific bill
export const hasVotedOnPresidentialBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number; billId: number }) => data)
  .handler(async ({ data }) => {
    const existingVote = await db
      .select({ id: billVotesPresidential.id })
      .from(billVotesPresidential)
      .where(
        and(
          eq(billVotesPresidential.voterId, data.userId),
          eq(billVotesPresidential.billId, data.billId),
        ),
      )
      .limit(1);

    return existingVote.length > 0;
  });

// Sign or veto a presidential bill
export const voteOnPresidentialBill = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: { userId: number; billId: number; voteYes: boolean }) => data,
  )
  .handler(async ({ data }) => {
    // Check if user is a President
    const [user] = await db
      .select({ role: users.role, username: users.username })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (user?.role !== "President") {
      throw new Error("You must be the President to sign or veto bills");
    }

    // Check if bill exists and is in Presidential voting stage
    const [bill] = await db
      .select({ id: bills.id, title: bills.title })
      .from(bills)
      .where(
        and(
          eq(bills.id, data.billId),
          eq(bills.status, "Voting"),
          eq(bills.stage, "Presidential"),
        ),
      )
      .limit(1);

    if (!bill) {
      throw new Error("Bill not found or not in Presidential voting stage");
    }

    // Check if user has already voted
    const existingVote = await db
      .select({ id: billVotesPresidential.id })
      .from(billVotesPresidential)
      .where(
        and(
          eq(billVotesPresidential.voterId, data.userId),
          eq(billVotesPresidential.billId, data.billId),
        ),
      )
      .limit(1);

    if (existingVote.length > 0) {
      throw new Error("You have already signed or vetoed this bill");
    }

    // Insert the vote (sign = true, veto = false)
    await db.insert(billVotesPresidential).values({
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
      description: `+$500 for ${data.voteYes ? "signing" : "vetoing"} Bill #${data.billId}`,
    });

    // Add feed item
    await addFeedItem({
      data: {
        userId: data.userId,
        content: `${data.voteYes ? "Signed" : "Vetoed"} bill #${data.billId}: ${bill.title}.`,
      },
    });

    return { success: true };
  });

// Get all presidential bill data needed for the page (combined loader function)
export const presidentialBillsPageData = createServerFn()
  .middleware([authMiddleware])
  .handler(async () => {
    const presidentialBills = await getPresidentialBills();
    const presidents = await getPresidents();

    // Get votes for each bill
    const billsWithVotes = await Promise.all(
      presidentialBills.map(async (bill) => {
        const votes = await getPresidentialBillVotes({
          data: { billId: bill.id },
        });
        return { ...bill, votes };
      }),
    );

    return {
      bills: billsWithVotes,
      presidents,
    };
  });
