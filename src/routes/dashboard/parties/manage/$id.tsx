import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/parties/manage/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/parties/$partyId",
      params: { partyId: params.id },
      replace: true,
    });
  },
});
