import { z } from "zod";

export const UpdateUserProfileSchema = z.object({
  userId: z.number(),
  username: z.string().min(1, "Username is required"),
  bio: z.string().min(1, "Bio is required").max(1000, "Bio must be 1000 characters or fewer"),
  pronouns: z.string().trim().max(80, "Pronouns must be 80 characters or fewer").optional(),
  politicalLeaning: z.string(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
