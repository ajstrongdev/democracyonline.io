import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/merge/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/parties/merge/$id", params });
  },
});
