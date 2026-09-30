import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Transaction } from "@/lib/server/organizations/organization-lifecycle";
import { db } from "@/db";
import {
  billVoteIndications,
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  feed,
  users,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { canIndicateVote } from "@/lib/bills/vote-rules";

const stages = ["House", "Senate", "Presidential"] as const;
const roles = {
  House: "Representative",
  Senate: "Senator",
  Presidential: "President",
} as const;

export const getMyVoteIndications = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) return [];
    const [player] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    return player
      ? db
          .select({
            stage: billVoteIndications.stage,
            voteYes: billVoteIndications.voteYes,
          })
          .from(billVoteIndications)
          .where(
            and(
              eq(billVoteIndications.billId, data.billId),
              eq(billVoteIndications.userId, player.id),
            ),
          )
      : [];
  });

export const indicateBillVote = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      billId: z.number().int().positive(),
      stage: z.enum(stages),
      voteYes: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(24092026)`);
      const [player] = await tx
        .select({ id: users.id, role: users.role, active: users.isActive })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      if (!player?.active || player.role !== roles[data.stage])
        throw new Error(
          "Only the active officeholder for this chamber can indicate a vote",
        );
      const [bill] = await tx
        .select({ status: bills.status, stage: bills.stage })
        .from(bills)
        .where(eq(bills.id, data.billId))
        .limit(1);
      if (!bill || !canIndicateVote(bill.status, bill.stage, data.stage))
        throw new Error(
          "You can only indicate a vote before this bill enters your chamber",
        );
      await tx
        .insert(billVoteIndications)
        .values({
          billId: data.billId,
          userId: player.id,
          stage: data.stage,
          voteYes: data.voteYes,
        })
        .onConflictDoUpdate({
          target: [
            billVoteIndications.billId,
            billVoteIndications.userId,
            billVoteIndications.stage,
          ],
          set: { voteYes: data.voteYes },
        });
      return true;
    });
  });

export async function recordIndicatedVotes(
  tx: Transaction,
  billId: number,
  stage: (typeof stages)[number],
) {
  const table =
    stage === "House"
      ? billVotesHouse
      : stage === "Senate"
        ? billVotesSenate
        : billVotesPresidential;
  const indications = await tx
    .select({
      userId: billVoteIndications.userId,
      voteYes: billVoteIndications.voteYes,
    })
    .from(billVoteIndications)
    .innerJoin(users, eq(users.id, billVoteIndications.userId))
    .where(
      and(
        eq(billVoteIndications.billId, billId),
        eq(billVoteIndications.stage, stage),
        eq(users.role, roles[stage]),
        eq(users.isActive, true),
      ),
    );
  for (const indication of indications) {
    const [recorded] = await tx
      .insert(table)
      .values({
        billId,
        voterId: indication.userId,
        voteYes: indication.voteYes,
      })
      .onConflictDoNothing()
      .returning({ id: table.id });
    if (recorded)
      await tx
        .insert(feed)
        .values({
          userId: indication.userId,
          content: `Voted on bill #${billId} in the ${stage} stage from an advance indication.`,
        });
  }
}
