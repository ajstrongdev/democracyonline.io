import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import type { DragEvent } from "react";
import type { Candidate, VotingStatus } from "@/lib/server/elections";
import { submitRankedBallot } from "@/lib/server/elections";
import { CandidateAffiliationBadges } from "@/components/candidate-affiliation-badges";
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
  const [ranking, setRanking] = useState(() =>
    candidates.map((candidate) => candidate.id),
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
    const candidateIds = candidates.map((candidate) => candidate.id);
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
    <Card className="overflow-hidden border-primary/30 bg-card shadow-lg">
      <CardHeader className="border-b bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <Vote className="h-5 w-5 text-primary" />
              Your {election} ballot
            </CardTitle>
            <CardDescription className="mt-2 max-w-xl leading-relaxed">
              Drag candidates into order, or use the arrow controls. Every name
              must stay on the ballot before you submit.
            </CardDescription>
          </div>
          <ShieldCheck className="hidden h-8 w-8 text-primary/60 sm:block" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between border-b border-dashed pb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Most preferred</span>
          <span>{candidates.length} to 1 points</span>
        </div>
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
                "group flex items-center gap-2 rounded-xl border bg-background p-2.5 transition-all sm:gap-3 sm:p-3",
                draggedCandidateId === candidateId && "opacity-40",
                dropTargetId === candidateId &&
                  draggedCandidateId !== candidateId &&
                  "border-primary bg-primary/5 shadow-sm",
              )}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground group-active:cursor-grabbing" />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-sm font-bold text-background">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-semibold">{candidate.username}</p>
                  <CandidateAffiliationBadges candidate={candidate} />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    {candidates.length - index} pts
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0 || submitting}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${candidate.username} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
        <div className="mt-3 flex items-center justify-between border-t border-dashed pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Least preferred</span>
          <span>Final choice</span>
        </div>
        <Button
          size="lg"
          className="mt-3 w-full font-bold"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? "Securing ballot..." : "Submit final ballot"}
        </Button>
      </CardContent>
    </Card>
  );
}
