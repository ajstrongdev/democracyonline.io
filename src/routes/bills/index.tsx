import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills" });
  },
});
