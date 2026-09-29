import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardContent } from "@/components/dashboard/dashboard-home";
import { NotificationInvite } from "@/components/notifications/notification-invite";
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
  });
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isHome = pathname.replace(/\/$/, "") === "/dashboard";

  return isHome ? (
    <div key="dashboard" className="workspace-page min-w-0 flex-1">
      <DashboardContent data={data} />
      <NotificationInvite active />
    </div>
  ) : (
    <div key={pathname} className="workspace-page min-w-0 flex-1">
      <Outlet />
    </div>
  );
}
