import { createFileRoute } from "@tanstack/react-router";
import { SocialContent, loadSocialData, parseSocialSearch } from "@/routes/social";

export const Route = createFileRoute("/dashboard/social")({
  validateSearch: parseSocialSearch,
  loaderDeps: ({ search }) => ({ postId: search.postId }),
  loader: ({ deps }) => loadSocialData(deps.postId),
  component: () => <SocialContent data={Route.useLoaderData()} search={Route.useSearch()} />,
});
