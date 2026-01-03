import { z } from 'zod'

export const SearchUsersSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long')
    .trim(),
  excludeUserId: z.number().optional(),
})

export type SearchUsersInput = z.infer<typeof SearchUsersSchema>
