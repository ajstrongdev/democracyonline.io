import "server-only";

import { z } from "zod";
import { ConsumeSchema, ValidateSchema } from "@/lib/trpc/types";
import { publicProcedure, router } from "@/server/trpc";

export const accessTokenRouter = router({
  validate: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT id FROM access_tokens WHERE token = $1",
        [input.token],
      );

      if (res.rows.length === 0) {
        return ValidateSchema.parse({
          valid: false,
          error: "Invalid access token",
        });
      }

      return ValidateSchema.parse({
        valid: true,
        tokenId: Number(res.rows[0].id),
      });
    }),

  consume: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        "DELETE FROM access_tokens WHERE token = $1 RETURNING id",
        [input.token],
      );

      if (res.rows.length === 0) {
        return ConsumeSchema.parse({
          success: false,
          error: "Token not found or already used",
        });
      }

      return ConsumeSchema.parse({ success: true });
    }),
});
