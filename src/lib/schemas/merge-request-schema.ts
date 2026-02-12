import { z } from "zod";

// Schema for the merged party data
export const MergedPartyDataSchema = z.object({
  name: z.string().min(1, "Party name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  bio: z.string().min(1, "Party bio is required"),
  leaning: z.string(),
  logo: z.string().nullable().optional(),
  membership_fee: z
    .number()
    .min(0, "Membership fee cannot be negative")
    .default(0),
});

// Schema for a single stance value
export const StanceValueSchema = z.object({
  stanceId: z.number(),
  value: z.string(),
});

// Schema for creating a merge request
export const CreateMergeRequestSchema = z.object({
  senderPartyId: z.number(),
  receiverPartyId: z.number(),
  mergedPartyData: MergedPartyDataSchema,
  stances: z.array(StanceValueSchema),
});

// Schema for accepting a merge request
export const AcceptMergeRequestSchema = z.object({
  mergeRequestId: z.number(),
  partyId: z.number(),
});

// Schema for rejecting a merge request
export const RejectMergeRequestSchema = z.object({
  mergeRequestId: z.number(),
  partyId: z.number(),
});

// Schema for canceling a sent merge request
export const CancelMergeRequestSchema = z.object({
  mergeRequestId: z.number(),
  partyId: z.number(),
});
