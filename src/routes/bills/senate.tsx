import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/senate")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills/senate" });
  },
});
