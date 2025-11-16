import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { auth } from "@/lib/firebase";
import type { AppRouter } from "@/server/routers/app";

/**
 * React hooks powered by tRPC
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Create tRPC client
 */
export function getTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (opts) =>
          !(
            opts.direction === "down" &&
            opts.result instanceof Error &&
            opts.result.data?.path === "admin.verify" &&
            opts.result.data?.code === "FORBIDDEN"
          ),
      }),
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL || ""}/api/trpc`,
        headers: async () => {
          const idToken = await auth.currentUser?.getIdToken();
          return idToken ? { authorization: `Bearer ${idToken}` } : {};
        },
        transformer: superjson,
      }),
    ],
  });
}

export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
    },
  });
}
