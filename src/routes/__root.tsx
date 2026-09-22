import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ThemeProvider } from "@ajstrongdev/start-themes";
import { Toaster } from "sonner";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import {
  getThemeClasses,
  getThemeServerFn,
  setThemeServerFn,
} from "@/lib/server/theme";
import { NotFound } from "@/components/not-found";
import { WikiNavigation } from "@/components/wiki/wiki-header";
import { getAuthRedirect } from "@/lib/auth-guard";
import { auth } from "@/lib/firebase";
import { getCookie } from "@tanstack/react-start/server";

type AuthContext = {
  user: User | null;
  loading: boolean;
};

interface MyRouterContext {
  queryClient: QueryClient;
  auth: AuthContext;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: ({ location, context }) => {
    const authUser =
      context.auth?.user ??
      (typeof window !== "undefined" ? auth.currentUser ?? null : null);
    const hasSessionCookie =
      typeof window === "undefined"
        ? !!getCookie("__session")
        : document.cookie.includes("__session=");
    const isLoading = context.auth?.loading && !authUser && !hasSessionCookie;

    if (isLoading) {
      return;
    }

    const pathname = location.pathname;
    const redirectTarget = getAuthRedirect(
      pathname,
      Boolean(authUser),
      false,
      hasSessionCookie,
    );

    if (redirectTarget) {
      throw redirect({ to: redirectTarget });
    }
  },
  loader: async () => {
    const theme = await getThemeServerFn();
    return { theme };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "democracyonline.io",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const { theme } = Route.useLoaderData();

  return (
    <ThemeProvider
      theme={theme}
      onThemeChange={(t) => setThemeServerFn({ data: t })}
    >
      <div className="flex min-h-svh flex-col">
        <WikiNavigation />
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </ThemeProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = Route.useLoaderData();
  return (
    <html lang="en" className={getThemeClasses(theme)} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              success:
                "bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-50 border-green-200 dark:border-green-800",
            },
          }}
        />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
