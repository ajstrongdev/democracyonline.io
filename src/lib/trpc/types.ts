import { z } from "zod";
import { camelCaseSchemaDef } from "./utils";

// ============ ENUMS ============
export const StageEnum = z.enum(["House", "Senate", "Presidential"]);
export type Stage = z.infer<typeof StageEnum>;

export const RoleEnum = z.enum(["Representative", "Senator", "President"]);
export type Role = z.infer<typeof RoleEnum>;

export const ElectionEnum = z.enum(["President", "Senate"]);
export type Election = z.infer<typeof ElectionEnum>;

// Database row schemata

const _BillSchema = z.object({
  id: z.number(),
  status: z.string(),
  stage: StageEnum,
  title: z.string(),
  creatorId: z.number().nullable().optional(),
  content: z.string(),
  createdAt: z.date().optional(),
  username: z.string().nullable().optional(),
});

const _BillWithUsernameSchema = _BillSchema
  .extend({
    username: z.string().nullable().optional(),
  })
  .transform((row) => ({
    ...row,
    id: row.id,
    creatorId: row.creatorId ? row.creatorId : null,
  }));

const _UserSchema = z.object({
  id: z.number(),
  email: z.email().nullable().optional(),
  username: z.string(),
  bio: z.string(),
  politicalLeaning: z.string(),
  role: z.string().nullable().optional(),
  partyId: z.number().nullable().optional(),
  createdAt: z.date().optional(),
});

const _UserWithPartyDbSchema = _UserSchema.extend({
  partyName: z.string().nullable().optional(),
  partyColor: z.string().nullable().optional(),
});

const _PartySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  leaning: z.string().nullable().optional(),
  politicalLeaning: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  manifestoUrl: z.string().nullable().optional(),
  discord: z.string().nullable().optional(),
  leaderId: z.number().nullable().optional(),
  createdAt: z.date(),
});

export const _PartyWithStancesSchema = _PartySchema.extend({
  stances: z.array(
    z.object({
      id: z.number(),
      issue: z.string(),
      value: z.string(),
    }),
  ),
});

const _StanceTypeSchema = z.object({
  id: z.number(),
  issue: z.string(),
  description: z.string(),
});

const _ElectionSchema = z.object({
  election: ElectionEnum,
  seats: z.number(),
  status: z.string().optional(),
  daysLeft: z.number(),
  username: z.string().optional(),
  color: z.string().optional(),
});

const _VoteCountSchema = z.object({
  count: z.number().optional(),
});

const _VoteCandidateIdSchema = z.object({
  candidateId: z.number(),
});

const _ChatSchema = z.object({
  id: z.number(),
  userId: z.number(),
  room: z.string(),
  username: z.string(),
  message: z.string(),
  createdAt: z.date(),
});

const _AccessTokenSchema = z.object({
  id: z.number(),
  token: z.string(),
  createdAt: z.date(),
});

const _CandidateSchema = z.object({
  id: z.number(),
  userId: z.number(),
  election: ElectionEnum,
  votes: z.number().optional(),
  username: z.string(),
  color: z.string().nullable(),
});

const _FeedSchema = z.object({
  id: z.number(),
  userId: z.number(),
  content: z.string(),
  createdAt: z.date(),
});

const _FeedWithUsernameSchema = _FeedSchema.extend({
  username: z.string(),
});

const _AdminUserSchema = z.object({
  id: z.number(),
  email: z.email().nullable().optional(),
  username: z.string(),
  role: z.string().nullable().optional(),
  partyId: z.number().nullable().optional(),
  createdAt: z.date(),
});

const _AdminUserEnrichedSchema = _AdminUserSchema.extend({
  uid: z.string(),
  displayName: z.string().optional(),
  photoUrl: z.url().optional(),
  disabled: z.boolean(),
  emailVerified: z.boolean(),
  creationTime: z.string().optional(),
  lastSignInTime: z.string().optional(),
});

