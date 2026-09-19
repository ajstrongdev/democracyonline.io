import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/coalitions/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/parties/coalitions/$id", params });
  },
});
