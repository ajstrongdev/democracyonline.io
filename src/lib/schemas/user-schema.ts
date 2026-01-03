import { z } from 'zod'

export const UpdateUserProfileSchema = z.object({
  userId: z.number(),
  username: z.string().min(1, 'Username is required'),
  bio: z.string().min(1, 'Bio is required'),
  politicalLeaning: z.string(),
})

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>
