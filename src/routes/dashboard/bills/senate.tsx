import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/bills/senate")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills", search: { desk: "Senate" } });
  },
});
