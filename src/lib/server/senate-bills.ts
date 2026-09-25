import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { billVotesSenate, bills, parties, users } from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";
import { userEmailEquals } from "@/lib/server/user-email";

// Types
export type SenateBill = {
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

export type SenateBillVotes = {
  for: number;
  against: number;
};

export type Senator = {
  id: number;
  username: string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
};

// Get bills currently in Senate voting stage
export const getSenateBills = createServerFn().handler(async () => {
  const senateBills = await db
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
    .where(and(eq(bills.status, "Voting"), eq(bills.stage, "Senate")));

  return senateBills;
});

// Get vote counts for a specific bill in senate
export const getSenateBillVotes = createServerFn()
  .inputValidator((data: { billId: number }) => data)
  .handler(async ({ data }) => {
    const votes = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE vote_yes = TRUE) as yes_count,
        COUNT(*) FILTER (WHERE vote_yes = FALSE) as no_count
      FROM bill_votes_senate
      WHERE bill_id = ${data.billId}
    `);

    const row = votes.rows[0] as { yes_count: string; no_count: string };
    return {
      for: parseInt(row.yes_count, 10),
      against: parseInt(row.no_count, 10),
    };
  });

// Get list of senators
export const getSenators = createServerFn().handler(async () => {
  const senators = await db
    .select({
      id: users.id,
      username: users.username,
      photoUrl: users.photoUrl,
      partyId: users.partyId,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(users)
    .leftJoin(parties, eq(parties.id, users.partyId))
    .where(eq(users.role, "Senator"));

  return senators;
});

// Check if user can vote on senate bills (is a Senator)
// TODO: Refactor role check to middleware
export const canVoteOnSenateBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    return user?.role === "Senator";
  });

// Check if user has already voted on a specific bill
export const hasVotedOnSenateBill = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { userId: number; billId: number }) => data)
  .handler(async ({ data }) => {
    const existingVote = await db
      .select({ id: billVotesSenate.id })
      .from(billVotesSenate)
      .where(
        and(
          eq(billVotesSenate.voterId, data.userId),
          eq(billVotesSenate.billId, data.billId),
        ),
      )
      .limit(1);

    return existingVote.length > 0;
  });

// Vote on a senate bill
// TODO: Refactor role check to middleware
export const voteOnSenateBill = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: { userId: number; billId: number; voteYes: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    const email = context.user?.email;
    if (!email) throw new Error("Authentication required");
    // Check if user is a Senator
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        username: users.username,
        isActive: users.isActive,
      })
      .from(users)
      .where(userEmailEquals(email))
      .limit(1);

    if (user?.role !== "Senator" || !user.isActive) {
      throw new Error("You must be a Senator to vote on senate bills");
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(24092026)`);
      const [bill] = await tx
        .select({ id: bills.id })
        .from(bills)
        .where(
          and(
            eq(bills.id, data.billId),
            eq(bills.status, "Voting"),
            eq(bills.stage, "Senate"),
          ),
        )
        .limit(1);
      if (!bill)
        throw new Error("Bill not found or not in Senate voting stage");

      const [existingVote] = await tx
        .select({ id: billVotesSenate.id })
        .from(billVotesSenate)
        .where(
          and(
            eq(billVotesSenate.voterId, user.id),
            eq(billVotesSenate.billId, data.billId),
          ),
        )
        .limit(1);
      if (existingVote) throw new Error("You have already voted on this bill");

      await tx.insert(billVotesSenate).values({
        billId: data.billId,
        voterId: user.id,
        voteYes: data.voteYes,
      });
    });

    // Add feed item
    await addFeedItem({
      data: {
        userId: user.id,
        content: `Voted ${data.voteYes ? "FOR" : "AGAINST"} bill #${data.billId} in the Senate.`,
      },
    });

    return { success: true };
  });

// Get all senate bill data needed for the page (combined loader function)
export const senateBillsPageData = createServerFn()
  .middleware([authMiddleware])
  .handler(async () => {
    const senateBills = await getSenateBills();
    const senators = await getSenators();

    // Get votes for each bill
    const billsWithVotes = await Promise.all(
      senateBills.map(async (bill) => {
        const votes = await getSenateBillVotes({ data: { billId: bill.id } });
        return { ...bill, votes };
      }),
    );

    return {
      bills: billsWithVotes,
      senators,
    };
  });
