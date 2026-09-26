import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/coalitions/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties/coalitions/create" });
  },
});
