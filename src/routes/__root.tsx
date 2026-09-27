import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Toaster } from "sonner";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { getThemeClasses, getThemeServerFn, themes } from "@/lib/server/theme";
import { NotFound } from "@/components/not-found";
import { WikiNavigation } from "@/components/wiki/wiki-header";
import { getAuthRedirect } from "@/lib/auth-guard";
import { auth } from "@/lib/firebase";
import { getCurrentBanStatus, getSessionUser } from "@/lib/server/session";
import { AppThemeProvider, useAppTheme } from "@/components/app-theme-provider";
import { colorSchemeStyle } from "@/lib/color-schemes";
import { getSelectedColorScheme } from "@/lib/server/color-schemes";
import { PlayerPresenceHeartbeat } from "@/components/players/player-presence-heartbeat";
import packageJson from "../../package.json";

type AuthContext = {
  user: User | null;
  loading: boolean;
};

interface MyRouterContext {
  queryClient: QueryClient;
  auth: AuthContext;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location, context }) => {
    const { banned } = await getCurrentBanStatus();
    if (banned && location.pathname !== "/banned") {
      throw redirect({ to: "/banned" });
    }
    const authUser =
      context.auth?.user ??
      (typeof window !== "undefined" ? (auth.currentUser ?? null) : null);
    const sessionUser = authUser ? null : await getSessionUser();
    const hasSessionCookie = Boolean(sessionUser);
    const isLoading = context.auth?.loading && !authUser && !hasSessionCookie;

    if (isLoading) {
      return;
    }

    const pathname = location.pathname;
    const redirectTarget = getAuthRedirect(
      pathname,
      Boolean(authUser || sessionUser),
      false,
      hasSessionCookie,
    );

    if (redirectTarget) {
      throw redirect({ to: redirectTarget });
    }
  },
  loader: async () => {
    const [storedTheme, customScheme] = await Promise.all([
      getThemeServerFn(),
      getSelectedColorScheme(),
    ]);
    const theme = customScheme
      ? customScheme.mode === "dark"
        ? "dark"
        : "light"
      : storedTheme;
    return { theme, customScheme };
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
        title: "Oscana",
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
  const { theme, customScheme } = Route.useLoaderData();

  return (
    <AppThemeProvider initialTheme={theme} initialColorScheme={customScheme}>
      <PlayerPresenceHeartbeat />
      <div className="flex min-h-svh flex-col">
        <WikiNavigation />
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <footer className="border-t bg-muted/30 px-4 py-4 text-center text-sm text-muted-foreground">
          Running Polsimmer v{packageJson.version}{" "}
          <a href="https://github.com/ajstrongdev/polsimmer" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">(source)</a>
          {" "}·{" "}
          <a href="https://discord.gg/XREYCNFAdC" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Join the Polsimmer Discord</a>
        </footer>
        <ThemedToaster />
      </div>
    </AppThemeProvider>
  );
}

function ThemedToaster() {
  const { theme, customScheme } = useAppTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={
        customScheme
          ? customScheme.mode === "dark"
            ? "dark"
            : "light"
          : themes.find((item) => item.id === theme)?.isDark
            ? "dark"
            : "light"
      }
      richColors
    />
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme, customScheme } = Route.useLoaderData();
  return (
    <html
      lang="en"
      className={getThemeClasses(theme)}
      style={
        customScheme
          ? (colorSchemeStyle(customScheme) as React.CSSProperties)
          : undefined
      }
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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
