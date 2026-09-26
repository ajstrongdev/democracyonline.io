import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties/create" });
  },
});
