import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, FileText, PenLine, Search, Send, Users, X } from "lucide-react";
import type { SocialEntry } from "@/components/social/social-timeline";
import { SocialTimeline } from "@/components/social/social-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ProtectedRoute from "@/components/auth/protected-route";
import { PartyMark, WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage } from "@/components/wiki/wiki-layout";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { ReferenceInsert } from "@/components/reference-insert";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import { createSocialPost, getSocialFeed } from "@/lib/server/social";
import { searchDiscussionBills } from "@/lib/server/bill-comments";
import { billCommentPostContent } from "@/lib/bill-comment-post";

type AccountFilter = "all" | "players" | "parties" | "potro";
type FeedSort = "newest" | "popular" | "least-popular";
type BillOption = Awaited<ReturnType<typeof searchDiscussionBills>>[number];

export const Route = createFileRoute("/social")({
  validateSearch: (search: Record<string, unknown>) => ({
    postId:
      Number.isInteger(Number(search.postId)) && Number(search.postId) > 0
        ? Number(search.postId)
        : undefined,
    commentId:
      Number.isInteger(Number(search.commentId)) && Number(search.commentId) > 0
        ? Number(search.commentId)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ postId: search.postId }),
  loader: async ({ deps }) => {
    const [feed, focused] = await Promise.all([
      getSocialFeed({ data: { limit: 20, offset: 0 } }),
      deps.postId
        ? getSocialFeed({ data: { limit: 1, offset: 0, postId: deps.postId } })
        : Promise.resolve(null),
    ]);
    return { ...feed, focusedEntry: focused?.entries[0] ?? null };
  },
  component: SocialPage,
});

