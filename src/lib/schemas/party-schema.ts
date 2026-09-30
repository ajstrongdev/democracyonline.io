import { z } from "zod";

export const PartySchema = z.object({
  name: z.string().min(1, "Party name is required"),
  bio: z.string().min(1, "Party bio is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  logo: z.string().nullable().optional(),
  discord: z
    .string()
    .url("Enter a valid Discord invite URL")
    .refine((url) => url.startsWith("https://"), "Discord links must use HTTPS")
    .nullable()
    .optional(),
  leaning: z.string(),
});

export const CreatePartySchema = z.object({
  party: PartySchema,
  platform: z.string().trim().max(50_000),
  cofounders: z.tuple([z.string().trim().min(1), z.string().trim().min(1)]),
});

export const UpdatePartySchema = z.object({
  party: PartySchema.extend({
    id: z.number(),
  }),
});
