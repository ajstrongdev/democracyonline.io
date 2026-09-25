import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  History,
  Landmark,
  MessageSquareText,
  Radio,
  ScrollText,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { ZNotifications } from "@/components/social/z-notifications";
import { Button } from "@/components/ui/button";
import { getFeedItems } from "@/lib/server/feed";
import { getFeedDestination } from "@/lib/feed-destination";

dayjs.extend(relativeTime);

export const Route = createFileRoute("/dashboard/")({
  loader: () => getDashboardData(),
  component: Dashboard,
});

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

function formatGreetingRole(role: string | null | undefined) {
  if (role === "President") return "President";
  if (role === "Senator") return "Sen.";
  if (role === "Representative") return "Rep.";
  return role ?? "Citizen";
}

function Dashboard() {
  const {
    currentUser,
    pendingBillVotes,
    pendingCommitteeAssessments,
    zMentionSummary,
    activity,
    electionDashboard,
    counts,
    nation,
  } = Route.useLoaderData();
  const actionCount =
    pendingBillVotes.length + pendingCommitteeAssessments.length;
  const electionNight = isElectionNightActive(electionDashboard);
  const [activityItems, setActivityItems] = useState(() => activity.slice(0, 6));
  const [hasMoreActivity, setHasMoreActivity] = useState(activity.length > 6);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState(false);

  const loadMoreActivity = async () => {
    if (loadingActivity) return;
    setLoadingActivity(true);
    setActivityError(false);
    try {
      const next = await getFeedItems({
        data: { limit: 7, offset: activityItems.length },
      });
      setActivityItems((current) => [...current, ...next.slice(0, 6)]);
      setHasMoreActivity(next.length > 6);
    } catch {
      setActivityError(true);
    } finally {
      setLoadingActivity(false);
    }
  };

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
        title={
          currentUser
            ? `Welcome back, ${formatGreetingRole(currentUser.role)} ${currentUser.username}`
            : "Welcome to Oscana."
        }
        description={
          currentUser
            ? electionNight
              ? "Election night is underway. Watch the results roll in below."
              : `Everything at a glance, welcome to your office ${currentUser.role}!`
            : "Everything at a glance, welcome to Oscana!"
        }
        status={!electionNight ? <LiveLabel /> : undefined}
      >
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
      </WikiHeader>

      {(currentUser || nation) && (
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {currentUser && (
            <WikiSection
              title="Game notifications"
              icon={BellRing}
              description="Game actions that need your attention."
              className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
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
                        Go to chamber
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
                            The Senate Committee is waiting for your assessment
                            of this bill's national effects.
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

          {currentUser && (
            <WikiSection
              title="Z.com notifications"
              icon={MessageSquareText}
              description="Mentions across the social accounts you control."
              className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
            >
              <ZNotifications initialPage={zMentionSummary} />
            </WikiSection>
          )}

          {nation && (
            <WikiSection
              title="National health"
              icon={Landmark}
              description={`A snapshot of ${nation.name} across three headline measures.`}
              className="flex h-full flex-col [&>.wiki-section-content]:flex-1 md:col-span-2"
              aside={
                <Link
                  to="/dashboard/nation"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  Explore <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              <Link to="/dashboard/nation" className="group block">
                <div className="grid overflow-hidden border bg-card md:grid-cols-3 md:divide-x">
                  <NationPulse
                    label="Civil rights"
                    value={nation.civilRights}
                    icon={ShieldCheck}
                  />
                  <NationPulse
                    label="Economy"
                    value={nation.economy}
                    icon={Activity}
                  />
                  <NationPulse
                    label="Political freedoms"
                    value={nation.politicalFreedoms}
                    icon={Landmark}
                  />
                </div>
              </Link>
            </WikiSection>
          )}
        </div>
      )}

      <DashboardElectionHub
        initialData={electionDashboard}
        currentUser={currentUser}
      />

      <WikiSection
        title="Quick access"
        icon={Users}
        description="Explore government, daily tools, and public records."
      >
        <nav className="grid gap-px overflow-hidden border-y bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              to: "/social",
              title: "Z.com",
              description: "Post updates, reply, like, and repost across the community.",
              icon: MessageSquareText,
            },
            {
              to: "/dashboard/bills",
              title: "Bills",
              description: "Legislation and roll-call records.",
              count: counts.bills,
              icon: ScrollText,
            },
            {
              to: "/dashboard/nation",
              title: "Nation",
              description: "National profile and current state.",
              icon: Flag,
            },
            {
              to: "/dashboard/parties",
              title: "Parties",
              description: "Party histories and representation.",
              count: counts.parties,
              icon: Vote,
            },
            {
              to: "/dashboard/elections",
              title: "Election Archive",
              description: "National races and certified results.",
              count: counts.elections,
              icon: Landmark,
            },
            {
              to: "/dashboard/government",
              title: "Historical Composition",
              description: "How the composition of government has changed.",
              icon: History,
            },
            {
              to: "/dashboard/players",
              title: "Players",
              description: "Officeholders, candidates, and their records.",
              count: counts.players,
              icon: Users,
            },
          ].map(({ to, title, description, count, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-h-24 min-w-0 items-start gap-3 bg-card px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{title}</span>
                  {count !== undefined && (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {description}
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
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
          {activityItems.map((item) => (
            <a
              key={item.id}
              href={getFeedDestination(item.content, item.userId)}
              className="wiki-record-row group flex flex-col gap-2 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                {item.username && <PlayerAvatar username={item.username} photoUrl={item.photoUrl} className="size-12" />}
                <p className="min-w-0 pt-1 text-sm leading-relaxed">
                  <span className="font-semibold">{item.username ?? "System"}</span>{": "}
                  <span className="text-muted-foreground">{item.content}</span>
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                <time
                  className="font-mono text-xs text-muted-foreground"
                  dateTime={item.createdAt ? new Date(item.createdAt).toISOString() : undefined}
                  title={item.createdAt ? dayjs(item.createdAt).format("MMMM D, YYYY h:mm A") : undefined}
                >
                  {item.createdAt ? dayjs(item.createdAt).fromNow() : "Unknown"}
                </time>
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  View details <ArrowRight className="size-3.5" />
                </span>
              </span>
            </a>
          ))}
          {!activityItems.length && (
            <WikiEmpty>No activity has been recorded yet.</WikiEmpty>
          )}
          {activityError && <p role="alert" className="mt-3 text-sm text-destructive">Could not load more activity. Please try again.</p>}
          <div className="mt-5 flex justify-center">
            <Button type="button" size="lg" className="w-full min-w-52 font-semibold sm:w-auto" disabled={!hasMoreActivity || loadingActivity} onClick={loadMoreActivity}>
              {loadingActivity ? "Loading…" : hasMoreActivity ? "Load more activity" : "All activity loaded"}
            </Button>
          </div>
        </div>
      </WikiSection>
    </WikiPage>
  );
}

function NationPulse({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  const description =
    value >= 70 ? "Strong" : value >= 40 ? "Developing" : "Under pressure";

  return (
    <div className="p-4 transition-colors group-hover:bg-muted/30 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="wiki-kicker">{label}</p>
          <p className="mt-1 font-serif text-3xl font-bold">
            {Math.round(value)}
          </p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
