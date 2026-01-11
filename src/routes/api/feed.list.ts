import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feed, users } from "@/db/schema";

export const Route = createFileRoute("/api/feed/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          // Fetch the 50 most recent feed items with associated usernames
          const feedItems = await db
            .select({
              id: feed.id,
              userId: feed.userId,
              username: users.username,
              content: feed.content,
              createdAt: feed.createdAt,
            })
            .from(feed)
            .leftJoin(users, eq(feed.userId, users.id))
            .orderBy(desc(feed.createdAt))
            .limit(50);

          return new Response(JSON.stringify(feedItems), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.error("Error fetching feed:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch feed" }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }
      },
    },
  },
});
