import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Landmark,
  Radio,
  ScrollText,
  Users,
  Vote,
} from "lucide-react";
import {
  DashboardElectionHub,
  isElectionNightActive,
} from "@/components/dashboard-election-hub";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { getDashboardData } from "@/lib/server/dashboard";
import { formatWikiDate } from "@/lib/utils/history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  loader: () => getDashboardData(),
  component: Dashboard,
});

const quickAccessLinks = [
  { label: "Government", to: "/dashboard/government", icon: Building2 },
  { label: "Nation", to: "/dashboard/nation", icon: Flag },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
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
    pendingCommitteeAssessments,
    activity,
    electionDashboard,
    counts,
    nation,
  } = Route.useLoaderData();
  const actionCount =
    pendingBillVotes.length + pendingCommitteeAssessments.length;
  const electionNight = isElectionNightActive(electionDashboard);

  return (
    <WikiPage className={cn(electionNight && "dark")}>
      {electionNight && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-600/10 px-4 py-3">
          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
          <p className="text-sm font-semibold text-red-400">
            Election night is live — results are coming in now
          </p>
        </div>
      )}

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
            ? electionNight
              ? "Election night is underway. Watch the results roll in below."
              : "Your next moves, the live state of the game, and the permanent public record in one place."
            : "The live state and permanent public record of Democracy Online. Sign in to see your next moves."
        }
        status={!electionNight ? <LiveLabel /> : undefined}
      />

      {electionNight && (
        <DashboardElectionHub
          initialData={electionDashboard}
          currentUser={currentUser}
        />
      )}

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
                  to={bill.route}
                  search={{
                    desk: bill.stage,
                  }}
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
              {pendingCommitteeAssessments.map((bill) => (
                <Link
                  key={`assessment-${bill.id}`}
                  to="/dashboard/bills/$billId"
                  params={{ billId: String(bill.id) }}
                  className="group flex flex-col gap-3 px-3 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 gap-3">
                    <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold">Assess {bill.title}</p>
                      <p className="text-sm text-muted-foreground">
                        The Committee is waiting for your assessment of this
                        bill's national effects.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Open assessment
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 border border-dashed px-4 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              You are caught up. New legislative actions will appear here.
            </div>
          )}
        </WikiSection>
      )}

      {!electionNight && (
        <DashboardElectionHub
          initialData={electionDashboard}
          currentUser={currentUser}
        />
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

      {nation && (
        <WikiSection
          title={nation.name}
          icon={Landmark}
          description="The current national picture, shaped by legislation passed in the game."
          aside={
            <Link
              to="/dashboard/nation"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Explore nation <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          <Link to="/dashboard/nation" className="group block">
            <div className="divide-y border-y bg-card">
              <NationPulse label="Civil rights" value={nation.civilRights} />
              <NationPulse label="Economy" value={nation.economy} />
              <NationPulse
                label="Political freedoms"
                value={nation.politicalFreedoms}
              />
            </div>
          </Link>
        </WikiSection>
      )}

      <WikiSection title="Quick access" icon={Users}>
        <nav className="divide-y border-y bg-card text-sm">
          {quickAccessLinks.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50"
            >
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              <span className="font-semibold">{label}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
            </Link>
          ))}
        </nav>
      </WikiSection>

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
        icon={ScrollText}
        description="Continuously updated public records and certified history."
      >
        <div className="divide-y border-y bg-card">
          {[
            {
              to: "/dashboard/players",
              title: "Players",
              count: counts.players,
              description:
                "Officeholders, candidacies, authored bills, and votes.",
              icon: Users,
            },
            {
              to: "/dashboard/bills",
              title: "Bill archive",
              count: counts.bills,
              description: "Legislation and complete roll-call records.",
              icon: ScrollText,
            },
            {
              to: "/dashboard/elections",
              title: "Election archive",
              count: counts.elections,
              description: "Live national races and certified results.",
              icon: Landmark,
            },
            {
              to: "/dashboard/parties",
              title: "Party archive",
              count: counts.parties,
              description: "Party histories, representation, and membership.",
              icon: Vote,
            },
          ].map(({ to, title, count, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 px-4 py-4 hover:bg-muted/40 sm:px-5"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="shrink-0 font-mono text-2xl font-bold tabular-nums text-muted-foreground">
                {count}
              </span>
            </Link>
          ))}
        </div>
      </WikiSection>
    </WikiPage>
  );
}

function NationPulse({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 transition-colors group-hover:bg-muted/30 sm:px-5">
      <span className="wiki-kicker shrink-0">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
      </div>
      <strong className="shrink-0 font-mono text-sm tabular-nums">
        {Math.round(value)}
      </strong>
    </div>
  );
}
