import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/primaries")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties/primaries" });
  },
});
