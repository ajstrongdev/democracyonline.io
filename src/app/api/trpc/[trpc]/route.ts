import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/app';
import { createTRPCContext } from '@/server/trpc';
import { getAuthUserFromRequest } from '@/server/auth';

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      const authUser = await getAuthUserFromRequest(req);
      return createTRPCContext({ req, authUser });
    },
    onError({ error, path }) {
      console.error('tRPC error', { path, error });
    },
  });
}

export { handler as GET, handler as POST }
