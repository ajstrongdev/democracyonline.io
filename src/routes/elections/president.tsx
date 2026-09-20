import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/elections/president")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
