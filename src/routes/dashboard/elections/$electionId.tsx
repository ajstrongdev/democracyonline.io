import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { CandidatesChart } from "@/components/candidates-chart";
import {
  PartyMark,
  ResultBar,
  WikiHeader,
} from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { getWikiElection } from "@/lib/server/history";
import { getWikiArticle } from "@/lib/server/wiki-articles";
import {
  formatElectionTitle,
  formatWikiDate,
  getVoteShare,
} from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/elections/$electionId")({
  loader: async ({ params }) => {
    const [electionData, article] = await Promise.all([
      getWikiElection({ data: { id: params.electionId } }),
      getWikiArticle({
        data: { entityType: "election", entityId: params.electionId },
      }),
    ]);
    if (!electionData)
      throw new Response("Election not found", { status: 404 });
    return { electionData, article };
  },
  component: ElectionArticle,
});

function ElectionArticle() {
  const { electionData, article } = Route.useLoaderData();
  const { election, candidates, totalBallots } = electionData;
  const totalPoints = candidates.reduce(
    (total, candidate) => total + candidate.points,
    0,
  );
  const title = formatElectionTitle(election.election, election.cycle);
  const currentElection = electionData.current ? electionData.election : null;
  const currentDeadline = currentElection
    ? currentElection.status === "CANDIDACY"
      ? currentElection.candidacyEndsAt
      : currentElection.status === "VOTING"
        ? currentElection.votingEndsAt
        : currentElection.status === "ELECTION_NIGHT"
          ? currentElection.electionNightEndsAt
          : null
    : null;
  const description = electionData.current
    ? `${electionData.election.status.replaceAll("_", " ")} phase${currentDeadline ? ` until ${formatWikiDate(currentDeadline)}` : ""}. Published figures update as the race progresses.`
    : `Concluded ${formatWikiDate(electionData.election.concludedAt)}. This certified result is preserved as part of the permanent record.`;
  const entityId = electionData.current
    ? `current-${electionData.election.election}`
    : String(electionData.election.id);

  const chartCandidates = candidates.map((c, index) => ({
    id: (c as { id?: number }).id ?? index,
    userId: (c as { userId?: number }).userId ?? null,
    election: election.election as "President" | "Senate",
    votes: (c as { points?: number }).points ?? 0,
    haswon: (c as { elected?: boolean }).elected ?? false,
    username: c.username,
    partyId: (c as { partyId?: number }).partyId ?? null,
    partyName: c.partyName,
    partyColor: c.partyColor,
    partyLogo: null,
    coalitionId: null,
    coalitionName: null,
    coalitionColor: null,
    coalitionLogo: null,
  }));

  return (
    <WikiPage>
      <WikiHeader
        eyebrow={
          electionData.current
            ? "Election in progress"
            : "Certified election result"
        }
        title={title}
        description={description}
        status={
          <Badge variant={electionData.current ? "default" : "outline"}>
            {electionData.current ? (
              <Clock3 className="h-3 w-3" />
            ) : (
              <LockKeyhole className="h-3 w-3" />
            )}
            {electionData.current ? "Live" : "Certified"}
          </Badge>
        }
      />

      {!electionData.current && candidates.length > 0 && (
        <div className="mb-6">
          <CandidatesChart
            election={election.election as "President" | "Senate"}
            candidates={chartCandidates}
            seats={election.seats ?? 1}
            status="Concluded"
          />
        </div>
      )}

      <WikiStatGrid>
        <WikiStat label="Ballots" value={totalBallots} />
        <WikiStat label="Ranked points" value={totalPoints} />
        <WikiStat label="Seats" value={election.seats ?? 1} />
      </WikiStatGrid>
      <WikiArticleSection
        entityType="election"
        entityId={entityId}
        article={article}
      />
      <WikiSection
        title="Candidate results"
        description={
          electionData.current
            ? "Ranked-ballot points and first-preference totals."
            : "Ranked-ballot points and first-preference totals."
        }
      >
        <div>
          {candidates.map((candidate) => {
            const pointShare = getVoteShare(candidate.points, totalPoints);
            const firstShare = getVoteShare(
              candidate.firstPreferenceVotes,
              totalBallots,
            );
            const row = (
              <div className="wiki-record-row grid gap-4 md:grid-cols-[3rem_1fr_1.3fr] md:items-center">
                <div className="font-mono text-2xl font-bold text-muted-foreground">
                  #{candidate.placement}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-lg font-bold">
                      {candidate.username}
                    </p>
                    {candidate.elected && (
                      <Badge>
                        <CheckCircle2 className="h-3 w-3" /> Elected
                      </Badge>
                    )}
                  </div>
                  <PartyMark
                    name={candidate.partyName}
                    color={candidate.partyColor}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3 font-mono text-xs">
                    <span>{candidate.points} points</span>
                    <strong>{pointShare.toFixed(1)}%</strong>
                  </div>
                  <ResultBar value={pointShare} />
                  <p className="text-xs text-muted-foreground">
                    {candidate.firstPreferenceVotes} first preferences (
                    {firstShare.toFixed(1)}%)
                  </p>
                </div>
              </div>
            );
            return candidate.userId ? (
              <Link
                key={candidate.userId}
                to="/dashboard/players/$playerId"
                params={{ playerId: String(candidate.userId) }}
                className="block"
              >
                {row}
              </Link>
            ) : (
              <div key={candidate.username}>{row}</div>
            );
          })}
          {!candidates.length && (
            <WikiEmpty>No candidates have entered this race.</WikiEmpty>
          )}
        </div>
      </WikiSection>
    </WikiPage>
  );
}
