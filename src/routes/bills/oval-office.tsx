import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/oval-office")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills/oval-office" });
  },
});
