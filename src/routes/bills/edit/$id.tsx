import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/edit/$id")({
  loader: async ({ params }) => {},
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/bills/edit/$id"!</div>;
}
