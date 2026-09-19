import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/elections/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/elections" });
  },
});
