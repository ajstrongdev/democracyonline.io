import { Link, createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getWikiRevisions,
  wikiEntityTypeSchema,
} from "@/lib/server/wiki-articles";
import { formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/revisions/$entityType/$entityId")({
  loader: async ({ params }) => {
    const entityType = wikiEntityTypeSchema.parse(params.entityType);
    const revisions = await getWikiRevisions({
      data: { entityType, entityId: params.entityId },
    });
    return { entityType, entityId: params.entityId, revisions };
  },
  component: RevisionHistory,
});

function RevisionHistory() {
  const { entityType, entityId, revisions } = Route.useLoaderData();
  const articleUrl = getArticleUrl(entityType, entityId);
  return (
    <WikiPage width="article">
      <WikiHeader
        eyebrow="Revision log"
        title="Article history"
        description="Every published change is retained with its editor, timestamp, and edit summary."
      />
      <div className="flex items-center justify-between border-b pb-3">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          {revisions.length} {revisions.length === 1 ? "revision" : "revisions"}
        </p>
        <Link
          to={articleUrl as any}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Return to article
        </Link>
      </div>
      <section className="space-y-3">
        {revisions.map((revision, index) => (
          <Card key={revision.id} className="rounded-sm shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 font-serif text-xl">
                    <History className="h-4 w-4" /> {revision.editSummary}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {revision.editorUserId ? (
                      <Link
                        to="/dashboard/players/$playerId"
                        params={{ playerId: String(revision.editorUserId) }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {revision.editorUsername}
                      </Link>
                    ) : (
                      revision.editorUsername
                    )}{" "}
                    on {formatWikiDate(revision.createdAt)}
                  </p>
                </div>
                {index === 0 && <Badge>Current revision</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Read this revision
                </summary>
                <div className="mt-4 border-t pt-4">
                  <MarkdownContent content={revision.content} />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
        {!revisions.length && (
          <WikiEmpty>
            No revisions have been published for this article.
          </WikiEmpty>
        )}
      </section>
    </WikiPage>
  );
}

function getArticleUrl(entityType: string, entityId: string) {
  if (entityType === "player") return `/dashboard/players/${entityId}`;
  if (entityType === "bill") return `/dashboard/bills/${entityId}`;
  if (entityType === "election") return `/dashboard/elections/${entityId}`;
  if (entityType === "party") return `/dashboard/parties/${entityId}`;
  return "/dashboard/government";
}
