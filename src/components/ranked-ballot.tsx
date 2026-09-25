import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  ListRestart,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import type { DragEvent } from "react";
import type { Candidate, VotingStatus } from "@/lib/server/elections";
import { submitRankedBallot } from "@/lib/server/elections";
import { CandidateAffiliationBadges } from "@/components/candidate-affiliation-badges";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RankedBallot({
  election,
  candidates,
  votingStatus,
  onSubmitted,
}: {
  election: "President" | "Senate";
  candidates: Array<Candidate>;
  votingStatus: VotingStatus | null;
  onSubmitted: () => void;
}) {
  const alphabetizedCandidates = [...candidates].sort((a, b) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
  );
  const [ranking, setRanking] = useState(() =>
    alphabetizedCandidates.map((candidate) => candidate.id),
  );
  const [draggedCandidateId, setDraggedCandidateId] = useState<number | null>(
    null,
  );
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  useEffect(() => {
    const candidateIds = [...candidates]
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
      .map((candidate) => candidate.id);
    setRanking((current) => {
      const rosterUnchanged =
        current.length === candidateIds.length &&
        current.every((id) => candidateIds.includes(id));
      return rosterUnchanged ? current : candidateIds;
    });
  }, [candidates]);

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ranking.length) return;
    setRanking((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const resetRanking = () => {
    setRanking(alphabetizedCandidates.map((candidate) => candidate.id));
  };

  const dropCandidate = (targetId: number) => {
    if (draggedCandidateId === null || draggedCandidateId === targetId) return;
    setRanking((current) => {
      const next = current.filter((id) => id !== draggedCandidateId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedCandidateId);
      return next;
    });
    setDraggedCandidateId(null);
    setDropTargetId(null);
  };

  const startDragging = (
    event: DragEvent<HTMLDivElement>,
    candidateId: number,
  ) => {
    setDraggedCandidateId(candidateId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(candidateId));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitRankedBallot({
        data: { election, rankedCandidateIds: ranking },
      });
      toast.success("Your ranked ballot has been submitted");
      onSubmitted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit your ballot",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (votingStatus?.hasVoted) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5 shadow-sm">
        <CardContent className="flex items-center gap-3 py-6">
          <div className="rounded-full bg-emerald-500/10 p-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold">Ballot submitted</p>
            <p className="text-sm text-muted-foreground">
              Your ranking is final for this election.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (candidates.length === 0) return null;

  return (
    <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-md">
      <CardHeader className="border-b bg-muted/25 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Vote className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="font-serif text-2xl sm:text-3xl">Rank your {election} candidates</CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl leading-relaxed">
              Put your first choice at the top. Use the arrows to arrange your ranking; every candidate stays on your ballot.
            </CardDescription>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground md:flex">
            <ShieldCheck className="size-4 text-primary" /> Private ballot
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-7">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-foreground">Your preference order</span>
            <span className="mt-1 block text-xs text-muted-foreground">Move a candidate up or down to change your choice.</span>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={submitting} onClick={resetRanking}>
            <ListRestart className="size-4" /> Reset A–Z
          </Button>
        </div>
        <div className="relative space-y-3 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_5%,transparent),transparent_20rem)] p-3 sm:space-y-4 sm:p-5 lg:p-7">
        {ranking.map((candidateId, index) => {
          const candidate = byId.get(candidateId);
          if (!candidate) return null;
          return (
            <div
              key={candidateId}
              draggable={!submitting}
              onDragStart={(event) => startDragging(event, candidateId)}
              onDragEnd={() => {
                setDraggedCandidateId(null);
                setDropTargetId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(candidateId);
              }}
              onDragLeave={() => setDropTargetId(null)}
              onDrop={(event) => {
                event.preventDefault();
                dropCandidate(candidateId);
              }}
              className={cn(
                "group relative grid grid-cols-[4rem_auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-2xl border bg-background p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:grid-cols-[4.75rem_auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-4",
                index === 0 && "border-primary/50 bg-[linear-gradient(110deg,color-mix(in_oklch,var(--primary)_9%,var(--background)),var(--background)_62%)] shadow-md ring-1 ring-primary/10 sm:p-5",
                draggedCandidateId === candidateId && "opacity-40",
                dropTargetId === candidateId &&
                  draggedCandidateId !== candidateId && "border-primary bg-primary/5 shadow-md",
              )}
              style={{ borderLeftWidth: "4px", borderLeftColor: candidate.partyColor ?? "var(--border)" }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-black sm:size-12", index === 0 ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted text-foreground")}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col items-center" aria-hidden="true">
                  <GripVertical className="size-4 cursor-grab text-muted-foreground group-active:cursor-grabbing" />
                </div>
              </div>
              <PlayerAvatar username={candidate.username} photoUrl={candidate.photoUrl} className="size-14 sm:size-[4.5rem]" />
              <div className="min-w-0 py-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="break-words font-serif text-lg font-bold leading-tight sm:text-xl">{candidate.username}</p>
                  {index === 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.13em] text-primary-foreground">First choice</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <CandidateAffiliationBadges candidate={candidate} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn("inline-flex rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider", index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    {candidates.length - index} {candidates.length - index === 1 ? "point" : "points"}
                  </span>
                  {index > 0 && <span className="text-[10px] text-muted-foreground">Preference {index + 1}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 rounded-xl border bg-muted/25 p-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg bg-background sm:size-9"
                  disabled={index === 0 || submitting}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${candidate.username} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg bg-background sm:size-9"
                  disabled={index === ranking.length - 1 || submitting}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${candidate.username} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-start gap-3 text-xs text-muted-foreground">
            <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
              <span className="size-2 rounded-full bg-primary" />
              <span className="h-px w-5 bg-border" />
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            </div>
            <span>Every rank counts. Your first choice gets the most points, with one fewer point for each place below.</span>
          </div>
        <Button
          size="lg"
          className="w-full font-bold sm:w-auto sm:min-w-56"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? "Submitting ballot…" : "Submit ranked ballot"}
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
