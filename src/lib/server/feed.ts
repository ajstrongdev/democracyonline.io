import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feed, users } from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware/auth";

// Fetch feed items with pagination
export const getFeedItems = createServerFn()
  .inputValidator((data: { limit?: number; offset?: number }) => data)
  .handler(async ({ data }) => {
    const limit = data.limit || 25;
    const offset = data.offset || 0;

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
      .limit(limit)
      .offset(offset);

    return feedItems;
  });

// Add a new feed item
export const addFeedItem = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; content: string }) => data)
  .handler(async ({ data }) => {
    const [newFeedItem] = await db
      .insert(feed)
      .values({
        userId: data.userId,
        content: data.content,
      })
      .returning();

    return newFeedItem;
  });
