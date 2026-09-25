import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { addBillComment, saveBillWhip } from "@/lib/server/bill-comments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { WikiEmpty, WikiSection } from "@/components/wiki/wiki-layout";
import { PlayerAvatar } from "@/components/players/player-avatar";

type BillComment = {
  id: number;
  userId: number | null;
  username: string;
  photoUrl: string | null;
  partyName: string | null;
  isPartyLeader: boolean;
  content: string;
  createdAt: Date;
};

type PartyWhip = {
  id: number;
  partyId: number;
  partyName: string;
  partyColor: string;
  leaderUsername: string | null;
  position: string;
  note: string | null;
  updatedAt: Date;
};

export function BillComments({
  billId,
  comments,
  whips,
  currentPartyId,
  canWhip,
  isVoting,
}: {
  billId: number;
  comments: Array<BillComment>;
  whips: Array<PartyWhip>;
  currentPartyId: number | null;
  canWhip: boolean;
  isVoting: boolean;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentWhip = whips.find((whip) => whip.partyId === currentPartyId);
  const [position, setPosition] = useState<"For" | "Against">(
    currentWhip?.position === "Against" ? "Against" : "For",
  );
  const [whipNote, setWhipNote] = useState(currentWhip?.note ?? "");
  const [whipError, setWhipError] = useState<string | null>(null);
  const [savingWhip, setSavingWhip] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addBillComment({ data: { billId, content } });
      setContent("");
      await router.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to post comment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitWhip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWhipError(null);
    setSavingWhip(true);
    try {
      await saveBillWhip({ data: { billId, position, note: whipNote } });
      await router.invalidate();
    } catch (cause) {
      setWhipError(
        cause instanceof Error
          ? cause.message
          : "Unable to save voting guidance",
      );
    } finally {
      setSavingWhip(false);
    }
  };

  return (
    <WikiSection
      title="Discussion"
      description="Share your thoughts on this bill. Comments are visible to everyone."
      aside={
        <span className="text-xs text-muted-foreground">
          {comments.length} comments
        </span>
      }
    >
      <div className="mb-6 rounded-lg border bg-muted/20 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Party voting guidance</h3>
          <span className="text-xs text-muted-foreground">
            Non-binding: members may vote differently.
          </span>
        </div>
        {whips.length ? (
          <div className="space-y-3">
            {whips.map((whip) => (
              <div
                key={whip.id}
                className="rounded-md border bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: whip.partyColor }}
                  />
                  <strong>{whip.partyName}</strong>
                  <Badge
                    variant={
                      whip.position === "For" ? "default" : "destructive"
                    }
                  >
                    {whip.position}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Guidance from {whip.leaderUsername ?? "party leadership"}
                  </span>
                </div>
                {whip.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {whip.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No party guidance has been issued.
          </p>
        )}
        {canWhip && isVoting && (
          <form onSubmit={submitWhip} className="mt-4 space-y-3 border-t pt-4">
            <label className="block space-y-1 text-sm font-medium">
              <span>Tell your party how to vote</span>
              <select
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value as "For" | "Against")
                }
                className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2"
              >
                <option value="For">Vote For</option>
                <option value="Against">Vote Against</option>
              </select>
            </label>
            <Textarea
              value={whipNote}
              onChange={(event) => setWhipNote(event.target.value)}
              placeholder="Optional note to your party (up to 1,000 characters)"
              maxLength={1_000}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingWhip}>
                {savingWhip
                  ? "Saving…"
                  : currentWhip
                    ? "Update guidance"
                    : "Issue guidance"}
              </Button>
            </div>
            {whipError && (
              <p role="alert" className="text-sm text-destructive">
                {whipError}
              </p>
            )}
          </form>
        )}
      </div>
      {!loading && user ? (
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a comment..."
            maxLength={5_000}
            required
            aria-label="Bill comment"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Up to 5,000 characters
            </span>
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in to join the discussion.
        </p>
      )}
      <div className="mt-5 space-y-4">
        {comments.length ? (
          comments.map((comment) => (
            <article key={comment.id} className="border-t pt-4">
              <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                 <div className="flex flex-wrap items-center gap-2">
                   <PlayerAvatar username={comment.username} photoUrl={comment.photoUrl} className="size-10" />
                   <strong>{comment.username}</strong>
                  <Badge variant="outline">
                    {comment.partyName ?? "Independent"}
                  </Badge>
                  {comment.isPartyLeader && <Badge>Party Leader</Badge>}
                </div>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={new Date(comment.createdAt).toISOString()}
                >
                  {new Date(comment.createdAt).toLocaleString()}
                </time>
              </header>
              <p className="whitespace-pre-wrap break-words text-sm">
                {comment.content}
              </p>
            </article>
          ))
        ) : (
          <WikiEmpty>No comments yet. Start the discussion.</WikiEmpty>
        )}
      </div>
    </WikiSection>
  );
}
