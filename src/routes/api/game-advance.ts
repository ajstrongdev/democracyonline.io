import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/game-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response("Hello, world!");
      },
    },
  },
});
