import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/dashboard/bills/house-of-representatives",
)({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills", search: { desk: "House" } });
  },
});
