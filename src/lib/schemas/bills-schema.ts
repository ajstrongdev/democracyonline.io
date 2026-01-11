import { z } from "zod";

export const CreateBillsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(8, "Content must be at least 8 characters long"),
  creatorId: z.number(),
});
