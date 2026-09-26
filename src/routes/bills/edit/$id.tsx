import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/edit/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/bills/edit/$id", params });
  },
});
