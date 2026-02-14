import { z } from "zod";
import { nonNegativeMembershipFeeSchema } from "@/lib/schemas/finance-schema";

export const PartySchema = z.object({
  name: z.string().min(1, "Party name is required"),
  leader_id: z.number(),
  bio: z.string().min(1, "Party bio is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  logo: z.string().nullable().optional(),
  discord: z.string().nullable().optional(),
  leaning: z.string(),
  membership_fee: nonNegativeMembershipFeeSchema.default(0),
});

export const PartyStanceInputSchema = z.object({
  stanceId: z.number(),
  value: z.string(),
});

export const CreatePartySchema = z.object({
  party: PartySchema,
  stances: z.array(PartyStanceInputSchema),
});

export const UpdatePartySchema = CreatePartySchema.extend({
  party: CreatePartySchema.shape.party.extend({
    id: z.number(),
  }),
});
