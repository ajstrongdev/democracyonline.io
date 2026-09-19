import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$id")({
  beforeLoad: ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Response("Player not found", { status: 404 });
    }
    throw redirect({
      to: "/dashboard/players/$playerId",
      params: { playerId: params.id },
      replace: true,
    });
  },
});
