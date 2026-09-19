import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/wiki/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
