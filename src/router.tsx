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
        loading: true,
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

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  });

  return router;
};
