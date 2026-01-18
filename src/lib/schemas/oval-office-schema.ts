import { z } from "zod";

// Schema for voting (signing/vetoing) on a presidential bill
export const VoteOnPresidentialBillSchema = z.object({
  userId: z.number(),
  billId: z.number(),
  voteYes: z.boolean(), // true = sign, false = veto
});

// Schema for checking if user can vote on presidential bills
export const CanVoteOnPresidentialBillSchema = z.object({
  userId: z.number(),
});

// Schema for checking if user has voted on a presidential bill
export const HasVotedOnPresidentialBillSchema = z.object({
  userId: z.number(),
  billId: z.number(),
});

// Schema for getting presidential bill votes
export const GetPresidentialBillVotesSchema = z.object({
  billId: z.number(),
});

// Types derived from schemas
export type VoteOnPresidentialBill = z.infer<
  typeof VoteOnPresidentialBillSchema
>;
export type CanVoteOnPresidentialBill = z.infer<
  typeof CanVoteOnPresidentialBillSchema
>;
export type HasVotedOnPresidentialBill = z.infer<
  typeof HasVotedOnPresidentialBillSchema
>;
export type GetPresidentialBillVotes = z.infer<
  typeof GetPresidentialBillVotesSchema
>;
