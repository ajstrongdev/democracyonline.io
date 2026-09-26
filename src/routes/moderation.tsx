import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/moderation")({
  beforeLoad: () => { throw redirect({ to: "/dashboard/moderation" }); },
});
