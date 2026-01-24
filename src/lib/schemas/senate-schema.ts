import { z } from "zod";

// Schema for voting on a senate bill
export const VoteOnSenateBillSchema = z.object({
  userId: z.number(),
  billId: z.number(),
  voteYes: z.boolean(),
});

// Schema for voting in an election
export const ElectionVoteSchema = z.object({
  userId: z.number(),
  candidateId: z.number(),
  election: z.enum(["Senate", "President"]),
});

// Schema for declaring/revoking candidacy
export const CandidacySchema = z.object({
  userId: z.number(),
  election: z.enum(["Senate", "President"]),
});

// Types derived from schemas
export type VoteOnSenateBill = z.infer<typeof VoteOnSenateBillSchema>;
export type ElectionVote = z.infer<typeof ElectionVoteSchema>;
export type Candidacy = z.infer<typeof CandidacySchema>;
