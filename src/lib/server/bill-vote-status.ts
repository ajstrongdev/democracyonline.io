import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billVotesHouse, billVotesPresidential, billVotesSenate, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/user-email";

export const getMyBillVoteIds = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) return [];
    const [user] = await db.select({ id: users.id, role: users.role })
      .from(users).where(userEmailEquals(context.user.email)).limit(1);
    if (!user) return [];
    const table = user.role === "Representative" ? billVotesHouse
      : user.role === "Senator" ? billVotesSenate
        : user.role === "President" ? billVotesPresidential : null;
    if (!table) return [];
    const votes = await db.select({ billId: table.billId }).from(table).where(eq(table.voterId, user.id));
    return votes.map((vote) => vote.billId);
  });
