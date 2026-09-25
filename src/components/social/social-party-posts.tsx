import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Card, CardContent } from "@/components/ui/card";
import { WikiEmpty, WikiSection } from "@/components/wiki/wiki-layout";

dayjs.extend(relativeTime);

type PartySocialPost = {
  id: number;
  content: string;
  createdAt: Date;
  publisherUserId: number | null;
  publisherUsername: string;
};

export function SocialPartyPosts({ posts }: { posts: Array<PartySocialPost> }) {
  return (
    <WikiSection title="Z.com account" description="Posts published from this party’s official account.">
      {posts.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="space-y-2 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{post.content}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                  <span>
                    Posted by {post.publisherUserId ? (
                      <Link
                        to="/dashboard/players/$playerId"
                        params={{ playerId: String(post.publisherUserId) }}
                        className="hover:text-primary hover:underline"
                      >
                        @{post.publisherUsername}
                      </Link>
                    ) : `@${post.publisherUsername}`}
                  </span>
                  <time dateTime={new Date(post.createdAt).toISOString()}>
                    {dayjs(post.createdAt).fromNow()}
                  </time>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <WikiEmpty>This party has not posted from its Z.com account yet.</WikiEmpty>
      )}
    </WikiSection>
  );
}
