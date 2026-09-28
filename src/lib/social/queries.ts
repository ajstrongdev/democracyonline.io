import { queryOptions } from "@tanstack/react-query";
import { getSocialFeed } from "@/lib/server/social/social";

export type AccountFilter = "all" | "players" | "parties" | "potro";
export type FeedSort = "newest" | "popular" | "least-popular";

export const parseSocialSearch = (search: Record<string, unknown>) => ({
  postId:
    Number.isInteger(Number(search.postId)) && Number(search.postId) > 0
      ? Number(search.postId)
      : undefined,
  commentId:
    Number.isInteger(Number(search.commentId)) && Number(search.commentId) > 0
      ? Number(search.commentId)
      : undefined,
});

export async function loadSocialData(postId?: number) {
  const [feed, focused] = await Promise.all([
    getSocialFeed({ data: { limit: 20, offset: 0 } }),
    postId
      ? getSocialFeed({ data: { limit: 1, offset: 0, postId } })
      : Promise.resolve(null),
  ]);
  return { ...feed, focusedEntry: focused?.entries[0] ?? null };
}

export const socialFeedQuery = (account: AccountFilter, sort: FeedSort) =>
  queryOptions({
    queryKey: ["social", "feed", account, sort] as const,
    queryFn: () => getSocialFeed({ data: { limit: 21, offset: 0, account, sort } }),
    staleTime: 7_000,
  });
