import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const electionRouter = router({
  info: publicProcedure
    .input(z.object({ election: z.enum(['President', 'Senate']) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT * FROM elections WHERE election = $1',
        [input.election],
      );
      if (res.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
      }
      return res.rows[0];
    }),

  getCandidates: publicProcedure
    .input(z.object({ election: z.enum(['President', 'Senate']) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        `SELECT 
          candidates.*,
          users.username,
          parties.color
         FROM candidates
         JOIN users ON candidates.user_id = users.id
         LEFT JOIN parties ON users.party_id = parties.id
         WHERE candidates.election = $1 AND users.username NOT LIKE 'Banned User%'`,
        [input.election],
      );
      return res.rows;
    }),

  stand: authedProcedure
    .input(z.object({ election: z.enum(['President', 'Senate']) }))
    .mutation(async ({ input, ctx }) => {
      // Disallow standing in more than one election
      const existing = await ctx.query(
        'SELECT 1 FROM candidates WHERE user_id = $1',
        [ctx.dbUserId],
      );
      if (existing.rows.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already a candidate in another election',
        });
      }
      const res = await ctx.query(
        'INSERT INTO candidates (user_id, election) VALUES ($1, $2) RETURNING *',
        [ctx.dbUserId, input.election],
      );
      return res.rows[0];
    }),

  withdraw: authedProcedure
    .input(z.object({ election: z.enum(['President', 'Senate']) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        'DELETE FROM candidates WHERE user_id = $1 AND election = $2 RETURNING *',
        [ctx.dbUserId, input.election],
      );
      if (res.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not a candidate' });
      }
      return { success: true };
    }),

  hasVoted: publicProcedure
    .input(z.object({ userId: z.number(), election: z.enum(['President', 'Senate']) }))
    .query(async ({ input, ctx }) => {
      const electionRes = await ctx.query(
        'SELECT seats FROM elections WHERE election = $1',
        [input.election],
      );
      if (electionRes.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Election missing' });
      }
      const maxVotes = electionRes.rows[0].seats;
      const voteCount = await ctx.query(
        'SELECT COUNT(*) as count FROM votes WHERE user_id = $1 AND election = $2',
        [input.userId, input.election],
      );
      const votedFor = await ctx.query(
        'SELECT candidate_id FROM votes WHERE user_id = $1 AND election = $2',
        [input.userId, input.election],
      );
      const used = Number(voteCount.rows[0]?.count ?? 0);
      return {
        hasVoted: used > 0,
        votesUsed: used,
        maxVotes,
        votesRemaining: maxVotes - used,
        votedCandidateIds: votedFor.rows.map((r: any) => r.candidate_id),
      };
    }),

  vote: authedProcedure
    .input(z.object({ candidateId: z.number(), election: z.enum(['President', 'Senate']) }))
    .mutation(async ({ input, ctx }) => {
      const electionRes = await ctx.query(
        'SELECT seats FROM elections WHERE election = $1',
        [input.election],
      );
      if (electionRes.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Election missing' });
      }
      const maxVotes = electionRes.rows[0].seats;

      const usedRes = await ctx.query(
        'SELECT COUNT(*) as count FROM votes WHERE user_id = $1 AND election = $2',
        [ctx.dbUserId, input.election],
      );
      const used = Number(usedRes.rows[0]?.count ?? 0);
      if (used >= maxVotes) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Already cast all ${maxVotes} votes`,
        });
      }

      const dup = await ctx.query(
        'SELECT 1 FROM votes WHERE user_id = $1 AND election = $2 AND candidate_id = $3',
        [ctx.dbUserId, input.election, input.candidateId],
      );
      if (dup.rows.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already voted for this candidate',
        });
      }

      await ctx.query(
        'INSERT INTO votes (user_id, election, candidate_id) VALUES ($1, $2, $3)',
        [ctx.dbUserId, input.election, input.candidateId],
      );
      await ctx.query('UPDATE candidates SET votes = votes + 1 WHERE id = $1', [
        input.candidateId,
      ]);
      return { votesRemaining: maxVotes - used - 1 };
    }),

  isCandidate: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        'SELECT 1 FROM candidates WHERE user_id = $1',
        [input.userId],
      );
      return { isCandidate: res.rows.length > 0 };
    }),
});
