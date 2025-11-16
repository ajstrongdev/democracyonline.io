import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ChatSchema } from "@/lib/trpc/types";
import { authedProcedure, publicProcedure, router } from "@/server/trpc";

const CHAT_MESSAGE_LIMIT = 50;

export const chatRouter = router({
  listByRoom: publicProcedure
    .input(z.object({ room: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT * FROM chats WHERE room = $1 ORDER BY created_at DESC LIMIT $2",
        [input.room, CHAT_MESSAGE_LIMIT],
      );

      return z.array(ChatSchema).parse(res.rows);
    }),

  add: authedProcedure
    .input(
      z.object({
        room: z.string().min(1),
        username: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userRes = await ctx.query(
        "SELECT username FROM users WHERE id = $1",
        [ctx.dbUserId],
      );

      if (userRes.rows[0]?.username !== input.username) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Username mismatch",
        });
      }

      const res = await ctx.query(
        "INSERT INTO chats (user_id, room, username, message) VALUES ($1, $2, $3, $4) RETURNING *",
        [ctx.dbUserId, input.room, input.username, input.message],
      );

      return ChatSchema.parse(res.rows[0]);
    }),
});
