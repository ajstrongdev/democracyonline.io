import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feed, parties, partyNewspaperArticles, users } from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/auth/user-email";

export const getPartyNewspaper = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ partyId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const [viewer] = context.user?.email
      ? await db
          .select({
            id: users.id,
            partyId: users.partyId,
            active: users.isActive,
          })
          .from(users)
          .where(userEmailEquals(context.user.email))
          .limit(1)
      : [];
    const [party] = await db
      .select({ officerId: parties.socialMediaOfficerId })
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1);
    const isOfficer = Boolean(
      viewer?.active &&
      viewer.partyId === data.partyId &&
      viewer.id === party?.officerId,
    );
    const articles = await db
      .select({
        id: partyNewspaperArticles.id,
        title: partyNewspaperArticles.title,
        content: partyNewspaperArticles.content,
        publishedAt: partyNewspaperArticles.publishedAt,
        author: users.username,
      })
      .from(partyNewspaperArticles)
      .leftJoin(users, eq(users.id, partyNewspaperArticles.authorId))
      .where(
        and(
          eq(partyNewspaperArticles.partyId, data.partyId),
          isOfficer ? undefined : isNotNull(partyNewspaperArticles.publishedAt),
        ),
      )
      .orderBy(desc(partyNewspaperArticles.createdAt));
    return {
      articles,
      canSubmit: Boolean(viewer?.active && viewer.partyId === data.partyId),
      isOfficer,
    };
  });

export const submitPartyArticle = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      partyId: z.number().int().positive(),
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(1).max(20_000),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [author] = await db
      .select({ id: users.id, partyId: users.partyId, active: users.isActive })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!author?.active || author.partyId !== data.partyId)
      throw new Error("Only active party members can submit an article");
    await db.insert(partyNewspaperArticles).values({
      partyId: data.partyId,
      authorId: author.id,
      title: data.title,
      content: data.content,
    });
    return true;
  });

export const editPartyArticle = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      articleId: z.number().int().positive(),
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(1).max(20_000),
      publish: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      const [article] = await tx
        .select({
          partyId: partyNewspaperArticles.partyId,
          publishedAt: partyNewspaperArticles.publishedAt,
        })
        .from(partyNewspaperArticles)
        .where(eq(partyNewspaperArticles.id, data.articleId))
        .for("update");
      if (!article || !actor?.active || actor.partyId !== article.partyId)
        throw new Error("Article not found or access denied");
      const [party] = await tx
        .select({ id: parties.id, name: parties.name })
        .from(parties)
        .where(
          and(
            eq(parties.id, article.partyId),
            eq(parties.socialMediaOfficerId, actor.id),
            isNull(parties.archivedAt),
          ),
        )
        .limit(1);
      if (!party)
        throw new Error(
          "Only the Social Media Officer can edit or publish articles",
        );
      await tx
        .update(partyNewspaperArticles)
        .set({
          title: data.title,
          content: data.content,
          publishedAt:
            article.publishedAt ?? (data.publish ? new Date() : null),
        })
        .where(eq(partyNewspaperArticles.id, data.articleId));
      if (data.publish && !article.publishedAt)
        await tx.insert(feed).values({
          userId: actor.id,
          content: `published ${data.title} in the ${party.name} newspaper`,
        });
      return true;
    });
  });
