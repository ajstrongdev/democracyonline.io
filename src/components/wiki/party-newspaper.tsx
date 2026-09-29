import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WikiSection } from "@/components/wiki/wiki-layout";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import {
  editPartyArticle,
  submitPartyArticle,
} from "@/lib/server/organizations/newspaper";

type Article = {
  id: number;
  title: string;
  content: string;
  publishedAt: Date | null;
  author: string | null;
};

function ArticleEditor({ article }: { article: Article }) {
  const router = useRouter();
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [busy, setBusy] = useState(false);
  const save = async (publish: boolean) => {
    setBusy(true);
    try {
      await editPartyArticle({
        data: { articleId: article.id, title, content, publish },
      });
      await router.invalidate();
      toast.success(publish ? "Article published" : "Draft updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save article",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm">
        Submitted by {article.author ?? "former member"} ·{" "}
        {article.publishedAt ? "Published" : "Awaiting publication"}
      </p>
      <Input
        aria-label="Article title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Textarea
        aria-label="Article content"
        value={content}
        maxLength={20_000}
        rows={6}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex gap-2">
        <Button disabled={busy} variant="outline" onClick={() => save(false)}>
          Save edits
        </Button>
        {!article.publishedAt && (
          <Button disabled={busy} onClick={() => save(true)}>
            Publish article
          </Button>
        )}
      </div>
    </div>
  );
}

export function PartyNewspaper({
  partyId,
  articles,
  canSubmit,
  isOfficer,
}: {
  partyId: number;
  articles: Array<Article>;
  canSubmit: boolean;
  isOfficer: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <WikiSection
      title="Party newspaper"
      description="Members submit articles. Only the Social Media Officer can edit and publish them."
    >
      {canSubmit && (
        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await submitPartyArticle({ data: { partyId, title, content } });
              setTitle("");
              setContent("");
              await router.invalidate();
              toast.success("Article sent to the Social Media Officer");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not submit article",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold">Submit an article</h3>
          <Input
            aria-label="Newspaper headline"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            aria-label="Newspaper article"
            required
            maxLength={20_000}
            value={content}
            rows={5}
            onChange={(event) => setContent(event.target.value)}
          />
          <Button disabled={busy} type="submit">
            Submit for review
          </Button>
        </form>
      )}
      <div className="mt-4 space-y-4">
        {articles.length ? (
          articles.map((article) =>
            isOfficer ? (
              <ArticleEditor key={article.id} article={article} />
            ) : (
              <article key={article.id} className="rounded-lg border p-4">
                <h3 className="font-serif text-xl font-semibold">
                  {article.title}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  By {article.author ?? "a former member"}
                </p>
                <MarkdownContent content={article.content} />
              </article>
            ),
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            No articles published yet.
          </p>
        )}
      </div>
    </WikiSection>
  );
}