function SocialPage() {
  const {
    viewer,
    entries: initialEntries,
    focusedEntry,
  } = Route.useLoaderData();
  const { postId, commentId } = Route.useSearch();
  const [entries, setEntries] = useState<Array<SocialEntry>>(initialEntries);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postAs, setPostAs] = useState<"player" | "potro" | "party">("player");
  const [hasMore, setHasMore] = useState(initialEntries.length === 20);
  const [account, setAccount] = useState<AccountFilter>("all");
  const [sort, setSort] = useState<FeedSort>("newest");
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [billPickerOpen, setBillPickerOpen] = useState(false);
  const [billQuery, setBillQuery] = useState("");
  const [billOptions, setBillOptions] = useState<Array<BillOption>>([]);
  const [billSearchLoading, setBillSearchLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillOption | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!billPickerOpen || postAs !== "player") return;
    let active = true;
    setBillSearchLoading(true);
    const timeout = setTimeout(() => {
      searchDiscussionBills({ data: { query: billQuery } })
        .then((options) => {
          if (active) { setBillOptions(options); setBillSearchLoading(false); }
        })
        .catch(() => {
          if (active) { setBillOptions([]); setBillSearchLoading(false); }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [billQuery, billPickerOpen, postAs]);

  const refresh = async () => {
    const desired = Math.max(20, entries.length);
    const updated: Array<SocialEntry> = [];
    while (updated.length < desired + 1) {
      const limit = Math.min(50, desired + 1 - updated.length);
      const page = await getSocialFeed({
        data: { limit, offset: updated.length, account, sort },
      });
      updated.push(...page.entries);
      if (page.entries.length < limit) break;
    }
    setEntries(updated.slice(0, desired));
    setHasMore(updated.length > desired);
  };

  const changeFeed = async (nextAccount: AccountFilter, nextSort: FeedSort) => {
    setFeedBusy(true);
    setFeedError(null);
    try {
      const result = await getSocialFeed({
        data: { limit: 21, offset: 0, account: nextAccount, sort: nextSort },
      });
      setAccount(nextAccount);
      setSort(nextSort);
      setEntries(result.entries.slice(0, 20));
      setHasMore(result.entries.length > 20);
    } catch {
      setFeedError("Could not update the feed. Please try again.");
    } finally {
      setFeedBusy(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createSocialPost({
        data: {
          content,
          accountKey: postAs,
          ...(selectedBill ? { billId: selectedBill.id } : {}),
          ...(postAs === "party" && viewer?.partyId
            ? { partyId: viewer.partyId }
            : {}),
        },
      });
      setContent("");
      setSelectedBill(null);
      setShowPreview(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post");
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    setFeedBusy(true);
    setFeedError(null);
    try {
      const next = await getSocialFeed({
        data: { limit: 21, offset: entries.length, account, sort },
      });
      setEntries((current) => [...current, ...next.entries.slice(0, 20)]);
      setHasMore(next.entries.length > 20);
    } catch {
      setFeedError("Could not load more posts. Please try again.");
    } finally {
      setFeedBusy(false);
    }
  };

  return (
    <ProtectedRoute>
      <WikiPage>
        <WikiHeader
          eyebrow="The public square"
          title="Z.com"
          description="Your favourite billionaire-owned social media, great for outreach and promoting your platform."
        />
        <div className="mx-auto grid w-full max-w-7xl items-start gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(12rem,15rem)]">
          <aside className="hidden space-y-5 lg:order-1 lg:sticky lg:top-6 lg:block">
            <Card className="overflow-hidden rounded-2xl shadow-sm">
              <div className="h-16 bg-linear-to-r from-primary/20 via-primary/10 to-muted" />
              <CardContent className="-mt-9 space-y-3 p-5">
                <PlayerAvatar
                  username={viewer?.username ?? "Z"}
                  photoUrl={viewer?.photoUrl}
                  className="size-18 border-4 border-card shadow-sm"
                />
                <div>
                  <p className="font-semibold">
                    @{viewer?.username ?? "Player"}
                  </p>
                  {viewer?.bio && (
                    <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted-foreground">
                      {viewer.bio}
                    </p>
                  )}
                </div>
                <PartyMark
                  name={viewer?.partyName ?? null}
                  color={viewer?.partyColor ?? null}
                />
              </CardContent>
            </Card>
          </aside>

          <section className="order-1 min-w-0 space-y-4 lg:order-2">
            <Card className="overflow-hidden rounded-2xl border-primary/20 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-bold"><PenLine className="size-4 text-primary" /> Create a post</h2>
                <span className="text-xs text-muted-foreground">Share a thought or discuss a bill</span>
              </div>
              <CardContent className="p-5">
                <form onSubmit={submit} className="space-y-4">
                  <label className="block">
                    <span className="sr-only">Write a post</span>
                    <Textarea
                      id="social-post"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder={selectedBill ? `What do you think about Bill #${selectedBill.id}?` : `What's happening, @${viewer?.username ?? "player"}?`}
                      maxLength={280}
                      rows={5}
                      required
                      className="min-h-28 resize-y rounded-xl border-border/80 bg-muted/20 text-sm leading-6 focus-visible:ring-primary/30"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {postAs === "player" && (
                      <Popover open={billPickerOpen} onOpenChange={setBillPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant={selectedBill ? "secondary" : "outline"} size="sm" className="max-w-full gap-1.5">
                            <FileText className="size-4 shrink-0" /> <span className="truncate">{selectedBill ? `Bill #${selectedBill.id}: ${selectedBill.title}` : "Attach a bill"}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <input
                              value={billQuery}
                              onChange={(event) => setBillQuery(event.target.value)}
                              placeholder="Search by title or bill number"
                              aria-label="Search bills"
                              maxLength={100}
                              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                          </div>
                          <div className="mt-2 max-h-60 overflow-y-auto">
                            {!billSearchLoading && billOptions.map((bill) => (
                              <button key={bill.id} type="button" onClick={() => { setSelectedBill(bill); setBillPickerOpen(false); setBillQuery(""); }} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted">
                                <span className="shrink-0 font-semibold text-primary">#{bill.id}</span>
                                <span className="min-w-0"><span className="block line-clamp-2">{bill.title}</span><span className="text-xs text-muted-foreground">{bill.status}</span></span>
                              </button>
                            ))}
                            {billSearchLoading ? <p className="px-2 py-3 text-sm text-muted-foreground">Searching bills…</p> : !billOptions.length && <p className="px-2 py-3 text-sm text-muted-foreground">No bills found.</p>}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {selectedBill && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelectedBill(null)} aria-label="Remove attached bill"><X className="size-4" /></Button>
                    )}
                    <ReferenceInsert textareaId="social-post" value={content} onChange={setContent} />
                    {content.trim() && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((show) => !show)} aria-expanded={showPreview}><Eye className="size-4" /> {showPreview ? "Hide preview" : "Preview"}</Button>
                    )}
                  </div>
                  {selectedBill && <p className="text-xs text-muted-foreground">This post will also appear in Bill #{selectedBill.id}’s discussion.</p>}
                  {showPreview && content.trim() && (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Preview
                      </p>
                      <MarkdownContent
                        content={
                          selectedBill
                            ? billCommentPostContent(selectedBill.id, content)
                            : content
                        }
                        compact
                      />
                    </div>
                  )}
                  {((viewer?.role === "President" && viewer.isActive) ||
                    (viewer?.partyId &&
                      viewer.partyLeaderId === viewer.id)) && (
                    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
                      <span>Posting as</span>
                      <select
                        value={postAs}
                        onChange={(event) => {
                          setPostAs(event.target.value as typeof postAs);
                          setSelectedBill(null);
                          setBillPickerOpen(false);
                        }}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <option value="player">@{viewer.username}</option>
                        {viewer?.partyId &&
                          viewer.partyLeaderId === viewer.id && (
                            <option value="party">
                              {viewer.partyName} party account
                            </option>
                          )}
                        {viewer?.role === "President" && viewer.isActive && (
                          <option value="potro">
                            POTRO · President of Oscana
                          </option>
                        )}
                      </select>
                    </label>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Markdown and linked references supported.</span>
                    <span className="font-mono tabular-nums">
                      {content.length}/280
                    </span>
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full rounded-xl font-semibold"
                    disabled={busy || !content.trim() || content.length > 280}
                  >
                    <Send className="size-4" />{" "}
                    {busy ? "Posting…" : "Publish post"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm">
              <div>
                <h2 className="font-serif text-xl font-bold">
                  The town square
                </h2>
                <p className="text-xs text-muted-foreground">
                  Posts and reposts from across Oscana.
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <span className="size-2 rounded-full bg-primary" /> Live
              </span>
            </div>
            <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter posts by account"
                >
                  {(["all", "players", "parties", "potro"] as const).map(
                    (option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={account === option ? "default" : "ghost"}
                        className="rounded-xl capitalize"
                        disabled={feedBusy}
                        aria-pressed={account === option}
                        onClick={() => changeFeed(option, sort)}
                      >
                        {option === "potro" ? "POTRO" : option}
                      </Button>
                    ),
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  Sort by
                  <select
                    aria-label="Sort posts"
                    value={sort}
                    disabled={feedBusy}
                    onChange={(event) =>
                      changeFeed(account, event.target.value as FeedSort)
                    }
                    className="rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <option value="newest">Newest</option>
                    <option value="popular">Most popular</option>
                    <option value="least-popular">Least popular</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Popularity is upvotes minus downvotes.
              </p>
            </div>
            {feedError && (
              <p role="alert" className="text-sm text-destructive">
                {feedError}
              </p>
            )}
            {focusedEntry && (
              <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <p className="px-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Mentioned here
                </p>
                <SocialTimeline
                  entries={[focusedEntry]}
                  onRefresh={refresh}
                  openCommentsForPostId={commentId ? postId : undefined}
                  highlightCommentId={commentId}
                />
              </div>
            )}
            {postId && !focusedEntry && (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                This post is no longer available.
              </p>
            )}
            <SocialTimeline
              entries={
                focusedEntry
                  ? entries.filter(
                      (entry) =>
                        !(
                          entry.entryType === "post" &&
                          entry.postId === focusedEntry.postId
                        ),
                    )
                  : entries
              }
              onRefresh={refresh}
              emptyMessage={
                focusedEntry
                  ? "No other posts yet."
                  : account === "all"
                    ? undefined
                    : "No posts match this filter yet."
              }
            />
            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={feedBusy}
                  onClick={loadMore}
                >
                  {feedBusy ? "Loading…" : "Load more posts"}
                </Button>
              </div>
            )}
          </section>

            <aside className="hidden space-y-5 xl:order-3 xl:block">
            <Card className="overflow-hidden rounded-2xl shadow-sm">
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Official account
                </p>
                <SocialAccountAvatar account="potro" />
                <div>
                  <h2 className="font-serif text-lg font-bold">POTRO</h2>
                  <p className="text-sm leading-5 text-muted-foreground">
                    President of The Republic of Oscana
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-muted/20 shadow-sm">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Users className="size-4 text-primary" /> About Z.com
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  A public square for players, parties, and the presidency. Keep
                  it civil; everyone can see your posts.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </WikiPage>
    </ProtectedRoute>
  );
}
