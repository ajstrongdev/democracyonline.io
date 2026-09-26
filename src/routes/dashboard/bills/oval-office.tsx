import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/bills/oval-office")({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/bills",
      search: { desk: "Presidential" },
    });
  },
});
