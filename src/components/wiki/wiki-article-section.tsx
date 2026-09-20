import { Link, useRouter } from "@tanstack/react-router";
import { BookOpen, Eye, History, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MarkdownContent } from "./markdown-content";
import type { WikiEntityType } from "@/lib/server/wiki-articles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { saveWikiArticle } from "@/lib/server/wiki-articles";
import { formatWikiDate } from "@/lib/utils/history";

type WikiArticleData = {
  content: string;
  revisionId: number | null;
  revisionCount: number;
  editorUsername: string | null;
  updatedAt: Date | null;
};

export function WikiArticleSection({
  entityType,
  entityId,
  article,
}: {
  entityType: WikiEntityType;
  entityId: string;
  article: WikiArticleData;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(article.content);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const isPartyPlatform = entityType === "party";

  const cancel = () => {
    setContent(article.content);
    setSummary("");
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveWikiArticle({
        data: {
          entityType,
          entityId,
          content,
          editSummary: summary,
          baseRevisionId: article.revisionId,
        },
      });
      toast.success("Article revision published");
      setEditing(false);
      await router.invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save article",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="wiki-section overflow-hidden">
      <header className="wiki-section-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="wiki-section-title">
              <BookOpen className="h-5 w-5" />
              {isPartyPlatform ? "Platform" : "Article"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {article.updatedAt
                ? `Last edited ${formatWikiDate(article.updatedAt)} by ${article.editorUsername}`
                : "This article has not yet been written."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/dashboard/revisions/$entityType/$entityId"
                params={{ entityType, entityId }}
              >
                <History className="h-4 w-4" /> History ({article.revisionCount}
                )
              </Link>
            </Button>
            {user && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="wiki-section-content px-5 py-6 sm:px-7">
        {editing ? (
          <div className="space-y-4">
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">
                  <Pencil className="h-4 w-4" /> Source
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4" /> Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-80 font-mono text-sm"
                  maxLength={50_000}
                  placeholder={
                    isPartyPlatform
                      ? "Write the party platform in Markdown..."
                      : "Write the history, context, and lore for this subject in Markdown..."
                  }
                />
              </TabsContent>
              <TabsContent
                value="preview"
                className="min-h-80 rounded-md border p-5"
              >
                {content ? (
                  <MarkdownContent content={content} />
                ) : (
                  <EmptyArticle isPartyPlatform={isPartyPlatform} />
                )}
              </TabsContent>
            </Tabs>
            <Input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={255}
              placeholder="Briefly describe your changes"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancel} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving || summary.trim().length < 3}
              >
                <Save className="h-4 w-4" />{" "}
                {saving ? "Publishing..." : "Publish revision"}
              </Button>
            </div>
          </div>
        ) : article.content ? (
          <MarkdownContent content={article.content} />
        ) : (
          <EmptyArticle isPartyPlatform={isPartyPlatform} />
        )}
      </div>
    </section>
  );
}

function EmptyArticle({
  isPartyPlatform = false,
}: {
  isPartyPlatform?: boolean;
}) {
  return (
    <div className="py-10 text-center text-muted-foreground">
      <p className="font-serif text-lg">
        {isPartyPlatform
          ? "No platform has been published yet."
          : "No narrative has been written yet."}
      </p>
      <p className="mt-1 text-sm">
        {isPartyPlatform
          ? "Sign in to publish the party's Markdown platform."
          : "Sign in to add sourced history, context, and lore."}
      </p>
    </div>
  );
}
