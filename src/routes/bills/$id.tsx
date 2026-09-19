import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/bills/$billId",
      params: { billId: params.id },
    });
  },
});
