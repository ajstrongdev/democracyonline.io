import "server-only";

import { z } from "zod";
import { FeedSchema, FeedWithUsernameSchema } from "@/lib/trpc/types";
import { authedProcedure, publicProcedure, router } from "@/server/trpc";

const FEED_POST_LIMIT = 50;

export const feedRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      `
        SELECT
          f.id,
          f.user_id,
          f.content,
          f.created_at,
          u.username
        FROM feed f
        LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC
        LIMIT $1
      `,
      [FEED_POST_LIMIT],
    );

    return z.array(FeedWithUsernameSchema).parse(res.rows);
  }),

  add: authedProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        "INSERT INTO feed (user_id, content) VALUES ($1, $2) RETURNING *",
        [ctx.dbUserId, input.content],
      );

      return FeedSchema.parse(res.rows[0]);
    }),
});
