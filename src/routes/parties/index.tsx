import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/parties" });
  },
});
