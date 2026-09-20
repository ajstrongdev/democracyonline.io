import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/elections/senate")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
