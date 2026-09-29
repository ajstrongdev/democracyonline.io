import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardContent } from "@/components/dashboard/dashboard-home";
import { NotificationInvite } from "@/components/notifications/notification-invite";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDashboardData } from "@/lib/server/dashboard/data";
import { dashboardQuery } from "@/lib/dashboard/queries";
import { MobileNavigation } from "@/components/wiki/mobile-navigation";
import { QuickNavigation } from "@/components/wiki/quick-navigation";

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardData(),
  component: DashboardWorkspace,
});

const desktopQuery = "(min-width: 1024px)";
function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function getDesktop() {
  return window.matchMedia(desktopQuery).matches;
}

function DashboardWorkspace() {
  const initialData = Route.useLoaderData();
  const { data } = useSuspenseQuery({
    ...dashboardQuery(),
    initialData,
  });
  const navigate = useNavigate();
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktop, () => false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigationStack = useRef([pathname]);
  useEffect(() => {
    const stack = navigationStack.current;
    if (stack[stack.length - 1] !== pathname) stack.push(pathname);
  }, [pathname]);
  const isHome = pathname.replace(/\/$/, "") === "/dashboard";
  const handleBack = () => {
    const stack = navigationStack.current;
    if (stack[stack.length - 1] === pathname) stack.pop();
    const previous = stack[stack.length - 1];
    void navigate({ to: previous ?? "/dashboard" });
  };

  if (isDesktop) {
    return isHome ? (
      <><DashboardContent data={data} /><NotificationInvite active /></>
    ) : (
      <div className="workspace-page min-w-0 flex-1"><Outlet /></div>
    );
  }

  return (
    <>
      <DashboardContent data={data} />
      <NotificationInvite active={isHome} />
      <Dialog
        open={!isHome}
        onOpenChange={(open) => {
          if (!open) void navigate({ to: "/dashboard" });
        }}
      >
        <DialogContent
          onBack={handleBack}
          toolbar={<><MobileNavigation /><QuickNavigation keyboardShortcut={false} /></>}
          className="flex h-dvh max-h-dvh w-full max-w-6xl flex-col overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[94dvh] sm:w-[calc(100%-1rem)] sm:rounded-xl [&_.wiki-page]:max-w-none [&_.wiki-page]:px-3 sm:[&_.wiki-page]:px-6"
        >
          <DialogTitle className="sr-only">Dashboard workspace</DialogTitle>
          <DialogDescription className="sr-only">
            Close to return to your dashboard.
          </DialogDescription>
          <div
            key={pathname}
            className="workspace-page min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] pt-2 sm:pt-8"
          >
            <Outlet />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
