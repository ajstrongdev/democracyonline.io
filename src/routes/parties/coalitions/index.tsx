import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/coalitions/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties/coalitions" });
  },
});
