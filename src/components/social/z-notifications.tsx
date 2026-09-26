import { useEffect, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowRight, BellOff, X } from "lucide-react";
import type { getZNotificationPage } from "@/lib/server/social-notifications";
import {
  dismissZNotifications,
  getZNotificationPage as fetchNotifications,
} from "@/lib/server/social-notifications";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type NotificationPage = Awaited<ReturnType<typeof getZNotificationPage>>;

dayjs.extend(relativeTime);

export function ZNotifications({
  initialPage,
}: {
  initialPage: NotificationPage;
}) {
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => setPage(initialPage), [initialPage]);

  const dismiss = async (entry?: NotificationPage["entries"][number]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await dismissZNotifications({
        data: entry
          ? {
              scope: "one",
              accountKey: entry.accountKey,
              sourceType: entry.sourceType,
              sourceId: entry.sourceId,
            }
          : { scope: "all" },
      });
      const updated = await fetchNotifications({
        data: { limit: 5, offset: 0 },
      });
      setPage(updated);
      setConfirmAll(false);
    } catch {
      setError("Could not dismiss notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await fetchNotifications({
        data: { limit: 5, offset: page.entries.length },
      });
      setPage((current) => ({
        ...next,
        entries: [...current.entries, ...next.entries],
      }));
    } catch {
      setError("Could not load more notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {page.notifications}{" "}
          {page.notifications === 1 ? "mention" : "mentions"} across{" "}
          {page.accounts} {page.accounts === 1 ? "account" : "accounts"}
        </span>
        {page.notifications > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-lg text-muted-foreground"
            disabled={busy}
            onClick={() => setConfirmAll(true)}
          >
            <BellOff className="size-4" /> Dismiss all
          </Button>
        )}
      </div>
      {page.entries.length ? (
        <div className="space-y-2">
          {page.entries.map((entry) => (
            <article
              key={`${entry.accountKey}-${entry.sourceType}-${entry.sourceId}`}
              className="flex items-start gap-3 rounded-xl border bg-card p-3"
            >
              {entry.sourceAccountKey === "party" ||
              entry.sourceAccountKey === "potro" ? (
                <SocialAccountAvatar
                  account={entry.sourceAccountKey}
                  name={entry.actorUsername}
                  color={entry.sourcePartyColor}
                  logo={entry.sourcePartyLogo}
                  className="size-11 text-sm sm:size-11"
                />
              ) : (
                <PlayerAvatar
                  username={entry.actorUsername}
                  photoUrl={entry.photoUrl}
                  className="size-11"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {entry.sourceAccountKey === "party" ||
                  entry.sourceAccountKey === "potro"
                    ? entry.actorUsername
                    : `@${entry.actorUsername}`}{" "}
                  <span className="font-normal text-muted-foreground">
                    mentioned
                  </span>{" "}
                  {entry.accountLabel}
                </p>
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                  {entry.content}
                </p>
                <time
                  className="mt-1 block text-xs text-muted-foreground"
                  dateTime={new Date(entry.createdAt).toISOString()}
                  title={dayjs(entry.createdAt).format("MMMM D, YYYY h:mm A")}
                >
                  {dayjs(entry.createdAt).fromNow()}
                </time>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={`/social?postId=${entry.postId}${entry.commentId ? `&commentId=${entry.commentId}` : ""}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    View {entry.sourceType === "comment" ? "reply" : "post"}{" "}
                    <ArrowRight className="size-3" />
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-lg px-2 text-xs text-muted-foreground"
                    disabled={busy}
                    onClick={() => dismiss(entry)}
                  >
                    <X className="size-3.5" /> Dismiss
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
          You’re caught up. New mentions will appear here.
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {page.hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl"
          disabled={busy}
          onClick={loadMore}
        >
          Load more mentions
        </Button>
      )}
      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss all notifications?</DialogTitle>
            <DialogDescription>This clears your current Z.com notifications.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAll(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => dismiss()}>Dismiss all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
