import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  Clock3,
  Crown,
  Landmark,
  Newspaper,
  Radio,
  Sparkles,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Candidate,
  ElectionInfo,
  VotingStatus,
} from "@/lib/server/elections";
import { declareCandidate, revokeCandidate } from "@/lib/server/elections";
import { CandidatesChart } from "@/components/candidates-chart";
import { CandidateAffiliationBadges } from "@/components/candidate-affiliation-badges";
import PartyLogo from "@/components/party-logo";
import { RankedBallot } from "@/components/ranked-ballot";
import ProtectedRoute from "@/components/auth/protected-route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type UserData = {
  id: number;
  partyId: number | null;
  role: string | null;
} | null;

export type ElectionPageData = {
  electionInfo: ElectionInfo | null;
  candidates: Array<Candidate>;
  votingStatus: VotingStatus | null;
  isCandidateInAny: { isCandidate: boolean; election: string | null };
};

function getStandings(candidates: Array<Candidate>) {
  return [...candidates].sort(
    (a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.id - b.id,
  );
}

function getSenateSeatLeaders(data: ElectionPageData) {
  if (!data.electionInfo || data.electionInfo.status === "Candidate")
    return null;
  if (!data.candidates.some((candidate) => (candidate.votes ?? 0) > 0))
    return null;

  const seats = data.electionInfo?.seats ?? 1;
  const seatHolders =
    data.electionInfo?.status === "Concluded"
      ? data.candidates.filter((candidate) => candidate.haswon)
      : getStandings(data.candidates).slice(0, seats);
  if (seatHolders.length === 0) return null;

  const seatCounts = new Map<string, number>();
  for (const candidate of seatHolders) {
    const party = candidate.partyName ?? "Independents";
    seatCounts.set(party, (seatCounts.get(party) ?? 0) + 1);
  }

  const mostSeats = Math.max(...seatCounts.values());
  const names = [...seatCounts]
    .filter(([, count]) => count === mostSeats)
    .map(([name]) => name);
  if (names.length !== 1) return null;

  return {
    names,
    seats: mostSeats,
  };
}

function RaceBrief({
  election,
  data,
}: {
  election: "President" | "Senate";
  data: ElectionPageData;
}) {
  const hasResults = data.candidates.some(
    (candidate) => (candidate.votes ?? 0) > 0,
  );
  const leader = hasResults ? getStandings(data.candidates)[0] : undefined;
  const senateLeaders =
    election === "Senate" ? getSenateSeatLeaders(data) : null;
  const Icon = election === "President" ? Crown : Landmark;
  return (
    <div className="relative overflow-hidden border border-white/15 bg-white/7 p-5 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_68%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60">
            <Icon className="h-4 w-4" />
            {election} race
          </div>
          <p className="font-serif text-2xl font-bold">
            {election === "Senate"
              ? senateLeaders
                ? senateLeaders.names.join(" · ")
                : data.electionInfo?.status === "Candidate"
                  ? "Seat race forming"
                  : "No overall control"
              : (leader?.username ??
                (data.electionInfo?.status === "Candidate"
                  ? "Field forming"
                  : "No overall control"))}
          </p>
          <p className="mt-1 text-sm text-white/65">
            {election === "Senate"
              ? senateLeaders
                ? `${senateLeaders.seats} ${data.electionInfo?.status === "Concluded" ? (senateLeaders.seats === 1 ? "seat won" : "seats won") : senateLeaders.seats === 1 ? "projected seat" : "projected seats"}${senateLeaders.names.length > 1 ? " each" : ""}`
                : data.electionInfo?.status === "Candidate"
                  ? "No seats projected"
                  : hasResults
                    ? "No party has a unique projected seat lead"
                    : "No results reported"
              : leader
                ? `${leader.votes ?? 0} points`
                : data.electionInfo?.status === "Candidate"
                  ? "No declared candidates"
                  : "No results reported"}
          </p>
          {election === "President" && leader && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CandidateAffiliationBadges candidate={leader} />
            </div>
          )}
        </div>
        <Badge className="border-0 bg-red-500 text-white hover:bg-red-500">
          {data.electionInfo?.status === "Voting"
            ? "LIVE"
            : data.electionInfo?.status}
        </Badge>
      </div>
    </div>
  );
}

