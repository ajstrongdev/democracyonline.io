import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { CommentNode } from "@/lib/social-comment-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PartyMark } from "@/components/wiki/wiki-header";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { ReferenceInsert } from "@/components/reference-insert";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import {
  buildCommentTree,
  countThreadReplies,
} from "@/lib/social-comment-tree";
import {
  addSocialComment,
  getSocialComments,
  toggleSocialCommentVote,
  toggleSocialRepost,
  toggleSocialVote,
} from "@/lib/server/social";

dayjs.extend(relativeTime);

export type SocialEntry = {
  entryType: "post" | "repost";
  entryId: number;
  postId: number;
  actorUserId: number | null;
  actorUsername: string;
  reposterUsername: string | null;
  occurredAt: Date;
  authorUserId: number | null;
  authorUsername: string;
  authorPhotoUrl: string | null;
  accountKey: string | null;
  accountPartyId: number | null;
  accountPartyName: string | null;
  accountPartyColor: string | null;
  accountPartyLogo: string | null;
  publisherUsername: string;
  publisherUserId: number | null;
  authorPartyId: number | null;
  authorPartyName: string | null;
  authorPartyColor: string | null;
  isPartyLeader: boolean;
  content: string;
  commentCount: number;
  score: number;
  repostCount: number;
  viewerLiked: boolean;
  viewerDisliked: boolean;
  viewerReposted: boolean;
};

type SocialComment = {
  id: number;
  parentId: number | null;
  userId: number | null;
  username: string;
  photoUrl: string | null;
  content: string;
  createdAt: Date;
  score: number;
  viewerLiked: boolean;
  viewerDisliked: boolean;
};

