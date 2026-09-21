import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feed, users } from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware/auth";

export const getFeedItems = createServerFn()
  .inputValidator(
    (data: { limit?: number; offset?: number; visibility?: string }) => data,
  )
  .handler(async ({ data }) => {
    const limit = data.limit || 25;
    const offset = data.offset || 0;

    const conditions = [];
    if (data.visibility) {
      conditions.push(eq(feed.visibility, data.visibility));
    }

    const feedItems = await db
      .select({
        id: feed.id,
        userId: feed.userId,
        username: users.username,
        content: feed.content,
        visibility: feed.visibility,
        createdAt: feed.createdAt,
      })
      .from(feed)
      .leftJoin(users, eq(feed.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(feed.createdAt))
      .limit(limit)
      .offset(offset);

    return feedItems;
  });

export const addFeedItem = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: {
      userId: number;
      content: string;
      visibility?: "admin" | "player";
    }) => data,
  )
  .handler(async ({ data }) => {
    const [newFeedItem] = await db
      .insert(feed)
      .values({
        userId: data.userId,
        content: data.content,
        visibility: data.visibility ?? "player",
      })
      .returning();

    return newFeedItem;
  });

export const addAdminFeedItem = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; content: string }) => data)
  .handler(async ({ data }) => {
    const [newFeedItem] = await db
      .insert(feed)
      .values({
        userId: data.userId,
        content: data.content,
        visibility: "admin",
      })
      .returning();

    return newFeedItem;
  });
