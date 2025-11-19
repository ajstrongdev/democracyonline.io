import "server-only";
import { router } from "@/server/trpc";
import { accessTokenRouter } from "./accessToken";
import { adminRouter } from "./admin";
import { billRouter } from "./bill";
import { chatRouter } from "./chat";
import { electionRouter } from "./election";
import { feedRouter } from "./feed";
import { partyRouter } from "./party";
import { userRouter } from "./user";

export const appRouter = router({
  user: userRouter,
  bill: billRouter,
  party: partyRouter,
  election: electionRouter,
  feed: feedRouter,
  chat: chatRouter,
  admin: adminRouter,
  accessToken: accessTokenRouter,
});

export type AppRouter = typeof appRouter;
