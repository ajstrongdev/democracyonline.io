import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseSocialSearch } from "@/lib/social/queries";

export const Route = createFileRoute("/social")({
  validateSearch: parseSocialSearch,
  beforeLoad: ({ search }) => { throw redirect({ to: "/dashboard/social", search }); },
});
