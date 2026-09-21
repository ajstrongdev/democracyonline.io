import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Cell, Pie, PieChart } from "recharts";
import {
  CheckCircle2,
  Clock3,
  Crown,
  Landmark,
  Radio,
  ShieldCheck,
  Trophy,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Candidate,
  CurrentElectionDashboard,
} from "@/lib/server/elections";
import {
  declareCandidate,
  getCurrentElectionDashboard,
  revokeCandidate,
} from "@/lib/server/elections";
import { DEFAULT_ELECTION_TIMING } from "@/lib/elections/timing";
import { DashboardElectionCountdown } from "@/components/dashboard-election-countdown";
import { RankedBallot } from "@/components/ranked-ballot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Race = CurrentElectionDashboard["races"][number];
type CurrentUser = {
  id: number;
  role: string | null;
  partyId: number | null;
  partyName: string | null;
} | null;

export function isElectionNightActive(data: CurrentElectionDashboard) {
  return data.races.some((race) => race.status === "ELECTION_NIGHT");
}

function stageLabel(status: Race["status"]) {
  if (status === "CANDIDACY") return "Nominations open";
  if (status === "VOTING") return "Polls open";
  if (status === "ELECTION_NIGHT") return "Election night";
  return "Final result";
}

function raceDeadline(race: Race) {
  if (race.status === "CANDIDACY") return race.timestamps.candidacyEndsAt;
  if (race.status === "VOTING") return race.timestamps.votingEndsAt;
  if (race.status === "ELECTION_NIGHT")
    return race.timestamps.electionNightEndsAt;
  return null;
}

function formatFeedTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date(value));
}

function toBallotCandidate(race: Race, candidate: Race["candidates"][number]) {
  return {
    id: candidate.id,
    userId: candidate.userId,
    election: race.election,
    votes: null,
    haswon: false,
    username: candidate.username,
    partyId: candidate.party?.id ?? null,
    partyName: candidate.party?.name ?? null,
    partyColor: candidate.party?.color ?? null,
    partyLogo: candidate.party?.logo ?? null,
    coalitionId: candidate.coalition?.id ?? null,
    coalitionName: candidate.coalition?.name ?? null,
    coalitionColor: candidate.coalition?.color ?? null,
    coalitionLogo: candidate.coalition?.logo ?? null,
  } satisfies Candidate;
}

