import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Card, CardContent } from "@/components/ui/card";
import { WikiEmpty, WikiSection } from "@/components/wiki/wiki-layout";

dayjs.extend(relativeTime);

export type PlayerSocialPost = {
  id: number;
  content: string;
  createdAt: Date;
};

export function SocialPlayerPosts({ posts }: { posts: Array<PlayerSocialPost> }) {
  return (
    <WikiSection title="Z.com posts" description="Recent posts shared from this player’s account.">
      {posts.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="space-y-2 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{post.content}</p>
                <time className="block text-xs text-muted-foreground" dateTime={new Date(post.createdAt).toISOString()}>
                  {dayjs(post.createdAt).fromNow()}
                </time>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <WikiEmpty>No Z.com posts yet.</WikiEmpty>
      )}
    </WikiSection>
  );
}
