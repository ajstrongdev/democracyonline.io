import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Suspense, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { ReactNode } from "react";
import type { FeedItem } from "@/types/feed";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import GenericSkeleton from "@/components/generic-skeleton";
import { getFeedItems } from "@/lib/server/feed";
import ProtectedRoute from "@/components/auth/protected-route";

dayjs.extend(relativeTime);

// Helper function to parse content and create links for bill references
function parseContentWithLinks(content: string): Array<ReactNode> {
  // Match patterns like "Bill #123", "bill #123", "Bill 123", etc.
  const billPattern = /\b[Bb]ill\s*#?(\d+)\b/g;
  const parts: Array<ReactNode> = [];
  let lastIndex = 0;
  let match;

  while ((match = billPattern.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Add the bill link
    const billId = match[1];
    parts.push(
      <Link
        key={`bill-${billId}-${match.index}`}
        to="/bills/$id"
        params={{ id: billId }}
        className="text-primary hover:underline"
      >
        {match[0]}
      </Link>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

export const Route = createFileRoute("/feed")({
  beforeLoad: ({ context }) => {
    if (context.auth.loading) {
      return;
    }
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    return {
      initialFeedItems: await getFeedItems({ data: { limit: 25, offset: 0 } }),
    };
  },
  component: FeedPage,
});

function FeedPage() {
  return (
    <Suspense fallback={<GenericSkeleton />}>
      <ProtectedRoute>
        <FeedContent />
      </ProtectedRoute>
    </Suspense>
  );
}

function FeedContent() {
  const navigate = useNavigate();
  const { initialFeedItems } = Route.useLoaderData();
  const [feedItems, setFeedItems] = useState<Array<FeedItem>>(initialFeedItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialFeedItems.length === 25);

  const loadMore = async () => {
    setIsLoading(true);
    try {
      const newItems = await getFeedItems({
        data: { limit: 25, offset: feedItems.length },
      });

      if (newItems.length < 25) {
        setHasMore(false);
      }

      setFeedItems([...feedItems, ...newItems]);
    } catch (error) {
      console.error("Error loading more feed items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Feed</h1>
        <p className="text-muted-foreground">
          Stay updated with the latest activities in the community.
        </p>
      </div>
      <div className="space-y-4">
        {feedItems.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No activity yet. Be the first to post!
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {feedItems.map((item: FeedItem) => (
              <Card key={item.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                    <div className="flex-1">
                      <p className="wrap-anywhere">
                        {item.userId ? (
                          <span
                            className="font-bold text-foreground hover:underline cursor-pointer"
                            onClick={() =>
                              navigate({
                                to: "/profile/$id",
                                params: { id: String(item.userId) },
                              })
                            }
                          >
                            {item.username || "Anonymous"}
                          </span>
                        ) : (
                          <span className="font-bold text-foreground">
                            {item.username || "Anonymous"}
                          </span>
                        )}{" "}
                        <span className="text-muted-foreground">
                          {parseContentWithLinks(item.content)}
                        </span>
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground md:text-right shrink-0">
                      {item.createdAt ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {dayjs(item.createdAt).fromNow()}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {dayjs(item.createdAt).format(
                              "MMMM D, YYYY h:mm A",
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "Unknown date"
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={loadMore}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
