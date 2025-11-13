import 'server-only';
import { router } from '@/server/trpc';
import { userRouter } from './user';
import { billRouter } from './bill';
import { partyRouter } from './party';
import { electionRouter } from './election';
import { feedRouter } from './feed';
import { chatRouter } from './chat';
import { adminRouter } from './admin';
import { accessTokenRouter } from './accessToken';

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
