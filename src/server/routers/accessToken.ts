import 'server-only';

import { router, publicProcedure } from '@/server/trpc';
import { z } from 'zod';

export const accessTokenRouter = router({
  validate: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT id FROM access_tokens WHERE token = $1',
        [input.token],
      );
      if (res.rows.length === 0) return { valid: false, error: 'Invalid access token' };
      return { valid: true, tokenId: res.rows[0].id as number };
    }),

  consume: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query('DELETE FROM access_tokens WHERE token = $1 RETURNING id', [input.token]);
      if (res.rows.length === 0) {
        return { success: false, error: 'Token not found or already used' };
      }
      return { success: true };
    }),
});
