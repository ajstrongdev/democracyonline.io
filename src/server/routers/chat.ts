import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const chatRouter = router({
  listByRoom: publicProcedure
    .input(z.object({ room: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT * FROM chats WHERE room = $1 ORDER BY created_at DESC LIMIT 50',
        [input.room],
      );
      return res.rows;
    }),
  add: authedProcedure
    .input(
      z.object({
        room: z.string().min(1),
        username: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        'INSERT INTO chats (user_id, room, username, message) VALUES ($1, $2, $3, $4) RETURNING *',
        [ctx.dbUserId, input.room, input.username, input.message],
      );
      return res.rows[0];
    }),
});