export function ElectionsPage({
  president,
  senate,
  userData,
}: {
  president: ElectionPageData;
  senate: ElectionPageData;
  userData: UserData;
}) {
  const activeRaces = [
    {
      key: "president",
      election: "President",
      label: "Presidential",
      icon: Crown,
      data: president,
    },
    {
      key: "senate",
      election: "Senate",
      label: "Senate",
      icon: Landmark,
      data: senate,
    },
  ].filter((race) => race.data.electionInfo?.status !== "Concluded") as Array<{
    key: "president" | "senate";
    election: "President" | "Senate";
    label: string;
    icon: typeof Crown;
    data: ElectionPageData;
  }>;
  const totalCandidates = activeRaces.reduce(
    (total, race) => total + race.data.candidates.length,
    0,
  );
  const pendingBallots = activeRaces.filter(
    (race) =>
      race.data.electionInfo?.status === "Voting" &&
      !race.data.votingStatus?.hasVoted,
  ).length;
  const hasActiveRaces = activeRaces.length > 0;
  const isMidterm =
    activeRaces.length === 1 && activeRaces[0].election === "Senate";

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_oklch,var(--muted)_48%,transparent),transparent_28rem)]">
        <header className="relative overflow-hidden bg-slate-950 text-white dark:bg-black">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_49%,transparent_49%),radial-gradient(circle_at_15%_20%,rgba(34,197,94,0.3),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(59,130,246,0.28),transparent_34%)]" />
          <div className="container relative mx-auto max-w-7xl px-4 py-8 sm:py-12">
            <div className="mb-8 flex items-center justify-between border-b border-white/20 pb-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white/70">
                <Newspaper className="h-4 w-4" />
                Oscana News
              </div>
              {hasActiveRaces && (
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Live coverage
                </div>
              )}
            </div>
            <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Oscana decides
                </div>
                <h1 className="max-w-4xl font-serif text-5xl font-black leading-[0.92] tracking-tight sm:text-7xl">
                  {isMidterm
                    ? "Midterm Elections."
                    : hasActiveRaces
                      ? "Election Night."
                      : "Elections Concluded."}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/68 sm:text-lg">
                  {isMidterm
                    ? "Follow the Senate race, examine the field, and rank every candidate on the midterm ballot."
                    : hasActiveRaces
                      ? "Follow the active national races, examine the field, and rank every candidate on one definitive ballot desk."
                      : "The national races have closed. A new election cycle will appear here when candidacy opens."}
                </p>
              </div>
              {hasActiveRaces && (
                <div
                  className={cn(
                    "grid gap-3",
                    activeRaces.length > 1 &&
                      "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2",
                  )}
                >
                  {activeRaces.map((race) => (
                    <RaceBrief
                      key={race.key}
                      election={race.election}
                      data={race.data}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-8 grid grid-cols-3 border-y border-white/15 text-center">
              <div className="border-r border-white/15 px-3 py-4">
                <p className="font-mono text-2xl font-bold">
                  {activeRaces.length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                  Active races
                </p>
              </div>
              <div className="border-r border-white/15 px-3 py-4">
                <p className="font-mono text-2xl font-bold">
                  {totalCandidates}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                  Candidates
                </p>
              </div>
              <div className="px-3 py-4">
                <p className="font-mono text-2xl font-bold">{pendingBallots}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                  Your ballots due
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
          {hasActiveRaces ? (
            <Tabs defaultValue={activeRaces[0].key} className="gap-6">
              <TabsList
                className={cn(
                  "grid h-auto w-full border bg-card p-1 shadow-sm sm:w-[520px]",
                  activeRaces.length === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {activeRaces.map((race) => {
                  const Icon = race.icon;
                  return (
                    <TabsTrigger
                      key={race.key}
                      value={race.key}
                      className="gap-2 py-3"
                    >
                      <Icon className="h-4 w-4" /> {race.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {activeRaces.map((race) => (
                <TabsContent key={race.key} value={race.key}>
                  <ElectionPanel
                    election={race.election}
                    data={race.data}
                    userData={userData}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-14 text-center">
                <Clock3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h2 className="font-serif text-2xl font-bold">
                  No active elections
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
                  Both races have concluded. This desk will reopen when the next
                  candidacy period begins.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}

function ElectionPanel({
  election,
  data,
  userData,
}: {
  election: "President" | "Senate";
  data: ElectionPageData;
  userData: UserData;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(data.candidates);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setCandidates(data.candidates), [data.candidates]);

  const alreadyCandidate = candidates.some(
    (candidate) => candidate.userId === userData?.id,
  );
  const standings = getStandings(candidates);
  const seats = election === "Senate" ? (data.electionInfo?.seats ?? 1) : 1;
  const Icon = election === "President" ? Crown : Landmark;

  const changeCandidacy = async () => {
    setSubmitting(true);
    try {
      if (alreadyCandidate) {
        await revokeCandidate({ data: { election } });
        setCandidates((current) =>
          current.filter((candidate) => candidate.userId !== userData?.id),
        );
      } else {
        await declareCandidate({ data: { election } });
        await router.invalidate();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update candidacy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!data.electionInfo) {
    return (
      <Alert>
        <AlertTitle>Election unavailable</AlertTitle>
        <AlertDescription>
          The {election.toLowerCase()} election could not be loaded.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-5 border-y py-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
            <Radio className="h-4 w-4" />
            National race briefing
          </div>
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8" />
            <h2 className="font-serif text-4xl font-black sm:text-5xl">
              {election}
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {election === "President"
              ? "One office. One national mandate. Every ranking changes the point map."
              : `${seats} seats are in play. The top ${seats} candidates at the close of voting are elected.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {data.electionInfo.daysLeft} days left
          </Badge>
          <Badge className="gap-1.5 px-3 py-1.5">
            <Vote className="h-3.5 w-3.5" />
            {data.electionInfo.status}
          </Badge>
        </div>
      </section>

      {data.electionInfo.status === "Candidate" && (
        <Alert className="border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4" />
          <AlertTitle>
            {alreadyCandidate ? "You are on the ballot" : "Candidacy is open"}
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {election === "President" && userData?.partyId
                ? "Party members qualify through the presidential primaries."
                : "Declare now to appear on the ranked ballot."}
            </span>
            {election === "President" && userData?.partyId ? (
              <Button asChild>
                <Link to="/dashboard/parties/primaries">View primaries</Link>
              </Button>
            ) : userData &&
              (!data.isCandidateInAny.isCandidate || alreadyCandidate) ? (
              <Button
                variant={alreadyCandidate ? "destructive" : "default"}
                disabled={submitting}
                onClick={changeCandidacy}
              >
                {alreadyCandidate ? "Withdraw" : "Declare candidacy"}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {data.electionInfo.status === "Voting" ? (
        <div className="space-y-6">
          <RankedBallot
            election={election}
            candidates={candidates}
            votingStatus={data.votingStatus}
            onSubmitted={() => router.invalidate()}
          />
          <CandidatesChart
            election={election}
            candidates={candidates}
            seats={seats}
            status={data.electionInfo.status}
          />
        </div>
      ) : (
        <CandidatesChart
          election={election}
          candidates={candidates}
          seats={seats}
          status={data.electionInfo.status}
        />
      )}

      <section>
        <div className="mb-4 flex items-end justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-2xl font-bold">
                {data.electionInfo.status === "Candidate"
                  ? "The field"
                  : "Full standings"}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Party and coalition affiliations at a glance
            </p>
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {candidates.length} candidates
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(data.electionInfo.status === "Candidate"
            ? candidates
            : standings
          ).map((candidate, index) => {
            const projected =
              data.electionInfo?.status !== "Candidate" && index < seats;
            return (
              <Card
                key={candidate.id}
                className={cn(
                  "overflow-hidden border-l-4 shadow-xs transition-transform hover:-translate-y-0.5",
                  candidate.haswon && "ring-1 ring-emerald-500/40",
                )}
                style={{
                  borderLeftColor: candidate.partyColor ?? "var(--border)",
                }}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {data.electionInfo?.status !== "Candidate" && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-black">
                      {index + 1}
                    </span>
                  )}
                  {candidate.partyId ? (
                    <PartyLogo party_id={candidate.partyId} size={44} />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500 font-serif text-lg font-black text-white shadow-sm">
                      {candidate.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/dashboard/players/$playerId"
                        params={{ playerId: String(candidate.userId) }}
                        className="truncate font-bold hover:underline"
                      >
                        {candidate.username}
                      </Link>
                      <CandidateAffiliationBadges candidate={candidate} />
                      {(candidate.haswon || projected) && (
                        <Badge
                          variant={candidate.haswon ? "default" : "secondary"}
                          className="text-[10px] uppercase"
                        >
                          {candidate.haswon ? "Elected" : "Projected winner"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {data.electionInfo?.status !== "Candidate" && (
                    <div className="text-right">
                      <p className="font-mono text-xl font-black">
                        {candidate.votes ?? 0}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        points
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {candidates.length === 0 && (
            <p className="col-span-full border border-dashed p-10 text-center text-muted-foreground">
              No candidates have declared.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
