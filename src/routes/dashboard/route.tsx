import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardData(),
  component: DashboardWorkspace,
});

function DashboardWorkspace() {
  const initialData = Route.useLoaderData();
  const { data } = useSuspenseQuery({
    ...dashboardQuery(),
    initialData,
    // Bounded fallback while live server invalidation is still being built.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const navigate = useNavigate();
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
          className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden rounded-xl p-0 [&_.wiki-page]:max-w-none [&_.wiki-page]:px-4 sm:[&_.wiki-page]:px-6"
        >
          <DialogTitle className="sr-only">Dashboard workspace</DialogTitle>
          <DialogDescription className="sr-only">
            Close to return to your dashboard.
          </DialogDescription>
          <div
            key={pathname}
            className="workspace-page min-h-0 overflow-y-auto pt-8"
          >
            <Outlet />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