export function SocialTimeline({
  entries,
  onRefresh,
  emptyMessage = "It’s quiet on Z.com. Be the first to post.",
  openCommentsForPostId,
  highlightCommentId,
}: {
  entries: Array<SocialEntry>;
  onRefresh: () => Promise<void>;
  emptyMessage?: string;
  openCommentsForPostId?: number;
  highlightCommentId?: number;
}) {
  return (
    <div className="space-y-4">
      {entries.length ? (
        entries.map((entry) => (
          <SocialPost
            key={`${entry.entryType}-${entry.entryId}`}
            entry={entry}
            onRefresh={onRefresh}
            highlightCommentId={
              entry.entryType === "post" &&
              entry.postId === openCommentsForPostId
                ? highlightCommentId
                : undefined
            }
          />
        ))
      ) : (
        <Card className="rounded-2xl border-dashed shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SocialPost({
  entry,
  onRefresh,
  highlightCommentId,
}: {
  entry: SocialEntry;
  onRefresh: () => Promise<void>;
  highlightCommentId?: number;
}) {
  const [comments, setComments] = useState<Array<SocialComment>>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [votingComments, setVotingComments] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const commentTree = buildCommentTree(comments);

  useEffect(() => {
    if (!highlightCommentId) return;
    setCommentsOpen(true);
    setCommentsLoaded(false);
    getSocialComments({ data: { postId: entry.postId } })
      .then((rows) => {
        setComments(rows);
        setCommentsLoaded(true);
      })
      .catch(() => setError("Could not load comments."));
  }, [entry.postId, highlightCommentId]);

  useEffect(() => {
    if (commentsLoaded && highlightCommentId) {
      document
        .getElementById(`z-comment-${highlightCommentId}`)
        ?.scrollIntoView({ block: "center" });
    }
  }, [commentsLoaded, highlightCommentId]);

  const openComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && !commentsLoaded) {
      try {
        const rows = await getSocialComments({
          data: { postId: entry.postId },
        });
        setComments(rows);
        setCommentsLoaded(true);
      } catch {
        setError("Could not load comments.");
      }
    }
  };

  const submitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addSocialComment({
        data: { postId: entry.postId, content: comment },
      });
      setComment("");
      const rows = await getSocialComments({ data: { postId: entry.postId } });
      setComments(rows);
      setCommentsLoaded(true);
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not post comment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const replyToComment = async (parentId: number, content: string) => {
    await addSocialComment({
      data: { postId: entry.postId, parentId, content },
    });
    const rows = await getSocialComments({ data: { postId: entry.postId } });
    setComments(rows);
    setCommentsLoaded(true);
    await onRefresh();
  };

  const vote = async (direction: "up" | "down") => {
    setBusy(true);
    setError(null);
    try {
      await toggleSocialVote({
        data: { postId: entry.postId, vote: direction },
      });
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update vote.",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleRepost = async () => {
    setBusy(true);
    setError(null);
    try {
      await toggleSocialRepost({ data: { postId: entry.postId } });
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update repost.",
      );
    } finally {
      setBusy(false);
    }
  };

  const voteOnComment = async (commentId: number, direction: "up" | "down") => {
    if (votingComments.has(commentId)) return;
    setVotingComments((current) => new Set(current).add(commentId));
    setError(null);
    try {
      const { vote: result } = await toggleSocialCommentVote({
        data: { commentId, vote: direction },
      });
      setComments((current) =>
        current.map((item) =>
          item.id === commentId
            ? {
                ...item,
                score:
                  item.score +
                  (result === "up" ? 1 : result === "down" ? -1 : 0) -
                  (item.viewerLiked ? 1 : item.viewerDisliked ? -1 : 0),
                viewerLiked: result === "up",
                viewerDisliked: result === "down",
              }
            : item,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update reply vote.",
      );
    } finally {
      setVotingComments((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-4 sm:p-6">
        {entry.entryType === "repost" && (
          <p className="flex items-center gap-2 border-b pb-3 text-xs font-medium text-muted-foreground">
            <Repeat2 className="h-3.5 w-3.5" />
            {entry.actorUserId ? (
              <Link
                to="/dashboard/players/$playerId"
                params={{ playerId: String(entry.actorUserId) }}
                className="hover:text-primary hover:underline"
              >
                @{entry.reposterUsername}
              </Link>
            ) : (
              entry.reposterUsername
            )}{" "}
            reposted
          </p>
        )}
        <div className="flex items-start gap-3 sm:gap-4">
          {entry.accountKey === "party" ? (
            <SocialAccountAvatar
              account="party"
              name={entry.accountPartyName}
              color={entry.accountPartyColor}
              logo={entry.accountPartyLogo}
            />
          ) : entry.accountKey === "potro" ? (
            <SocialAccountAvatar account="potro" />
          ) : (
            <PlayerAvatar
              username={entry.authorUsername}
              photoUrl={entry.authorPhotoUrl}
              className="size-14 sm:size-16"
            />
          )}
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1">
                {entry.accountKey === "party" && entry.accountPartyId ? (
                  <Link
                    to="/dashboard/parties/$partyId"
                    params={{ partyId: String(entry.accountPartyId) }}
                    className="font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {entry.accountPartyName ?? entry.authorUsername}
                  </Link>
                ) : entry.authorUserId ? (
                  <Link
                    to="/dashboard/players/$playerId"
                    params={{ playerId: String(entry.authorUserId) }}
                    className="font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    @{entry.authorUsername}
                  </Link>
                ) : (
                  <strong className="text-foreground">
                    @{entry.authorUsername}
                  </strong>
                )}
                {entry.accountKey === "potro" ? (
                  <Badge>Official account</Badge>
                ) : entry.accountKey === "party" ? (
                  <Badge variant="outline">Party account</Badge>
                ) : (
                  entry.isPartyLeader && (
                    <Badge variant="outline">Party leader</Badge>
                  )
                )}
                {entry.accountKey !== "party" &&
                  entry.accountKey !== "potro" &&
                  entry.authorPartyId && (
                    <PartyMark
                      name={entry.authorPartyName}
                      color={entry.authorPartyColor}
                    />
                  )}
              </div>
              <time
                className="shrink-0 pt-1 text-xs text-muted-foreground"
                dateTime={new Date(entry.occurredAt).toISOString()}
                title={dayjs(entry.occurredAt).format("MMMM D, YYYY h:mm A")}
              >
                {dayjs(entry.occurredAt).fromNow()}
              </time>
            </header>
            {entry.accountKey === "party" && (
              <p className="text-xs text-muted-foreground">
                @
                {entry.accountPartyName
                  ?.toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")}
                {" · "}
                Posted by{" "}
                {entry.publisherUserId ? (
                  <Link
                    to="/dashboard/players/$playerId"
                    params={{ playerId: String(entry.publisherUserId) }}
                    className="hover:text-primary hover:underline"
                  >
                    @{entry.publisherUsername}
                  </Link>
                ) : (
                  `@${entry.publisherUsername}`
                )}
              </p>
            )}
            <div className="mt-3"><MarkdownContent content={entry.content} compact /></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <div
            className="inline-flex items-center rounded-xl border bg-muted/30 p-0.5"
            aria-label={`Post score ${entry.score}`}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={`rounded-lg ${entry.viewerLiked ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              aria-label={entry.viewerLiked ? "Remove upvote" : "Upvote post"}
              aria-pressed={entry.viewerLiked}
              disabled={busy}
              onClick={() => vote("up")}
            >
              <ArrowBigUp
                className={`size-5 ${entry.viewerLiked ? "fill-current" : ""}`}
              />
            </Button>
            <span
              className="min-w-8 px-1 text-center font-mono text-sm font-bold tabular-nums"
              aria-live="polite"
            >
              {entry.score}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={`rounded-lg ${entry.viewerDisliked ? "bg-rose-500/15 text-rose-600" : "text-muted-foreground"}`}
              aria-label={
                entry.viewerDisliked ? "Remove downvote" : "Downvote post"
              }
              aria-pressed={entry.viewerDisliked}
              disabled={busy}
              onClick={() => vote("down")}
            >
              <ArrowBigDown
                className={`size-5 ${entry.viewerDisliked ? "fill-current" : ""}`}
              />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Show comments"
            aria-expanded={commentsOpen}
            disabled={busy}
            onClick={openComments}
            className="rounded-xl px-3 text-muted-foreground"
          >
            <MessageCircle className="mr-1 h-4 w-4" /> {entry.commentCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={entry.viewerReposted ? "Undo repost" : "Repost"}
            aria-pressed={entry.viewerReposted}
            disabled={busy}
            onClick={toggleRepost}
            className={`rounded-xl px-3 ${entry.viewerReposted ? "bg-emerald-500/10 text-emerald-700" : "text-muted-foreground"}`}
          >
            <Repeat2 className="mr-1 h-4 w-4" /> {entry.repostCount}
          </Button>
        </div>
        {error && !commentsOpen && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {commentsOpen && (
          <div className="space-y-3 border-t pt-4">
            {commentTree.map((node) => (
              <CommentThread
                key={node.comment.id}
                node={node}
                depth={0}
                votingComments={votingComments}
                onVote={voteOnComment}
                onReply={replyToComment}
                highlightCommentId={highlightCommentId}
              />
            ))}
            {!comments.length && commentsLoaded && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
            <form
              onSubmit={submitComment}
              className="space-y-3 rounded-xl border bg-background p-3 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Markdown and references supported</span>
                <ReferenceInsert textareaId={`social-comment-${entry.postId}`} value={comment} onChange={setComment} />
              </div>
              <Textarea
                id={`social-comment-${entry.postId}`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment…"
                maxLength={2_000}
                required
                rows={2}
                className="rounded-xl"
              />
              <div className="flex items-center justify-between gap-3">
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  size="sm"
                  type="submit"
                  className="rounded-xl"
                  disabled={busy || !comment.trim() || comment.length > 2_000}
                >
                  Post comment
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentThread({
  node,
  depth,
  votingComments,
  onVote,
  onReply,
  highlightCommentId,
}: {
  node: CommentNode<SocialComment>;
  depth: number;
  votingComments: Set<number>;
  onVote: (id: number, direction: "up" | "down") => Promise<void>;
  onReply: (parentId: number, content: string) => Promise<void>;
  highlightCommentId?: number;
}) {
  const { comment, replies } = node;
  const [collapsed, setCollapsed] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyCount = countThreadReplies(node);

  const submitReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReplyBusy(true);
    setReplyError(null);
    try {
      await onReply(comment.id, replyText);
      setReplyText("");
      setReplyOpen(false);
      setCollapsed(false);
    } catch (cause) {
      setReplyError(
        cause instanceof Error ? cause.message : "Could not post reply.",
      );
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div
      className={
        depth > 0
          ? "ml-3 border-l-2 border-primary/20 pl-3 sm:ml-6 sm:pl-4"
          : ""
      }
    >
      <article
        id={`z-comment-${comment.id}`}
        className={`rounded-xl border p-3 sm:p-4 ${comment.id === highlightCommentId ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "bg-muted/20"}`}
      >
        <div className="flex items-start gap-3">
          <PlayerAvatar
            username={comment.username}
            photoUrl={comment.photoUrl}
            className="size-10 sm:size-11"
          />
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {comment.userId ? (
                <Link
                  to="/dashboard/players/$playerId"
                  params={{ playerId: String(comment.userId) }}
                  className="font-semibold hover:text-primary hover:underline"
                >
                  @{comment.username}
                </Link>
              ) : (
                <strong>@{comment.username}</strong>
              )}
              <time
                className="text-xs text-muted-foreground"
                dateTime={new Date(comment.createdAt).toISOString()}
              >
                {dayjs(comment.createdAt).fromNow()}
              </time>
            </div>
            <div className="mt-1">
              <MarkdownContent content={comment.content} compact />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center rounded-xl border bg-background p-0.5"
                aria-label={`Reply score ${comment.score}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={`rounded-lg ${comment.viewerLiked ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                  aria-label={
                    comment.viewerLiked
                      ? `Remove upvote on reply by ${comment.username}`
                      : `Upvote reply by ${comment.username}`
                  }
                  aria-pressed={comment.viewerLiked}
                  disabled={votingComments.has(comment.id)}
                  onClick={() => onVote(comment.id, "up")}
                >
                  <ArrowBigUp
                    className={`size-4 ${comment.viewerLiked ? "fill-current" : ""}`}
                  />
                </Button>
                <span
                  className="min-w-7 px-1 text-center font-mono text-xs font-bold tabular-nums"
                  aria-live="polite"
                >
                  {comment.score}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={`rounded-lg ${comment.viewerDisliked ? "bg-rose-500/15 text-rose-600" : "text-muted-foreground"}`}
                  aria-label={
                    comment.viewerDisliked
                      ? `Remove downvote on reply by ${comment.username}`
                      : `Downvote reply by ${comment.username}`
                  }
                  aria-pressed={comment.viewerDisliked}
                  disabled={votingComments.has(comment.id)}
                  onClick={() => onVote(comment.id, "down")}
                >
                  <ArrowBigDown
                    className={`size-4 ${comment.viewerDisliked ? "fill-current" : ""}`}
                  />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground"
                aria-expanded={replyOpen}
                onClick={() => setReplyOpen((value) => !value)}
              >
                <MessageCircle className="size-4" /> Reply
              </Button>
              {replyCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-muted-foreground"
                  aria-expanded={!collapsed}
                  aria-controls={`comment-replies-${comment.id}`}
                  onClick={() => setCollapsed((value) => !value)}
                >
                  {collapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  {collapsed ? "Show" : "Hide"} {replyCount}{" "}
                  {replyCount === 1 ? "reply" : "replies"}
                </Button>
              )}
            </div>
            {replyOpen && (
              <form
                onSubmit={submitReply}
                className="mt-3 space-y-2 rounded-xl border bg-background p-3"
              >
                <div className="flex justify-end">
                  <ReferenceInsert textareaId={`social-reply-${comment.id}`} value={replyText} onChange={setReplyText} />
                </div>
                <Textarea
                  id={`social-reply-${comment.id}`}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={`Reply to @${comment.username}…`}
                  maxLength={2_000}
                  rows={2}
                  required
                  className="rounded-xl"
                  aria-label={`Reply to ${comment.username}`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {replyError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {replyError}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Replies can be threaded.
                    </span>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    className="rounded-xl"
                    disabled={replyBusy || !replyText.trim() || replyText.length > 2_000}
                  >
                    {replyBusy ? "Posting…" : "Post reply"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </article>
      {replies.length > 0 && (
        <div
          id={`comment-replies-${comment.id}`}
          hidden={collapsed}
          className="mt-2 space-y-2"
        >
          {!collapsed &&
            replies.map((reply) => (
              <CommentThread
                key={reply.comment.id}
                node={reply}
                depth={depth + 1}
                votingComments={votingComments}
                onVote={onVote}
                onReply={onReply}
                highlightCommentId={highlightCommentId}
              />
            ))}
        </div>
      )}
    </div>
  );
}
