import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parties/manage/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/parties/manage/$id", params });
  },
});
