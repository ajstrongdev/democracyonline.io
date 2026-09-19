import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  Flag,
  Landmark,
  Radio,
  ScrollText,
  Settings,
  Users,
  Vote,
} from "lucide-react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { getDashboardData } from "@/lib/server/dashboard";
import { formatElectionTitle, formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/")({
  loader: () => getDashboardData(),
  component: Dashboard,
});

const archiveSections = [
  {
    to: "/dashboard/players",
    title: "Players",
    key: "players",
    description: "Officeholders, candidacies, authored bills, and votes.",
    icon: Users,
  },
  {
    to: "/dashboard/bills",
    title: "Bill archive",
    key: "bills",
    description: "Legislation and complete roll-call records.",
    icon: ScrollText,
  },
  {
    to: "/dashboard/elections",
    title: "Election archive",
    key: "elections",
    description: "Live races and immutable certified results.",
    icon: Landmark,
  },
  {
    to: "/dashboard/parties",
    title: "Party archive",
    key: "parties",
    description: "Party histories, representation, and membership.",
    icon: Flag,
  },
] as const;

function LiveLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
      </span>
      Live
    </span>
  );
}

function Dashboard() {
  const {
    currentUser,
    pendingBillVotes,
    pendingElectionBallots,
    activity,
    electionRows,
    counts,
    recentElections,
  } = Route.useLoaderData();
  const actionCount = pendingBillVotes.length + pendingElectionBallots.length;

  return (
    <WikiPage>
      <WikiHeader
        eyebrow={
          currentUser
            ? `${currentUser.role ?? "Citizen"} desk`
            : "Official record and game desk"
        }
        title={
          currentUser
            ? `Welcome back, ${currentUser.username}`
            : "Democracy Online"
        }
        description={
          currentUser
            ? "Your next moves, the live state of the game, and the permanent public record in one place."
            : "The live state and permanent public record of Democracy Online. Sign in to see your next moves."
        }
        status={<LiveLabel />}
      />

      {currentUser && (
        <WikiSection
          title="Your next moves"
          icon={BellRing}
          description="Only actions currently available to your account appear here."
          aside={
            <span className="font-mono text-xs text-muted-foreground">
              {actionCount} pending
            </span>
          }
        >
          {actionCount ? (
            <div className="divide-y border-y">
              {pendingBillVotes.map((bill) => (
                <Link
                  key={`bill-${bill.id}`}
                  to={bill.route as "/dashboard/bills"}
                  search={{ desk: bill.stage }}
                  className="group flex flex-col gap-3 px-3 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 gap-3">
                    <Vote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold">Vote on {bill.title}</p>
                      <p className="text-sm text-muted-foreground">
                        A vote is waiting in the {bill.chamber}.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Go to chamber{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
              {pendingElectionBallots.map((election) => (
                <Link
                  key={`election-${election.election}`}
                  to="/dashboard/elections/participate"
                  className="group flex flex-col gap-3 px-3 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 gap-3">
                    <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold">
                        Elections are open: submit your{" "}
                        {election.election.toLowerCase()} ballot
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {election.candidateCount} candidates ·{" "}
                        {election.daysLeft} days remaining
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Open ballot{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 border border-dashed px-4 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              You are caught up. New votes and ballots will appear here.
            </div>
          )}
        </WikiSection>
      )}

      {currentUser && (
        <WikiStatGrid>
          <WikiStat label="Office" value={currentUser.role ?? "Citizen"} />
          <WikiStat
            label="Party"
            value={currentUser.partyName ?? "Independent"}
            detail={currentUser.politicalLeaning ?? undefined}
          />
          <WikiStat label="Pending actions" value={actionCount} />
          <WikiStat
            label="Player record"
            value={
              <Link
                to="/dashboard/players/$playerId"
                params={{ playerId: String(currentUser.id) }}
                className="text-primary hover:underline"
              >
                View profile
              </Link>
            }
          />
        </WikiStatGrid>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
        <WikiSection title="Game status" icon={Radio} aside={<LiveLabel />}>
          <div className="divide-y border-y">
            {electionRows.map((election) => (
              <Link
                key={election.election}
                to="/dashboard/elections"
                className="wiki-record-row flex items-center justify-between gap-4 hover:text-primary"
              >
                <span>
                  <strong>{election.election}</strong>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {election.status}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {election.daysLeft} days
                </span>
              </Link>
            ))}
            <Link
              to="/calendar"
              className="wiki-record-row flex items-center justify-between gap-4 hover:text-primary"
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4" /> Full game calendar
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </WikiSection>

        <WikiSection title="Quick access" icon={Building2}>
          <nav className="grid grid-cols-2 gap-px overflow-hidden border bg-border text-sm">
            {[
              ["Bills", "/dashboard/bills", ScrollText],
              ["Elections", "/dashboard/elections", Landmark],
              ["Parties", "/dashboard/parties", Flag],
              ["Primaries", "/dashboard/parties/primaries", Vote],
              ["Find players", "/dashboard/players", Users],
              ["Settings", "/settings", Settings],
            ].map(([label, to, Icon]) => (
              <Link
                key={to as string}
                to={to as "/dashboard/bills"}
                className="flex items-center gap-2 bg-card px-3 py-4 font-semibold hover:bg-muted/50 hover:text-primary"
              >
                <Icon className="h-4 w-4" /> {label as string}
              </Link>
            ))}
          </nav>
        </WikiSection>
      </div>

      <WikiSection
        title="Latest activity"
        icon={BellRing}
        aside={<LiveLabel />}
      >
        <div>
          {activity.map((item) => (
            <div
              key={item.id}
              className="wiki-record-row flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <p className="text-sm">
                <span className="font-semibold">
                  {item.username ?? "System"}
                </span>
                {": "}
                <span className="text-muted-foreground">{item.content}</span>
              </p>
              <time className="shrink-0 font-mono text-xs text-muted-foreground">
                {item.createdAt ? formatWikiDate(item.createdAt) : "Unknown"}
              </time>
            </div>
          ))}
          {!activity.length && (
            <WikiEmpty>No activity has been recorded yet.</WikiEmpty>
          )}
          <Link
            to="/feed"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View complete activity <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </WikiSection>

      <WikiSection
        title="Official record"
        icon={Building2}
        description="Continuously updated public records and certified history."
        aside={<LiveLabel />}
      >
        <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {archiveSections.map(
            ({ to, title, key, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group bg-card p-4 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-mono text-2xl font-bold">
                    {counts[key]}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {description}
                </p>
              </Link>
            ),
          )}
        </div>
        <div className="mt-5">
          <h3 className="wiki-kicker mb-2">Latest certified results</h3>
          {recentElections.map((election) => (
            <Link
              key={election.id}
              to="/dashboard/elections/$electionId"
              params={{ electionId: String(election.id) }}
              className="wiki-record-row flex items-center justify-between gap-4 hover:text-primary"
            >
              <span className="font-semibold">
                {formatElectionTitle(election.election, election.cycle)}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatWikiDate(election.concludedAt)}
              </span>
            </Link>
          ))}
        </div>
      </WikiSection>
    </WikiPage>
  );
}
