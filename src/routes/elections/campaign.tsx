import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/elections/campaign")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/elections/campaign"!</div>;
}
