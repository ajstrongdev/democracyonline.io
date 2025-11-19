"use client";

import GenericSkeleton from "@/components/genericskeleton";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import type { FeedWithUsername } from "@/lib/trpc/types";
import withAuth from "@/lib/withAuth";

const SKELETON_KEYS = Array.from(
  { length: 5 },
  (_, i) => `skeleton-${i}`,
) as const;

function Home() {
  const { data: feed = [], isLoading: loading } = trpc.feed.list.useQuery();

  // TODO: Optimize by returning username in feed.list via a JOIN, or
  // use trpc.user.getById per-feed item (beware N+1).

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Feed</h1>
        <p className="text-muted-foreground">
          Stay updated with the latest activities in the community.
        </p>
      </div>
      <div className="space-y-4">
        {loading
          ? SKELETON_KEYS.map((key) => <GenericSkeleton key={key} />)
          : feed.map((item: FeedWithUsername) => (
              <Card key={item.id} className="p-4">
                <CardContent className="p-0">
                  <div className="md:flex justify-between items-center w-full">
                    <p className="text-wrap">
                      <b>{item.username || "Unknown User"}</b>: {item.content}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap md:ml-4">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

export default withAuth(Home);
