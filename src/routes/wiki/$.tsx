import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/wiki/$")({
  beforeLoad: ({ params }) => {
    throw redirect({
      href: `/dashboard/${params._splat ?? ""}`,
      replace: true,
    });
  },
});
