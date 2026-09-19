import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills/create" });
  },
});
