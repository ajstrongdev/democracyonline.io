import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  BillSchema,
  BillVoteCountsSchema,
  BillWithUsernameSchema,
  HasVotedSchema,
  StageEnum,
  UserVoteSchema,
  VoteCreateSchema,
  VoteTotalsSchema,
} from "@/lib/trpc/types";
import { authedProcedure, publicProcedure, router } from "@/server/trpc";

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
      `,
    );

    return z.array(BillWithUsernameSchema).parse(res.rows);
  }),

  getVoting: publicProcedure
    .input(z.object({ stage: StageEnum }))
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
        [input.stage],
      );

      return z.array(BillWithUsernameSchema).parse(res.rows);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query("SELECT * FROM bills WHERE id = $1", [
        input.id,
      ]);

      if (res.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      return BillSchema.parse(res.rows[0]);
    }),

  create: authedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        "INSERT INTO bills (title, content, creator_id) VALUES ($1, $2, $3) RETURNING *",
        [input.title, input.content, ctx.dbUserId],
      );

      return BillSchema.parse(res.rows[0]);
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
        "SELECT creator_id, status FROM bills WHERE id = $1",
        [input.id],
      );

      if (billRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const bill = billRes.rows[0];
      if (Number(bill.creator_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not bill owner" });
      }

      if (bill.status !== "Queued") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only 'Queued' bills can be edited",
        });
      }

      const res = await ctx.query(
        "UPDATE bills SET title = $1, content = $2 WHERE id = $3 RETURNING *",
        [input.title, input.content, input.id],
      );

      return BillSchema.parse(res.rows[0]);
    }),

  getVotes: publicProcedure
    .input(
      z.object({
        billId: z.number(),
        stage: StageEnum,
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

      return VoteTotalsSchema.parse(res.rows[0]);
    }),

  getVotesForBills: publicProcedure
    .input(
      z.object({
        stage: StageEnum,
        billIds: z.array(z.number()).min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `
          SELECT bill_id,
            COUNT(*) FILTER (WHERE vote_yes = true)::int AS for_count,
            COUNT(*) FILTER (WHERE vote_yes = false)::int AS against_count
          FROM ${table}
          WHERE bill_id = ANY($1::int[])
          GROUP BY bill_id
        `,
        [input.billIds],
      );

      return z.array(BillVoteCountsSchema).parse(res.rows);
    }),

  hasVotedForBills: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        stage: StageEnum,
        billIds: z.array(z.number()).min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const table = `bill_votes_${input.stage.toLowerCase()}`;
      const res = await ctx.query(
        `SELECT bill_id FROM ${table} WHERE voter_id = $1 AND bill_id = ANY($2::int[])`,
        [input.userId, input.billIds],
      );

      const rows = z.array(HasVotedSchema).parse(res.rows);
      const ids = new Set<number>(rows.map((r) => r.billId));

      const out: Record<number, boolean> = {};
      for (const id of input.billIds) out[id] = ids.has(id);

      return out;
    }),

  voteOnBill: authedProcedure
    .input(
      z.object({
        billId: z.number(),
        stage: StageEnum,
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
          code: "BAD_REQUEST",
          message: "Already voted on this bill",
        });
      }

      const res = await ctx.query(
        `INSERT INTO ${table} (voter_id, bill_id, vote_yes)
         VALUES ($1, $2, $3) RETURNING *`,
        [ctx.dbUserId, input.billId, input.vote],
      );

      return VoteCreateSchema.parse(res.rows[0]);
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

      const parseVotes = (rows: unknown[]) =>
        z.array(UserVoteSchema).parse(rows);

      return [
        ...parseVotes(houseRes.rows),
        ...parseVotes(senateRes.rows),
        ...parseVotes(presRes.rows),
      ];
    }),
});
