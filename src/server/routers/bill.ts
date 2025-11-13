import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const billRouter = router({
  listAll: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      `
    SELECT
      b.*,
      u.username
    FROM bills b
    LEFT JOIN users u ON u.id = b.creator_id
    ORDER BY b.created_at DESC
    `
    );
    return res.rows;
  }),

  getVoting: publicProcedure
    .input(z.object({ stage: z.enum(['House', 'Senate', 'Presidential']) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        `
      SELECT
        b.*,
        u.username
      FROM bills b
      LEFT JOIN users u ON u.id = b.creator_id
      WHERE b.status = 'Voting' AND b.stage = $1
      ORDER BY b.created_at DESC
      `,
        [input.stage]
      );
      return res.rows;
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query('SELECT * FROM bills WHERE id = $1', [
        input.id,
      ]);
      if (res.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      }
      return res.rows[0];
    }),

  create: authedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        'INSERT INTO bills (title, content, creator_id) VALUES ($1, $2, $3) RETURNING *',
        [input.title, input.content, ctx.dbUserId],
      );
      return res.rows[0];
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const billRes = await ctx.query(
        'SELECT creator_id, status FROM bills WHERE id = $1',
        [input.id],
      );
      if (billRes.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      }
      const bill = billRes.rows[0];
      if (Number(bill.creator_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not bill owner' });
      }
      if (bill.status !== 'Queued') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "Only 'Queued' bills can be edited",
        });
      }
      const res = await ctx.query(
        'UPDATE bills SET title = $1, content = $2 WHERE id = $3 RETURNING *',
        [input.title, input.content, input.id],
      );
      return res.rows[0];
    }),

  getVotes: publicProcedure
    .input(
      z.object({
        billId: z.number(),
        stage: z.enum(['House', 'Senate', 'Presidential']),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `SELECT 
          COUNT(*) FILTER (WHERE vote_yes = true) AS for_count,
          COUNT(*) FILTER (WHERE vote_yes = false) AS against_count
        FROM ${table} WHERE bill_id = $1`,
        [input.billId],
      );
      return {
        for: parseInt(res.rows[0]?.for_count ?? 0, 10),
        against: parseInt(res.rows[0]?.against_count ?? 0, 10),
      };
    }),

  // Batch: get votes for many bills at once -> map of billId -> { for, against }
  getVotesForBills: publicProcedure
    .input(
      z.object({
        stage: z.enum(['House', 'Senate', 'Presidential']),
        billIds: z.array(z.number()).min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `SELECT bill_id,
            COUNT(*) FILTER (WHERE vote_yes = true) AS for_count,
            COUNT(*) FILTER (WHERE vote_yes = false) AS against_count
         FROM ${table}
         WHERE bill_id = ANY($1::int[])
         GROUP BY bill_id`,
        [input.billIds],
      );
      const map: Record<number, { for: number; against: number }> = {};
      for (const row of res.rows) {
        map[row.bill_id] = {
          for: parseInt(row.for_count ?? 0, 10),
          against: parseInt(row.against_count ?? 0, 10),
        };
      }
      return map;
    }),

  // Batch: map of billId -> boolean
  hasVotedForBills: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        stage: z.enum(['House', 'Senate', 'Presidential']),
        billIds: z.array(z.number()).min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `SELECT bill_id FROM ${table} WHERE voter_id = $1 AND bill_id = ANY($2::int[])`,
        [input.userId, input.billIds],
      );
      const set = new Set<number>(res.rows.map((r: any) => Number(r.bill_id)));
      const map: Record<number, boolean> = {};
      for (const id of input.billIds) map[id] = set.has(id);
      return map;
    }),

  voteOnBill: authedProcedure
    .input(
      z.object({
        billId: z.number(),
        stage: z.enum(['House', 'Senate', 'Presidential']),
        vote: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const existing = await ctx.query(
        `SELECT 1 FROM ${table} WHERE voter_id = $1 AND bill_id = $2`,
        [ctx.dbUserId, input.billId],
      );
      if (existing.rows.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already voted on this bill',
        });
      }
      const res = await ctx.query(
        `INSERT INTO ${table} (voter_id, bill_id, vote_yes)
         VALUES ($1, $2, $3) RETURNING *`,
        [ctx.dbUserId, input.billId, input.vote],
      );
      return res.rows[0];
    }),

  getUserVotes: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const houseRes = await ctx.query(
        `SELECT bvh.*, b.title, b.stage, b.status
         FROM bill_votes_house bvh
         JOIN bills b ON bvh.bill_id = b.id
         WHERE bvh.voter_id = $1`,
        [input.userId],
      );
      const senateRes = await ctx.query(
        `SELECT bvs.*, b.title, b.stage, b.status
         FROM bill_votes_senate bvs
         JOIN bills b ON bvs.bill_id = b.id
         WHERE bvs.voter_id = $1`,
        [input.userId],
      );
      const presRes = await ctx.query(
        `SELECT bvp.*, b.title, b.stage, b.status
         FROM bill_votes_presidential bvp
         JOIN bills b ON bvp.bill_id = b.id
         WHERE bvp.voter_id = $1`,
        [input.userId],
      );
      return [...houseRes.rows, ...senateRes.rows, ...presRes.rows];
    }),
});
