import { z } from "zod";

export const PartySchema = z.object({
  name: z.string().min(1, "Party name is required"),
  bio: z.string().min(1, "Party bio is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  logo: z.string().nullable().optional(),
  discord: z.string().nullable().optional(),
  leaning: z.string(),
});

export const CreatePartySchema = z.object({
  party: PartySchema,
  platform: z.string().trim().max(50_000),
});

export const UpdatePartySchema = z.object({
  party: PartySchema.extend({
    id: z.number(),
  }),
});