const _PartyRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  leaderId: z.number().nullable().optional(),
  createdAt: z.date(),
  memberCount: z.number(),
  leaderUsername: z.string().nullable().optional(),
});

const _AccessTokenRowSchema = z.object({
  id: z.number(),
  token: z.string(),
  createdAt: z.date(),
});

// ============ BILLS ============
export const BillSchema = camelCaseSchemaDef(_BillSchema);
export type Bill = z.infer<typeof BillSchema>;

export const BillWithUsernameSchema = camelCaseSchemaDef(
  _BillWithUsernameSchema,
);
export type BillWithUsername = z.infer<typeof BillWithUsernameSchema>;

export const VoteTotalsSchema = z.object({
  for: z.number(),
  against: z.number(),
});
export type VoteTotals = z.infer<typeof VoteTotalsSchema>;

export const BillVoteCountsSchema = z
  .object({
    billId: z.number(),
    forCount: z.number().nullable(),
    againstCount: z.number().nullable(),
  })
  .transform(({ billId, forCount, againstCount }) => ({
    billId: billId,
    totals: {
      for: forCount,
      against: againstCount,
    },
  }));
export type BillVoteCounts = z.infer<typeof BillVoteCountsSchema>;

export const HasVotedSchema = z.object({
  billId: z.number(),
});
export type HasVoted = z.infer<typeof HasVotedSchema>;

export const UserVoteSchema = z.object({
  id: z.number(),
  voterId: z.number(),
  billId: z.number(),
  voteYes: z.boolean(),
  createdAt: z.date().optional(),
  title: z.string(),
  stage: StageEnum,
  status: z.string(),
});
export type UserVoteRow = z.infer<typeof UserVoteSchema>;

export const VoteCreateSchema = camelCaseSchemaDef(
  z.object({
    id: z.number(),
    voterId: z.number(),
    billId: z.number(),
    voteYes: z.boolean(),
    createdAt: z.date(),
  }),
);
export type VoteCreate = z.infer<typeof VoteCreateSchema>;

// ============ USERS ============
export const UserSchema = camelCaseSchemaDef(_UserSchema);
export type User = z.infer<typeof UserSchema>;

export const UserWithPartySchema = camelCaseSchemaDef(_UserWithPartyDbSchema);
export type UserWithParty = z.infer<typeof UserWithPartySchema>;

// ============ PARTIES ============
export const PartySchema = camelCaseSchemaDef(_PartySchema);
export type Party = z.infer<typeof PartySchema>;

export const PartyWithStancesSchema = camelCaseSchemaDef(
  _PartyWithStancesSchema,
);
export type PartyWithStances = z.infer<typeof PartyWithStancesSchema>;

export const LeaderboardSchema = z.array(
  z.object({
    party: PartySchema,
    memberCount: z.number(),
  }),
);
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

export const StanceTypeSchema = camelCaseSchemaDef(_StanceTypeSchema);
export type StanceType = z.infer<typeof StanceTypeSchema>;

export const MergeStanceSchema = z.object({
  value: z.string(),
  issue: z.string(),
  description: z.string(),
});
export type MergeStance = z.infer<typeof MergeStanceSchema>;

export const MergeIncomingSchema = z.object({
  id: z.number(),
  status: z.string(),
  createdAt: z.date(),
  mergeData: z.object({
    name: z.string(),
    color: z.string(),
    bio: z.string(),
    leaning: z.string(),
    logo: z.string().nullable(),
    stances: z.array(MergeStanceSchema),
  }),
  senderParty: z.object({
    id: z.number(),
    name: z.string(),
    color: z.string().nullable(),
  }),
});
export type MergeIncoming = z.infer<typeof MergeIncomingSchema>;

export const MergeSentSchema = z.object({
  id: z.number(),
  status: z.string(),
  createdAt: z.date(),
  mergeData: z.object({
    name: z.string(),
    color: z.string(),
    bio: z.string(),
    leaning: z.string(),
    logo: z.string().nullable(),
    stances: z.array(MergeStanceSchema),
  }),
  receiverParty: z.object({
    id: z.number(),
    name: z.string(),
    color: z.string().nullable(),
  }),
});
export type MergeSent = z.infer<typeof MergeSentSchema>;

