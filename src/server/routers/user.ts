import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminAuth } from '@/lib/firebase-admin';

export const userRouter = router({
  create: publicProcedure
    .input(
      z.object({
        email: z.email(),
        username: z.string().min(1),
        bio: z.string().min(1),
        leaning: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        `INSERT INTO users (email, username, bio, political_leaning)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.email, input.username, input.bio, input.leaning]
      );
      if (res.rows.length === 0) {
        throw new Error('Failed to create user');
      }
      return res.rows[0];
    }),

  getByEmail: publicProcedure
    .input(z.object({ email: z.email() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [input.email],
      );
      return res.rows[0] ?? null;
    }),

  getById: publicProcedure
    .input(z.object({ userId: z.number(), omitEmail: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query('SELECT * FROM users WHERE id = $1', [
        input.userId,
      ]);
      if (res.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      const user = res.rows[0];

      try {
        const firebaseUser = await adminAuth.getUserByEmail(user.email);
        if (firebaseUser.disabled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Disabled user' });
        }
      } catch (e) {
        if (e instanceof TRPCError) throw e;
      }

      if (input.omitEmail) user.email = null;
      return user;
    }),

  getByRoleWithParty: publicProcedure
    .input(z.object({ role: z.enum(['Representative', 'Senator', 'President']) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        `
        SELECT 
          u.id, u.username, u.bio, u.political_leaning, u.role, u.party_id, u.created_at,
          p.name AS party_name,
          p.color AS party_color
        FROM users u
        LEFT JOIN parties p ON p.id = u.party_id
        WHERE u.role = $1
          AND u.username NOT LIKE 'Banned User%'
        ORDER BY u.created_at DESC
        `,
        [input.role],
      );
      return res.rows.map((r: any) => ({
        ...r,
        partyName: r.party_name ?? 'Independent',
        partyColor: r.party_color ?? null,
      }));
    }),

  updateProfile: authedProcedure
    .input(
      z.object({
        userId: z.number(),
        username: z.string().min(1),
        bio: z.string().min(1),
        political_leaning: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.dbUserId !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your profile' });
      }
      const res = await ctx.query(
        'UPDATE users SET username = $1, bio = $2, political_leaning = $3 WHERE id = $4 RETURNING *',
        [input.username, input.bio, input.political_leaning, input.userId],
      );
      if (res.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      return res.rows[0];
    }),

  canVote: authedProcedure
    .input(
      z.object({
        role: z.enum(['Representative', 'Senator', 'President']),
      }),
    )
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT 1 FROM users WHERE id = $1 AND role = $2',
        [ctx.dbUserId, input.role],
      );
      return { canVote: res.rows.length > 0 };
    }),

  hasVotedOnBill: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        billId: z.number(),
        stage: z.enum(['House', 'Senate', 'Presidential']),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `SELECT 1 FROM ${table} WHERE voter_id = $1 AND bill_id = $2`,
        [input.userId, input.billId],
      );
      return { hasVoted: res.rows.length > 0 };
    }),

  checkUserDisabled: publicProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      // use firebase-admin directly
      const rec = await adminAuth.getUser(input.uid);
      return {
        disabled: rec.disabled,
        email: rec.email ?? undefined,
        emailVerified: rec.emailVerified,
      };
    }),
});
