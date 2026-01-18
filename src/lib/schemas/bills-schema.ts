import { z } from "zod";

export const CreateBillsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(8, "Content must be at least 8 characters long"),
  creatorId: z.number(),
});

export const UpdateBillsSchema = z.object({
  id: z.number(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be 255 characters or less"),
  content: z.string().min(8, "Content must be at least 8 characters long"),
  creatorId: z.number(),
});