// ============ ELECTIONS ============
export const ElectionSchema = camelCaseSchemaDef(_ElectionSchema);
export type ElectionOut = z.infer<typeof ElectionSchema>;

export const CandidateSchema = camelCaseSchemaDef(_CandidateSchema);
export type Candidate = z.infer<typeof CandidateSchema>;

export const HasVotedOutSchema = z.object({
  hasVoted: z.boolean(),
  votesUsed: z.number(),
  maxVotes: z.number(),
  votesRemaining: z.number(),
  votedCandidateIds: z.array(z.number()),
});
export type HasVotedOut = z.infer<typeof HasVotedOutSchema>;

export const VoteRemainingSchema = z.object({
  votesRemaining: z.number(),
});
export type VoteRemainingOut = z.infer<typeof VoteRemainingSchema>;

export const IsCandidateSchema = z.object({
  isCandidate: z.boolean(),
});
export type IsCandidateOut = z.infer<typeof IsCandidateSchema>;

// ============ CHAT ============
export const ChatSchema = camelCaseSchemaDef(_ChatSchema);
export type Chat = z.infer<typeof ChatSchema>;

// ============ FEED ============
export const FeedSchema = camelCaseSchemaDef(_FeedSchema);
export type Feed = z.infer<typeof FeedSchema>;

export const FeedWithUsernameSchema = camelCaseSchemaDef(
  _FeedWithUsernameSchema,
);
export type FeedWithUsername = z.infer<typeof FeedWithUsernameSchema>;

// ============ ADMIN ============
export const SuccessSchema = z.object({ success: z.boolean().default(true) });
export type Success = z.infer<typeof SuccessSchema>;

export const AdminVerifySchema = z.object({
  isAdmin: z.boolean().default(true),
});
export type AdminVerify = z.infer<typeof AdminVerifySchema>;

export const AdminCheckByEmailSchema = z.record(z.email(), z.boolean());
export type AdminCheckByEmail = z.infer<typeof AdminCheckByEmailSchema>;

export const AdminUserSchema = camelCaseSchemaDef(_AdminUserSchema);
export type AdminUserRow = z.infer<typeof AdminUserSchema>;

export const AdminUserEnrichedSchema = camelCaseSchemaDef(
  _AdminUserEnrichedSchema,
);
export type AdminUserEnriched = z.infer<typeof AdminUserEnrichedSchema>;

export const AdminPartySchema = camelCaseSchemaDef(_PartyRowSchema);
export type AdminParty = z.infer<typeof AdminPartySchema>;

export const AdminAccessTokenSchema = camelCaseSchemaDef(_AccessTokenRowSchema);
export type AdminAccessToken = z.infer<typeof AdminAccessTokenSchema>;

export const AccessTokenIdRowSchema = z.object({
  id: z.number(),
});
export type AccessTokenIdRow = z.infer<typeof AccessTokenIdRowSchema>;

export const ValidateSchema = z.union([
  z.object({
    valid: z.literal(false),
    error: z.string(),
  }),
  z.object({
    valid: z.literal(true),
    tokenId: z.number(),
  }),
]);
export type ValidateOut = z.infer<typeof ValidateSchema>;

export const ConsumeSchema = z.union([
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
  z.object({
    success: z.literal(true),
  }),
]);
export type Consume = z.infer<typeof ConsumeSchema>;

export const MergeRequestCreateSchema = SuccessSchema.extend({
  mergeRequestId: z.number(),
});
export type MergeRequestRequest = z.infer<typeof MergeRequestCreateSchema>;

export const MergeAcceptSchema = SuccessSchema.extend({
  newPartyId: z.number(),
});
export type MergeAcceptOut = z.infer<typeof MergeAcceptSchema>;
