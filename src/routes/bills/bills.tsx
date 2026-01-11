import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bills/bills")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/bills/bills"!</div>;
}
