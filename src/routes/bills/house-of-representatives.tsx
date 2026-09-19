import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/house-of-representatives")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/bills/house-of-representatives" });
  },
});
