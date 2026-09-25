import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feed, users } from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/user-email";

export const getFeedItems = createServerFn()
  .inputValidator(
    (data: { limit?: number; offset?: number; visibility?: string }) => data,
  )
  .handler(async ({ data }) => {
    const limit = Math.min(50, Math.max(1, data.limit ?? 25));
    const offset = Math.max(0, data.offset ?? 0);

    const conditions = [];
    if (data.visibility) {
      conditions.push(eq(feed.visibility, data.visibility));
    }

    const feedItems = await db
      .select({
        id: feed.id,
        userId: feed.userId,
        username: users.username,
        photoUrl: users.photoUrl,
        content: feed.content,
        visibility: feed.visibility,
        createdAt: feed.createdAt,
      })
      .from(feed)
      .leftJoin(users, eq(feed.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(feed.createdAt), desc(feed.id))
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
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!actor || actor.id !== data.userId) {
      throw new Error("You can only post feed items as yourself");
    }
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
