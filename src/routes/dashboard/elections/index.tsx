import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock3, LockKeyhole } from "lucide-react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWikiElections } from "@/lib/server/history";
import { formatElectionTitle, formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/elections/")({
  loader: () => getWikiElections(),
  component: ElectionsIndex,
});

function ElectionsIndex() {
  const { current, archived } = Route.useLoaderData();
  return (
    <WikiPage>
      <WikiHeader
        eyebrow={`${archived.length} certified elections`}
        title="Elections"
        description="Live campaign and voting data followed by an immutable snapshot when each result is certified."
      />
      <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
        <Button asChild size="sm">
          <Link to="/dashboard/elections/participate">Vote or run</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/parties/primaries">Presidential primaries</Link>
        </Button>
      </nav>
      <WikiSection title="In progress" icon={Clock3}>
        <div className="grid gap-4 md:grid-cols-2">
          {current.map((election) => (
            <Link
              key={election.election}
              to="/dashboard/elections/$electionId"
              params={{ electionId: `current-${election.election}` }}
            >
              <Card className="h-full rounded-sm border-primary/40 shadow-none hover:border-primary">
                <CardContent className="flex items-center justify-between gap-4 pt-5">
                  <div>
                    <p className="font-serif text-2xl font-bold">
                      {formatElectionTitle(election.election, election.cycle)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {election.daysLeft} days remaining
                    </p>
                  </div>
                  <Badge>
                    <Clock3 className="h-3 w-3" /> {election.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!current.length && (
            <div className="col-span-full">
              <WikiEmpty>No election is currently in progress.</WikiEmpty>
            </div>
          )}
        </div>
      </WikiSection>
      <WikiSection title="Certified results" icon={LockKeyhole}>
        <div>
          {archived.map((election) => (
            <Link
              key={election.id}
              to="/dashboard/elections/$electionId"
              params={{ electionId: String(election.id) }}
              className="wiki-record-row block hover:text-primary"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-serif text-xl font-bold">
                    {formatElectionTitle(election.election, election.cycle)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatWikiDate(election.concludedAt)} ·{" "}
                    {election.totalBallots} ballots · {election.totalPoints}{" "}
                    points
                  </p>
                </div>
                <Badge variant="outline">
                  <LockKeyhole className="h-3 w-3" /> Certified
                </Badge>
              </div>
            </Link>
          ))}
          {!archived.length && (
            <WikiEmpty>No election has been archived yet.</WikiEmpty>
          )}
        </div>
      </WikiSection>
    </WikiPage>
  );
}
