import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Vote } from "lucide-react";
import { toast } from "sonner";
import type { getPrimaryRaces } from "@/lib/server/organizations/primaries";
import { MessageDialog } from "@/components/message-dialog";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { DashboardElectionCountdown } from "@/components/dashboard/dashboard-election-countdown";
import { WikiSection } from "@/components/wiki/wiki-layout";
import { Button } from "@/components/ui/button";
import { voteInPrimary } from "@/lib/server/organizations/primaries";

type Race = Awaited<ReturnType<typeof getPrimaryRaces>>[number];

export function PrimaryRaces({
  races,
  title = "Primary races",
  detailsLink = true,
}: {
  races: Array<Race>;
  title?: string;
  compact?: boolean;
  detailsLink?: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<{
    race: Race;
    candidate: Race["candidates"][number];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  if (!races.length) return null;
  const currentIndex = Math.min(index, races.length - 1);
  const race = races[currentIndex];
  const total = race.candidates.reduce(
    (sum, candidate) => sum + candidate.votes,
    0,
  );
  const navigate = (direction: number) =>
    setIndex((previous) =>
      Math.max(0, Math.min(races.length - 1, previous + direction)),
    );

  return (
    <WikiSection
      title={title}
      icon={Vote}
      aside={
        detailsLink ? (
          <Link
            to="/dashboard/parties/primaries"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Primary details <ArrowRight className="size-3.5" />
          </Link>
        ) : undefined
      }
    >
      <div
        className="border bg-card"
        onTouchStart={(event) =>
          setTouchStart(
            event.touches[0]
              ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
              : null,
          )
        }
        onTouchEnd={(event) => {
          if (touchStart === null) return;
          const distance = event.changedTouches[0]?.clientX - touchStart.x;
          const vertical = event.changedTouches[0]?.clientY - touchStart.y;
          if (
            Math.abs(distance) > 60 &&
            Math.abs(distance) > Math.abs(vertical) * 1.5
          )
            navigate(distance < 0 ? 1 : -1);
          setTouchStart(null);
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-2 py-2 sm:px-3"
          style={{ borderLeft: `4px solid ${race.color}` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Link
                to={
                  race.kind === "coalition"
                    ? "/dashboard/parties/coalitions/$id"
                    : "/dashboard/parties/$partyId"
                }
                params={
                  race.kind === "coalition"
                    ? { id: String(race.id) }
                    : { partyId: String(race.id) }
                }
                className="font-serif text-base font-bold hover:text-primary"
              >
                {race.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {race.kind} primary · Live
              </span>
              {race.canVote && (
                <span className="text-xs font-semibold text-primary">
                  {race.votedCandidateId
                    ? "You voted · changes open"
                    : race.candidates.length
                      ? "Your vote needed"
                      : "Awaiting candidates"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "vote" : "votes"} cast ·{" "}
              {race.candidates.length}{" "}
              {race.candidates.length === 1 ? "candidate" : "candidates"}
              {race.deadline && (
                <>
                  {" "}
                  · Ends in{" "}
                  <DashboardElectionCountdown
                    target={race.deadline}
                    onExpire={() => void router.invalidate()}
                  />
                </>
              )}
            </p>
          </div>
          {races.length > 1 && (
            <div
              className="flex shrink-0 items-center gap-0.5"
              aria-label="Browse primary races"
            >
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                aria-label="Previous primary"
                disabled={currentIndex === 0}
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span
                className="min-w-9 text-center font-mono text-xs tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {currentIndex + 1}/{races.length}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                aria-label="Next primary"
                disabled={currentIndex === races.length - 1}
                onClick={() => navigate(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="divide-y px-3 sm:px-4" key={race.key}>
          {!race.candidates.length && (
            <p className="py-3 text-sm text-muted-foreground">
              No candidates have declared yet.
            </p>
          )}
          {race.candidates.map((candidate) => {
            const percentage = total
              ? Math.round((candidate.votes / total) * 100)
              : 0;
            const selected = race.votedCandidateId === candidate.id;
            return (
              <div
                key={candidate.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,12rem)_auto]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <PlayerAvatar
                    username={candidate.username}
                    photoUrl={candidate.photoUrl}
                    className="size-7 shrink-0"
                  />
                  <div className="min-w-0 text-sm leading-tight">
                    <Link
                      to="/dashboard/players/$playerId"
                      params={{ playerId: String(candidate.userId) }}
                      className="block truncate font-semibold hover:text-primary"
                    >
                      {candidate.username}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.partyName}
                      {selected ? " · Your vote" : ""}
                    </span>
                  </div>
                </div>
                <div
                  className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1"
                  aria-label={`${candidate.votes} votes, ${percentage}%`}
                >
                  <div className="flex justify-between gap-2 font-mono text-xs tabular-nums">
                    <span>
                      {candidate.votes}{" "}
                      {candidate.votes === 1 ? "vote" : "votes"}
                    </span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: candidate.partyColor,
                      }}
                    />
                  </div>
                </div>
                {race.canVote && !selected && (
                  <Button
                    size="sm"
                    variant={race.votedCandidateId ? "outline" : "default"}
                    className="col-start-2 row-span-2 h-8 text-xs sm:col-start-3 sm:row-span-1"
                    disabled={busy}
                    onClick={() => setSelection({ race, candidate })}
                  >
                    {race.votedCandidateId ? "Change vote" : "Vote"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <MessageDialog
        open={Boolean(selection)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelection(null);
        }}
        title={
          selection?.race.votedCandidateId
            ? "Change your primary vote"
            : "Cast your primary vote"
        }
        description={`Vote for ${selection?.candidate.username ?? "this candidate"} in the ${selection?.race.name} primary? You can change your vote until the primary closes.`}
        confirmText={selection?.race.votedCandidateId ? "Change vote" : "Vote"}
        onConfirm={async () => {
          if (!selection || busy) return;
          setBusy(true);
          try {
            await voteInPrimary({
              data: { candidateId: selection.candidate.id },
            });
            setSelection(null);
            toast.success("Primary vote recorded");
            await router.invalidate();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not cast vote",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
    </WikiSection>
  );
}
