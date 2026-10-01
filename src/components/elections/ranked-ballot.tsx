import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ListRestart, ShieldCheck, Vote } from "lucide-react";
import { toast } from "sonner";
import type { Candidate, VotingStatus } from "@/lib/server/elections/elections";
import { submitRankedBallot } from "@/lib/server/elections/elections";
import { reconcileBallotDraft } from "@/lib/elections/ballot-draft";
import { CandidateAffiliationBadges } from "@/components/elections/candidate-affiliation-badges";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RankedBallot({
  election,
  candidates,
  votingStatus,
  onSubmitted,
  draftKey,
}: {
  election: "President" | "Senate";
  candidates: Array<Candidate>;
  votingStatus: VotingStatus | null;
  onSubmitted: () => void;
  draftKey?: string;
}) {
  const alphabetized = [...candidates].sort((a, b) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
  );
  const roster = alphabetized.map((candidate) => candidate.id);
  const rosterSignature = roster.join(",");
  const loadIdentity = `${draftKey ?? ""}:${rosterSignature}`;
  const [ranking, setRanking] = useState(roster);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const rows = useRef(new Map<number, HTMLButtonElement>());
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selectedIndex = selectedId === null ? -1 : ranking.indexOf(selectedId);
  const selected = selectedId === null ? null : byId.get(selectedId);

  useEffect(() => {
    const ids = rosterSignature ? rosterSignature.split(",").map(Number) : [];
    let saved: unknown = null;
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        saved = raw ? JSON.parse(raw) : null;
      } catch {
        // Private browsing or an invalid draft should not prevent voting.
      }
    }
    setRanking((current) => reconcileBallotDraft(ids, saved ?? current));
    setSelectedId((current) => current !== null && ids.includes(current) ? current : null);
    setLoadedKey(`${draftKey ?? ""}:${rosterSignature}`);
  }, [draftKey, rosterSignature]);

  useEffect(() => {
    if (!draftKey || loadedKey !== loadIdentity || votingStatus?.hasVoted || submitted) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(ranking));
    } catch {
      // Voting still works when local storage is unavailable.
    }
  }, [draftKey, loadIdentity, loadedKey, ranking, submitted, votingStatus?.hasVoted]);

  const move = (direction: -1 | 1) => {
    if (selectedId === null || submitting) return;
    const index = ranking.indexOf(selectedId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ranking.length) return;
    setRanking((current) => {
      const next = [...current];
      const from = next.indexOf(selectedId);
      if (from < 0 || from + direction < 0 || from + direction >= next.length) return current;
      [next[from], next[from + direction]] = [next[from + direction], next[from]];
      return next;
    });
    requestAnimationFrame(() => rows.current.get(selectedId)?.scrollIntoView({ block: "nearest" }));
  };

  const moveTo = (position: number) => {
    if (selectedId === null || submitting || !Number.isInteger(position)) return;
    const target = Math.max(0, Math.min(ranking.length - 1, position - 1));
    setRanking((current) => {
      const next = current.filter((id) => id !== selectedId);
      next.splice(target, 0, selectedId);
      return next;
    });
    requestAnimationFrame(() => rows.current.get(selectedId)?.scrollIntoView({ block: "nearest" }));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitRankedBallot({ data: { election, rankedCandidateIds: ranking } });
      setSubmitted(true);
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* Storage may be disabled. */ }
      }
      toast.success("Your ranked ballot has been submitted");
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your ballot");
    } finally {
      setSubmitting(false);
    }
  };

  if (votingStatus?.hasVoted || submitted) {
    return <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
      <CheckCircle2 className="size-7 text-emerald-600" />
      <div><p className="font-semibold">Ballot submitted</p><p className="text-sm text-muted-foreground">Your ranking is final for this election.</p></div>
    </div>;
  }
  if (!candidates.length) return null;

  return <section className="mx-auto max-w-5xl pb-10">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Vote className="size-4" /> Official ballot</div>
        <h1 className="font-serif text-3xl font-bold sm:text-5xl">Rank your {election} candidates</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">Select a candidate, then move them up or down. Every candidate must stay on your ballot. Your first choice receives the most points.</p>
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Private ballot</span>
    </div>

    <div className="sticky top-0 z-20 mb-4 rounded-xl border bg-background/95 p-3 shadow-md backdrop-blur sm:top-2 sm:p-4">
      {selected ? <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected · #{selectedIndex + 1} of {ranking.length}</p>
          <p className="truncate font-serif text-lg font-bold">{selected.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-11 px-3 sm:px-4" disabled={selectedIndex <= 0 || submitting} onClick={() => move(-1)} aria-label={`Move ${selected.username} up`}><ArrowUp /> <span className="hidden sm:inline">Up</span></Button>
          <Button variant="outline" className="h-11 px-3 sm:px-4" disabled={selectedIndex >= ranking.length - 1 || submitting} onClick={() => move(1)} aria-label={`Move ${selected.username} down`}><ArrowDown /> <span className="hidden sm:inline">Down</span></Button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">Rank <select aria-label={`Move ${selected.username} to rank`} className="h-11 rounded-md border bg-background px-2 font-mono text-foreground" value={selectedIndex + 1} disabled={submitting} onChange={(event) => moveTo(Number(event.target.value))}>{ranking.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
        </div>
      </div> : <p className="py-2 text-sm font-medium">Tap or click a candidate to select them and change their rank.</p>}
    </div>

    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preference order · {ranking.length} candidates</span>
      <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => setRanking(roster)}><ListRestart className="size-4" /> Reset A–Z</Button>
    </div>
    <div className="space-y-2">
      {ranking.map((id, index) => {
        const candidate = byId.get(id);
        if (!candidate) return null;
        return <button
          key={id}
          ref={(node) => { if (node) rows.current.set(id, node); else rows.current.delete(id); }}
          type="button"
          disabled={submitting}
          onClick={() => setSelectedId(id)}
          aria-pressed={selectedId === id}
          aria-label={`Select ${candidate.username}, rank ${index + 1} of ${ranking.length}`}
          className={cn("flex w-full min-w-0 items-center gap-3 rounded-lg border border-l-4 bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-5 sm:p-4", selectedId === id && "border-primary bg-primary/5 ring-2 ring-primary", index === 0 && selectedId !== id && "bg-primary/5")}
          style={{ borderLeftColor: candidate.partyColor ?? "var(--border)" }}
        >
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md font-mono text-lg font-bold", index === 0 ? "bg-primary text-primary-foreground" : "bg-muted")}>{index + 1}</span>
          <PlayerAvatar username={candidate.username} photoUrl={candidate.photoUrl} className="size-10 shrink-0 sm:size-12" />
          <span className="min-w-0 flex-1"><span className="block truncate font-serif text-base font-bold sm:text-lg">{candidate.username}</span><span className="mt-1 flex flex-wrap gap-1"><CandidateAffiliationBadges candidate={candidate} /></span></span>
          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">{ranking.length - index} pts</span>
        </button>;
      })}
    </div>
    <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">Your draft is saved on this device. Submission is final.</p>
      <Button size="lg" className="w-full sm:w-auto" disabled={submitting || Boolean(draftKey && loadedKey !== loadIdentity)} onClick={submit}>{submitting ? "Submitting ballot…" : "Submit ranked ballot"}</Button>
    </div>
  </section>;
}