export function DashboardElectionHub({
  initialData,
  currentUser,
}: {
  initialData: CurrentElectionDashboard;
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const refreshing = useRef(false);
  const hasActiveRace = data.races.some((race) => race.status !== "CONCLUDED");
  const electionNight = isElectionNightActive(data);

  useEffect(() => setData(initialData), [initialData]);

  const refresh = useEffectEvent(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await getCurrentElectionDashboard();
      const stagesChanged = next.races.some(
        (race, index) => race.status !== data.races[index]?.status,
      );
      setData(next);
      if (stagesChanged) await router.invalidate();
    } catch (error) {
      console.error("Could not refresh election dashboard", error);
    } finally {
      refreshing.current = false;
    }
  });

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(
      refreshWhenVisible,
      hasActiveRace ? 5_000 : 30_000,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [hasActiveRace]);

  if (!data.races.length) {
    return (
      <section className="wiki-section">
        <header className="wiki-section-header">
          <div className="min-w-0">
            <h2 className="wiki-section-title">
              <Landmark className="h-4 w-4 text-primary" />
              National election desk
            </h2>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Clock3 className="h-3 w-3" /> No race scheduled
          </Badge>
        </header>
        <div className="wiki-section-content">
          <div className="px-4 py-5 text-sm text-muted-foreground">
            The election desk will appear here when a cycle is configured.
          </div>
        </div>
      </section>
    );
  }

  if (electionNight) {
    return (
      <div className="space-y-4">
        {data.races.map((race) =>
          race.status === "ELECTION_NIGHT" ? (
            <ElectionNightCard
              key={`${race.election}-${race.cycle}`}
              race={race}
              onRefresh={() => void refresh()}
            />
          ) : (
            <CompactRaceRow
              key={`${race.election}-${race.cycle}`}
              race={race}
              races={data.races}
              currentUser={currentUser}
              onRefresh={() => void refresh()}
              onActionComplete={() => void router.invalidate()}
            />
          ),
        )}
      </div>
    );
  }

  return (
    <section className="wiki-section">
      <header className="wiki-section-header">
        <div className="min-w-0">
          <h2 className="wiki-section-title">
            <Landmark className="h-4 w-4 text-primary" />
            National election desk
          </h2>
        </div>
        {hasActiveRace ? (
          <Badge variant="default" className="gap-1.5">
            <Radio className="h-3 w-3" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> Cycle complete
          </Badge>
        )}
      </header>
      <div className="wiki-section-content">
        <div className="divide-y border-y">
          {data.races.map((race) => (
            <CompactRaceRow
              key={`${race.election}-${race.cycle}`}
              race={race}
              races={data.races}
              currentUser={currentUser}
              onRefresh={() => void refresh()}
              onActionComplete={() => void router.invalidate()}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CompactRaceRow({
  race,
  races,
  currentUser,
  onRefresh,
  onActionComplete,
}: {
  race: Race;
  races: CurrentElectionDashboard["races"];
  currentUser: CurrentUser;
  onRefresh: () => void;
  onActionComplete: () => void;
}) {
  const Icon = race.election === "President" ? Crown : Landmark;
  const deadline = raceDeadline(race);

  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 border bg-muted p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {race.election === "President"
                ? "Presidential election"
                : "Senate election"}
            </p>
            <Badge
              variant={race.status === "CONCLUDED" ? "outline" : "default"}
              className="text-[0.65rem]"
            >
              {stageLabel(race.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cycle {race.cycle} · {race.seats ?? 1}{" "}
            {race.seats === 1 ? "seat" : "seats"} · {race.candidates.length}{" "}
            {race.candidates.length === 1 ? "candidate" : "candidates"}
          </p>
          {race.status === "CANDIDACY" && (
            <CompactCandidacyStatus
              race={race}
              races={races}
              currentUser={currentUser}
              onActionComplete={onActionComplete}
            />
          )}
          {race.status === "VOTING" && (
            <CompactVotingStatus
              race={race}
              currentUser={currentUser}
              onActionComplete={onActionComplete}
            />
          )}
          {race.status === "CONCLUDED" && (
            <CompactConcludedStatus race={race} />
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {race.status === "CONCLUDED" && race.timestamps.concludedAt && (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Clock3 className="h-3 w-3" />
            Nominations in{" "}
            <DashboardElectionCountdown
              target={
                new Date(
                  new Date(race.timestamps.concludedAt).getTime() +
                    DEFAULT_ELECTION_TIMING.concludedDurationMs[race.election],
                )
              }
              onExpire={onRefresh}
            />
          </Badge>
        )}
        {deadline && race.status !== "CONCLUDED" && (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Clock3 className="h-3 w-3" />
            <DashboardElectionCountdown
              target={deadline}
              onExpire={onRefresh}
            />
          </Badge>
        )}
        <Link
          to={
            race.status === "CONCLUDED"
              ? "/dashboard/elections"
              : "/dashboard/elections/$electionId"
          }
          params={
            race.status === "CONCLUDED"
              ? undefined
              : { electionId: `current-${race.election}` }
          }
          className="text-xs font-semibold text-primary hover:underline"
        >
          {race.status === "CONCLUDED" ? "View results" : "View race"}
        </Link>
      </div>
    </div>
  );
}

function CompactCandidacyStatus({
  race,
  races,
  currentUser,
  onActionComplete,
}: {
  race: Race;
  races: CurrentElectionDashboard["races"];
  currentUser: CurrentUser;
  onActionComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const partyPrimary =
    race.election === "President" && Boolean(currentUser?.partyId);
  const candidateElsewhere = races.some(
    (other) => other.election !== race.election && other.player.isCandidate,
  );
  const primaryElsewhere =
    race.election === "Senate" && race.player.isPrimaryCandidate;
  const roleBlocked =
    (race.election === "Senate" && currentUser?.role === "President") ||
    (race.election === "President" && currentUser?.role === "Senator");

  const declare = async () => {
    setSubmitting(true);
    try {
      await declareCandidate({ data: { election: race.election } });
      toast.success(`You are now a candidate for ${race.election}`);
      setOpen(false);
      onActionComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not declare candidacy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    setSubmitting(true);
    try {
      await revokeCandidate({ data: { election: race.election } });
      toast.success(`Your ${race.election} candidacy has been withdrawn`);
      onActionComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not withdraw candidacy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {race.player.isCandidate ? (
        <>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> You are on the ballot
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={submitting}
            onClick={withdraw}
          >
            {submitting ? "Withdrawing..." : "Withdraw"}
          </Button>
        </>
      ) : partyPrimary ? (
        <Link
          to="/dashboard/parties/primaries"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Go to primaries
        </Link>
      ) : currentUser ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={candidateElsewhere || primaryElsewhere || roleBlocked}
            >
              <Vote className="h-3 w-3" /> Declare candidacy
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Declare for {race.election}?</DialogTitle>
              <DialogDescription>
                Your name and affiliation will be added to this national ballot.
                Confirm that you want to stand in this race.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={declare} disabled={submitting}>
                {submitting ? "Filing..." : "Confirm declaration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Link
          to="/login"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Sign in to declare
        </Link>
      )}
    </div>
  );
}

function CompactVotingStatus({
  race,
  currentUser,
  onActionComplete,
}: {
  race: Race;
  currentUser: CurrentUser;
  onActionComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ballotCandidates = race.candidates.map((candidate) =>
    toBallotCandidate(race, candidate),
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {race.player.hasVoted ? (
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3 w-3" /> You voted
        </Badge>
      ) : currentUser && race.candidates.length ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs">
              <Vote className="h-3 w-3" /> Cast ballot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-3 sm:p-5">
            <DialogHeader className="pr-8">
              <DialogTitle>Cast your {race.election} ballot</DialogTitle>
              <DialogDescription>
                Rank all candidates in order of preference. Submission is final.
              </DialogDescription>
            </DialogHeader>
            <RankedBallot
              election={race.election}
              candidates={ballotCandidates}
              votingStatus={{ hasVoted: false, ranking: [] }}
              onSubmitted={() => {
                setOpen(false);
                onActionComplete();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : currentUser ? (
        <span className="text-xs text-muted-foreground">No candidates</span>
      ) : (
        <Link
          to="/login"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Sign in to vote
        </Link>
      )}
    </div>
  );
}

function CompactConcludedStatus({ race }: { race: Race }) {
  const standings = [...race.candidates].sort(
    (a, b) => (b.points ?? 0) - (a.points ?? 0) || a.id - b.id,
  );
  const winners = standings.filter((c) => c.hasWon);

  if (!winners.length) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">No winner recorded.</p>
    );
  }

  if (race.election === "President") {
    const w = winners[0];
    const affiliation = [
      w.party?.name,
      w.coalition?.name ? `(${w.coalition.name})` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: w.party?.color ?? "var(--muted-foreground)" }}
          />
          <span className="font-semibold">{w.username}</span>
          {affiliation && (
            <span className="text-muted-foreground">{affiliation}</span>
          )}
        </span>
      </div>
    );
  }

  const partyTotals = new Map<string, { count: number; color: string }>();
  for (const w of winners) {
    const name = w.party?.name ?? "Independent";
    const color = w.party?.color ?? "var(--muted-foreground)";
    const existing = partyTotals.get(name);
    if (existing) {
      existing.count++;
    } else {
      partyTotals.set(name, { count: 1, color });
    }
  }
  const sorted = [...partyTotals.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      {sorted.map(([name, { count, color }]) => (
        <span key={name} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold">{count}</span>
          <span className="text-muted-foreground">{name}</span>
        </span>
      ))}
    </div>
  );
}

function ElectionNightCard({
  race,
  onRefresh,
}: {
  race: Race;
  onRefresh: () => void;
}) {
  const Icon = race.election === "President" ? Crown : Landmark;
  const deadline = raceDeadline(race);
  const title =
    race.election === "President" ? "Presidential election" : "Senate election";

  const standings = [...race.candidates].sort(
    (a, b) => (b.points ?? 0) - (a.points ?? 0) || a.id - b.id,
  );
  const total = standings.reduce(
    (sum, candidate) => sum + (candidate.points ?? 0),
    0,
  );
  const seats = race.seats ?? 1;
  const leaders = standings.slice(0, seats);
  const seatSummary = partySeatSummary(standings, seats);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-white shadow-2xl">
      <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 border border-white/20 bg-white/10 p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/50">
              Cycle {race.cycle} · {seats} {seats === 1 ? "seat" : "seats"}
            </p>
            <h3 className="truncate font-serif text-2xl font-bold sm:text-3xl">
              {title}
            </h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge className="gap-1.5 border-red-500 bg-red-600 text-white hover:bg-red-600">
            <Radio className="h-3 w-3" /> Election night
          </Badge>
          {deadline && (
            <Badge
              variant="outline"
              className="gap-1.5 border-white/25 text-white"
            >
              <Clock3 className="h-3 w-3" />
              <DashboardElectionCountdown
                target={deadline}
                onExpire={onRefresh}
              />
            </Badge>
          )}
          <Link
            to="/dashboard/elections/$electionId"
            params={{ electionId: `current-${race.election}` }}
            className="text-xs font-semibold text-white/70 hover:text-white hover:underline"
          >
            Full race record
          </Link>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.7fr)]">
        <div className="min-w-0">
          <div className="mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/50">
                  Reported so far
                </p>
                <p className="mt-1 font-serif text-2xl font-bold leading-tight">
                  {seatSummary
                    ? seatSummary.label
                    : leaders.length
                      ? `${leaders.map((c) => c.username).join(" · ")} ${leaders.length === 1 ? "leads" : "lead"}`
                      : "Awaiting first report"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <strong className="font-mono text-3xl tabular-nums">
                  {Math.min(100, race.coverage.reportingPercent).toFixed(0)}%
                </strong>
                {race.coverage.reportedPoints > 0 && (
                  <p className="mt-1 font-mono text-sm text-white/50">
                    {race.coverage.reportedPoints.toLocaleString()} points reported
                  </p>
                )}
              </div>
            </div>
            <div
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label="Reporting progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(race.coverage.reportingPercent)}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, race.coverage.reportingPercent)}%`,
                }}
              />
            </div>
          </div>

          {standings.length > 0 && total > 0 && (
            <div className="mb-6 flex items-center gap-4 rounded-lg border border-white/15 bg-white/5 p-4">
              <PieChart width={80} height={80}>
                <Pie
                  data={standings.map((c) => ({
                    name: c.username,
                    value: c.points ?? 0,
                    color: c.party?.color ?? c.affiliation.color ?? "var(--muted-foreground)",
                  }))}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={35}
                  paddingAngle={1}
                >
                  {standings.map((c, i) => (
                    <Cell
                      key={i}
                      fill={c.party?.color ?? c.affiliation.color ?? "var(--muted-foreground)"}
                      fillOpacity={0.9}
                    />
                  ))}
                </Pie>
              </PieChart>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
                  Vote share
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {standings.slice(0, 6).map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            c.party?.color ?? c.affiliation.color ?? "var(--muted-foreground)",
                        }}
                      />
                      <span className="text-white/70">{c.username}</span>
                      <span className="font-mono font-bold text-white/90">
                        {total
                          ? (((c.points ?? 0) / total) * 100).toFixed(0)
                          : 0}
                        %
                      </span>
                    </span>
                  ))}
                  {standings.length > 6 && (
                    <span className="text-xs text-white/40">
                      +{standings.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {standings.map((candidate, index) => {
              const share = total ? ((candidate.points ?? 0) / total) * 100 : 0;
              return (
                <div
                  key={candidate.id}
                  className="relative overflow-hidden rounded-lg border border-white/15 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="font-mono text-xl font-bold text-white/50">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <ElectionNightCandidateIdentity candidate={candidate} />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xl font-bold tabular-nums">
                        {candidate.points ?? 0}
                      </p>
                      <p className="text-xs uppercase tracking-wider text-white/50">
                        {share.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full transition-[width] motion-reduce:transition-none"
                      style={{
                        width: `${share}%`,
                        backgroundColor:
                          candidate.party?.color ?? candidate.affiliation.color ?? "var(--primary)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside
          aria-live="polite"
          className="min-w-0 border-t border-white/15 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-500" />
            <h4 className="font-serif text-lg font-bold">Live wire</h4>
          </div>
          <div className="space-y-0">
            {[...race.coverage.updates].reverse().map((update) => (
              <div
                key={update.id}
                className="border-t border-white/15 py-3 first:border-t-0 first:pt-0"
              >
                <time className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                  {formatFeedTime(update.revealAt)}
                </time>
                <p className="mt-1 text-sm font-semibold leading-5">
                  {update.headline}
                </p>
              </div>
            ))}
            {!race.coverage.updates.length && (
              <p className="text-sm text-white/60">
                The first report has not arrived yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}

function ElectionNightCandidateIdentity({
  candidate,
}: {
  candidate: Race["candidates"][number];
}) {
  const color = candidate.party?.color ?? candidate.affiliation.color ?? "#64748b";
  const label = candidate.party?.name
    ? candidate.coalition?.name
      ? `${candidate.party.name} / ${candidate.coalition.name}`
      : candidate.party.name
    : candidate.affiliation.name ?? "Independent";
  const content = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-serif font-bold text-white"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {candidate.username.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {candidate.username}
        </span>
        <span className="block truncate text-xs text-white/50">
          {label}
        </span>
      </span>
    </>
  );
  return candidate.userId ? (
    <Link
      to="/dashboard/players/$playerId"
      params={{ playerId: String(candidate.userId) }}
      className="flex min-w-0 items-center gap-3 hover:underline"
    >
      {content}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">{content}</div>
  );
}

function partySeatSummary(
  standings: Array<Race["candidates"][number]>,
  seats: number,
) {
  if (seats === 1) return null;
  const top = standings.slice(0, seats);
  const seatCounts = new Map<string, number>();
  const partyColor = new Map<string, string>();
  for (const candidate of top) {
    const partyName = candidate.party?.name
      ? candidate.coalition?.name
        ? `${candidate.party.name} / ${candidate.coalition.name}`
        : candidate.party.name
      : candidate.affiliation.type === "Party" || candidate.affiliation.type === "Coalition"
        ? (candidate.affiliation.name ?? "Unknown")
        : "Independent";
    const color = candidate.party?.color ?? candidate.affiliation.color ?? "";
    seatCounts.set(partyName, (seatCounts.get(partyName) ?? 0) + 1);
    if (!partyColor.has(partyName)) partyColor.set(partyName, color);
  }
  const entries = [...seatCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const max = entries[0];
  if (!max || max[1] === 0) return null;
  const party = max[0];
  const count = max[1];
  const hasMajority = count > seats / 2;
  return {
    party,
    seats: count,
    color: partyColor.get(party) ?? "",
    label: hasMajority
      ? `${party} leads with ${count} of ${seats} seats`
      : "No overall majority",
  };
}
