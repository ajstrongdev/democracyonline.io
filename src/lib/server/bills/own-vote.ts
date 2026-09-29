import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  users,
} from "@/db/schema";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { authMiddleware } from "@/middleware";

export const getOwnBillVote = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) return null;
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email));
    const [bill] = await db
      .select({ stage: bills.stage, status: bills.status })
      .from(bills)
      .where(eq(bills.id, data.billId));
    if (!actor || !bill || bill.status !== "Voting") return null;
    const table =
      bill.stage === "House"
        ? billVotesHouse
        : bill.stage === "Senate"
          ? billVotesSenate
          : billVotesPresidential;
    const [vote] = await db
      .select({ voteYes: table.voteYes })
      .from(table)
      .where(and(eq(table.billId, data.billId), eq(table.voterId, actor.id)));
    return vote?.voteYes ?? null;
  });
