import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Clock3, LockKeyhole, Radio, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage } from "@/components/wiki/wiki-layout";
import { getWikiElections } from "@/lib/server/history";
import { formatElectionTitle, formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/elections/")({
  loader: async () => {
    const { archived, current } = await getWikiElections();
    return { archived, current };
  },
  component: ElectionsPage,
});

function ElectionsPage() {
  const { archived, current } = Route.useLoaderData();

  return (
    <WikiPage>
      <WikiHeader
        eyebrow="Public record"
        title="National elections"
        description="Follow the current cycle and browse every certified presidential and Senate result."
        status={
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <LockKeyhole className="h-3 w-3" />
            Certified
          </span>
        }
      />

      {current.length > 0 && (
        <section className="wiki-section">
          <header className="wiki-section-header">
            <div>
              <h2 className="wiki-section-title">
                <Radio className="h-4 w-4 text-primary" /> Current cycle
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live schedules, candidates, and published results.
              </p>
            </div>
          </header>
          <div className="wiki-section-content divide-y border-y">
            {current.map((election) => (
              <Link
                key={election.election}
                to="/dashboard/elections/$electionId"
                params={{ electionId: `current-${election.election}` }}
                className="group flex flex-col gap-3 px-4 py-4 hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <Clock3 className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold group-hover:text-primary">
                    {formatElectionTitle(election.election, election.cycle)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {election.seats ?? 1}{" "}
                    {election.seats === 1 ? "seat" : "seats"}
                  </p>
                </div>
                <Badge
                  variant={
                    election.status === "CONCLUDED" ? "outline" : "default"
                  }
                >
                  {election.status.replaceAll("_", " ")}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="wiki-section">
        <header className="wiki-section-header">
          <div>
            <h2 className="wiki-section-title">
              <LockKeyhole className="h-4 w-4 text-primary" /> Certified record
            </h2>
          </div>
        </header>
        <div className="wiki-section-content space-y-3">
          {archived.length === 0 ? (
            <WikiEmpty>No elections have concluded yet.</WikiEmpty>
          ) : (
            archived.map((election) => (
              <Link
                key={election.id}
                to="/dashboard/elections/$electionId"
                params={{ electionId: String(election.id) }}
                className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold group-hover:text-primary">
                    {formatElectionTitle(election.election, election.cycle)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Concluded {formatWikiDate(election.concludedAt)} ·{" "}
                    {election.totalBallots} ballots ·{" "}
                    {election.totalPoints.toLocaleString()} points
                  </p>
                </div>
                <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                  {election.seats ?? 1}{" "}
                  {election.seats === 1 ? "seat" : "seats"}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </WikiPage>
  );
}
