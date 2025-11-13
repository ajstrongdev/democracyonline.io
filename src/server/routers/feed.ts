import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';

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
      LIMIT 50
      `
    );
    // Guarantee a username field (even if null/unknown)
    return res.rows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.username ?? 'Unknown User',
      content: row.content,
      created_at: row.created_at,
    }));
  }),

  add: authedProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        'INSERT INTO feed (user_id, content) VALUES ($1, $2) RETURNING *',
        [ctx.dbUserId, input.content]
      );

      return res.rows[0];
    }),
});
