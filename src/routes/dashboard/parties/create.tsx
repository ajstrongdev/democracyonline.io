import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/parties/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties", search: { create: true } });
  },
});
