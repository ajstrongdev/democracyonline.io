import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CandidateSchema,
  ElectionEnum,
  ElectionSchema,
  HasVotedOutSchema,
  IsCandidateSchema,
  SuccessSchema,
  VoteRemainingSchema,
} from "@/lib/trpc/types";
import { authedProcedure, publicProcedure, router } from "@/server/trpc";

const BANNED_USER_PREFIX = "Banned User%";

export const electionRouter = router({
  info: publicProcedure
    .input(z.object({ election: z.enum(["President", "Senate"]) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT * FROM elections WHERE election = $1",
        [input.election],
      );

      if (res.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      }

      return ElectionSchema.parse(res.rows[0]);
    }),

  getCandidates: publicProcedure
    .input(z.object({ election: z.enum(["President", "Senate"]) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        `
          SELECT 
            candidates.id,
            candidates.user_id,
            candidates.election,
            candidates.votes,
            users.username,
            parties.color
          FROM candidates
          JOIN users ON candidates.user_id = users.id
          LEFT JOIN parties ON users.party_id = parties.id
          WHERE candidates.election = $1 AND users.username NOT LIKE $2`,
        [input.election, BANNED_USER_PREFIX],
      );

      return z.array(CandidateSchema).parse(res.rows);
    }),

  stand: authedProcedure
    .input(z.object({ election: z.enum(["President", "Senate"]) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.query(
        "SELECT 1 FROM candidates WHERE user_id = $1",
        [ctx.dbUserId],
      );

      if (existing.rows.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already a candidate in another election",
        });
      }

      await ctx.query(
        "INSERT INTO candidates (user_id, election) VALUES ($1, $2)",
        [ctx.dbUserId, input.election],
      );

      const res = await ctx.query(
        `
          SELECT 
            candidates.id,
            candidates.user_id,
            candidates.election,
            candidates.votes,
            users.username,
            parties.color
          FROM candidates
          JOIN users ON candidates.user_id = users.id
          LEFT JOIN parties ON users.party_id = parties.id
          WHERE candidates.user_id = $1 AND candidates.election = $2`,
        [ctx.dbUserId, input.election],
      );

      return CandidateSchema.parse(res.rows[0]);
    }),

  withdraw: authedProcedure
    .input(z.object({ election: ElectionEnum }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        "DELETE FROM candidates WHERE user_id = $1 AND election = $2 RETURNING *",
        [ctx.dbUserId, input.election],
      );
      if (res.rowCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not a candidate" });
      }
      return SuccessSchema.parse({ success: true });
    }),

  hasVoted: publicProcedure
    .input(z.object({ userId: z.number(), election: ElectionEnum }))
    .query(async ({ input, ctx }) => {
      const electionRes = await ctx.query(
        "SELECT seats FROM elections WHERE election = $1",
        [input.election],
      );

      if (electionRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Election missing" });
      }

      const maxVotes = Number(electionRes.rows[0].seats);

      const voteCount = await ctx.query(
        "SELECT COUNT(*)::int as count FROM votes WHERE user_id = $1 AND election = $2",
        [input.userId, input.election],
      );

      const used = Number(voteCount.rows[0]?.count ?? 0);

      const votedFor = await ctx.query(
        "SELECT candidate_id FROM votes WHERE user_id = $1 AND election = $2",
        [input.userId, input.election],
      );

      const ids = votedFor.rows.map((r) => Number(r.candidate_id));

      return HasVotedOutSchema.parse({
        hasVoted: used > 0,
        votesUsed: used,
        maxVotes,
        votesRemaining: maxVotes - used,
        votedCandidateIds: ids,
      });
    }),

  vote: authedProcedure
    .input(z.object({ candidateId: z.number(), election: ElectionEnum }))
    .mutation(async ({ input, ctx }) => {
      const electionRes = await ctx.query(
        "SELECT seats FROM elections WHERE election = $1",
        [input.election],
      );

      if (electionRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Election missing" });
      }

      const maxVotes = Number(electionRes.rows[0].seats);

      const usedRes = await ctx.query(
        "SELECT COUNT(*)::int as count FROM votes WHERE user_id = $1 AND election = $2",
        [ctx.dbUserId, input.election],
      );

      const used = Number(usedRes.rows[0]?.count ?? 0);
      if (used >= maxVotes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Already cast all ${maxVotes} votes`,
        });
      }

      const dup = await ctx.query(
        "SELECT 1 FROM votes WHERE user_id = $1 AND election = $2 AND candidate_id = $3",
        [ctx.dbUserId, input.election, input.candidateId],
      );

      if (dup.rows.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already voted for this candidate",
        });
      }

      await ctx.query(
        "INSERT INTO votes (user_id, election, candidate_id) VALUES ($1, $2, $3)",
        [ctx.dbUserId, input.election, input.candidateId],
      );
      await ctx.query("UPDATE candidates SET votes = votes + 1 WHERE id = $1", [
        input.candidateId,
      ]);

      return VoteRemainingSchema.parse({
        votesRemaining: maxVotes - used - 1,
      });
    }),

  isCandidate: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT 1 FROM candidates WHERE user_id = $1",
        [input.userId],
      );

      return IsCandidateSchema.parse({
        isCandidate: res.rows.length > 0,
      });
    }),
});
