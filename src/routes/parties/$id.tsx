import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/parties/$partyId",
      params: { partyId: params.id },
    });
  },
});
