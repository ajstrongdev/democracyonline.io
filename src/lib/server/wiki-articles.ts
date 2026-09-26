import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  archivedParties,
  bills,
  electionCandidateHistory,
  electionHistory,
  elections,
  feed,
  parties,
  users,
  wikiArticleRevisions,
  wikiArticles,
} from "@/db/schema";
import { userEmailEquals } from "@/lib/server/user-email";
import { requireAuthMiddleware } from "@/middleware";

export const wikiEntityTypeSchema = z.enum([
  "player",
  "bill",
  "election",
  "party",
  "government",
]);
export type WikiEntityType = z.infer<typeof wikiEntityTypeSchema>;

const articleKeySchema = z.object({
  entityType: wikiEntityTypeSchema,
  entityId: z.string().trim().min(1).max(100),
});

const saveArticleSchema = articleKeySchema.extend({
  content: z.string().trim().max(50_000),
  editSummary: z.string().trim().min(3).max(255),
  baseRevisionId: z.number().int().positive().nullable(),
});

async function entityExists(
  entityType: z.infer<typeof wikiEntityTypeSchema>,
  entityId: string,
) {
  if (entityType === "government") return entityId === "overview";
  if (entityType === "election" && entityId.startsWith("current-")) {
    const name = entityId.slice(8);
    if (name !== "President" && name !== "Senate") return false;
    const [row] = await db
      .select({ id: elections.election })
      .from(elections)
      .where(eq(elections.election, name))
      .limit(1);
    return Boolean(row);
  }

  const numericId = Number(entityId);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;
  if (entityType === "player") {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);
    return Boolean(row);
  }
  if (entityType === "bill") {
    const [row] = await db
      .select({ id: bills.id })
      .from(bills)
      .where(eq(bills.id, numericId))
      .limit(1);
    return Boolean(row);
  }
  if (entityType === "election") {
    const [row] = await db
      .select({ id: electionHistory.id })
      .from(electionHistory)
      .where(eq(electionHistory.id, numericId))
      .limit(1);
    return Boolean(row);
  }

  const [current, archived, historical] = await Promise.all([
    db
      .select({ id: parties.id })
      .from(parties)
      .where(eq(parties.id, numericId))
      .limit(1),
    db
      .select({ id: archivedParties.partyId })
      .from(archivedParties)
      .where(eq(archivedParties.partyId, numericId))
      .limit(1),
    db
      .select({ id: electionCandidateHistory.partyId })
      .from(electionCandidateHistory)
      .where(eq(electionCandidateHistory.partyId, numericId))
      .limit(1),
  ]);
  return Boolean(current[0] || archived[0] || historical[0]);
}

export const getWikiArticle = createServerFn()
  .inputValidator(articleKeySchema)
  .handler(async ({ data }) => {
    const [article] = await db
      .select({ id: wikiArticles.id, updatedAt: wikiArticles.updatedAt })
      .from(wikiArticles)
      .where(
        and(
          eq(wikiArticles.entityType, data.entityType),
          eq(wikiArticles.entityId, data.entityId),
        ),
      )
      .limit(1);
    if (!article) {
      return {
        content: "",
        revisionId: null,
        revisionCount: 0,
        editorUsername: null,
        updatedAt: null,
      };
    }
    const [latestRows, count] = await Promise.all([
      db
        .select({
          id: wikiArticleRevisions.id,
          content: wikiArticleRevisions.content,
          editorUsername: wikiArticleRevisions.editorUsername,
          createdAt: wikiArticleRevisions.createdAt,
        })
        .from(wikiArticleRevisions)
        .where(eq(wikiArticleRevisions.articleId, article.id))
        .orderBy(desc(wikiArticleRevisions.id))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(wikiArticleRevisions)
        .where(eq(wikiArticleRevisions.articleId, article.id)),
    ]);
    const latest = latestRows[0];
    return {
      content: latest?.content ?? "",
      revisionId: latest?.id ?? null,
      revisionCount: count[0]?.count ?? 0,
      editorUsername: latest?.editorUsername ?? null,
      updatedAt: latest?.createdAt ?? article.updatedAt,
    };
  });

export const saveWikiArticle = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(saveArticleSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    if (!(await entityExists(data.entityType, data.entityId))) {
      throw new Error("The article subject no longer exists");
    }
    const [editor] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!editor) throw new Error("Player account not found");

    return db.transaction(async (tx) => {
      const key = `${data.entityType}:${data.entityId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      let [article] = await tx
        .select({ id: wikiArticles.id })
        .from(wikiArticles)
        .where(
          and(
            eq(wikiArticles.entityType, data.entityType),
            eq(wikiArticles.entityId, data.entityId),
          ),
        )
        .limit(1);
      if (!article) {
        [article] = await tx
          .insert(wikiArticles)
          .values({ entityType: data.entityType, entityId: data.entityId })
          .returning({ id: wikiArticles.id });
      }
      const [latest] = await tx
        .select({ id: wikiArticleRevisions.id })
        .from(wikiArticleRevisions)
        .where(eq(wikiArticleRevisions.articleId, article.id))
        .orderBy(desc(wikiArticleRevisions.id))
        .limit(1);
      if ((latest?.id ?? null) !== data.baseRevisionId) {
        throw new Error(
          "This article changed while you were editing. Reload it before saving.",
        );
      }
      const [revision] = await tx
        .insert(wikiArticleRevisions)
        .values({
          articleId: article.id,
          editorUserId: editor.id,
          editorUsername: editor.username,
          content: data.content,
          editSummary: data.editSummary,
        })
        .returning({ id: wikiArticleRevisions.id });
      await tx
        .update(wikiArticles)
        .set({ updatedAt: new Date() })
        .where(eq(wikiArticles.id, article.id));
      const subject =
        data.entityType === "bill"
          ? `bill #${data.entityId}`
          : data.entityType === "party"
            ? `party #${data.entityId}`
            : `${data.entityType} ${data.entityId}`;
      await tx.insert(feed).values({
        userId: editor.id,
        content: `edited the ${subject} article`,
      });
      return revision;
    });
  });

export const getWikiRevisions = createServerFn()
  .inputValidator(articleKeySchema)
  .handler(async ({ data }) => {
    const [article] = await db
      .select({ id: wikiArticles.id })
      .from(wikiArticles)
      .where(
        and(
          eq(wikiArticles.entityType, data.entityType),
          eq(wikiArticles.entityId, data.entityId),
        ),
      )
      .limit(1);
    if (!article) return [];
    return db
      .select({
        id: wikiArticleRevisions.id,
        editorUserId: wikiArticleRevisions.editorUserId,
        editorUsername: wikiArticleRevisions.editorUsername,
        content: wikiArticleRevisions.content,
        editSummary: wikiArticleRevisions.editSummary,
        createdAt: wikiArticleRevisions.createdAt,
      })
      .from(wikiArticleRevisions)
      .where(eq(wikiArticleRevisions.articleId, article.id))
      .orderBy(desc(wikiArticleRevisions.id));
  });
