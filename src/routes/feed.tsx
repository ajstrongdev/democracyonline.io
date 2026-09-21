import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
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
import { EntityReferenceText } from "@/components/entity-reference-text";

dayjs.extend(relativeTime);

export const Route = createFileRoute("/feed")({
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

type FeedItem = {
  id: number;
  userId: number | null;
  username: string | null;
  content: string;
  createdAt: Date | null;
};

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
                      <div className="wrap-anywhere">
                        {item.userId ? (
                          <span
                            className="font-bold text-foreground hover:underline cursor-pointer"
                            onClick={() =>
                              navigate({
                                to: "/dashboard/players/$playerId",
                                params: { playerId: String(item.userId) },
                              })
                            }
                          >
                            {item.username || "System"}
                          </span>
                        ) : (
                          <span className="font-bold text-foreground">
                            {item.username || "System"}
                          </span>
                        )}
                        {": "}
                        <span className="text-muted-foreground">
                          <EntityReferenceText content={item.content} />
                        </span>
                      </div>
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
