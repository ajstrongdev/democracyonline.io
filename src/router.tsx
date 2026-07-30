import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { onAuthStateChanged } from "firebase/auth";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";
import { auth } from "@/lib/firebase";
import { AuthProvider } from "@/lib/auth-context";
import { NotFound } from "@/components/not-found";

export const getRouter = () => {
  const rqContext = TanstackQuery.getContext();

  const router = createRouter({
    routeTree,
    context: {
      ...rqContext,
      auth: {
        user: null,
        loading: typeof window === "undefined" ? false : true,
      },
    },
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
    Wrap: ({ children }) => (
      <TanstackQuery.Provider {...rqContext}>
        <AuthProvider>{children}</AuthProvider>
      </TanstackQuery.Provider>
    ),
    scrollRestoration: true,
  });

  // Only set up client-side auth listener on the client
  if (typeof window !== "undefined") {
    onAuthStateChanged(auth, (user) => {
      router.update({
        context: {
          ...rqContext,
          auth: {
            user,
            loading: false,
          },
        },
      });
    });
  }

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  });

  return router;
};
