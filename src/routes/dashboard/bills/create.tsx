import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/bills/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills", search: { create: true } });
  },
});
