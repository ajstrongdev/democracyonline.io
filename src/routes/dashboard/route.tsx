import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { DashboardContent } from "./index";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getDashboardData } from "@/lib/server/dashboard";

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardData(),
  component: DashboardWorkspace,
});

function DashboardWorkspace() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isHome = pathname.replace(/\/$/, "") === "/dashboard";

  return (
    <>
      <DashboardContent data={data} />
      <Dialog open={!isHome} onOpenChange={(open) => { if (!open) void navigate({ to: "/dashboard" }); }}>
        <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden rounded-xl p-0 [&_.wiki-page]:max-w-none [&_.wiki-page]:px-4 sm:[&_.wiki-page]:px-6">
          <DialogTitle className="sr-only">Dashboard workspace</DialogTitle>
          <DialogDescription className="sr-only">Close to return to your dashboard.</DialogDescription>
          <div key={pathname} className="workspace-page min-h-0 overflow-y-auto pt-8">
            <Outlet />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
