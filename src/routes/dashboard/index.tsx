import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  Flag,
  History,
  Landmark,
  LifeBuoy,
  MailPlus,
  MessageSquareText,
  Radio,
  ScrollText,
  Users,
  Vote,
} from "lucide-react";
import type { getDashboardData } from "@/lib/server/dashboard";
import {
  CompactCandidacyStatus,
  DashboardElectionBallot,
  DashboardElectionHub,
  canDeclareNationalCandidacy,
  isElectionNightActive,
} from "@/components/dashboard-election-hub";
import { DashboardActionDeadline } from "@/components/dashboard-action-deadline";
import { DashboardPrimaryAction } from "@/components/dashboard-primary-action";
import { DashboardSocialPostDialog } from "@/components/dashboard-social-post-dialog";
import { NewBillDialog } from "@/components/wiki/bill-desk-dialogs";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { ZNotifications } from "@/components/social/z-notifications";
import { Button } from "@/components/ui/button";
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog";
import { getFeedItems } from "@/lib/server/feed";
import { getFeedDestination } from "@/lib/feed-destination";
import { DashboardBillVoteAction } from "@/components/dashboard-bill-vote-action";

dayjs.extend(relativeTime);

export const Route = createFileRoute("/dashboard/")({
  component: () => null,
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

export function DashboardContent({ data }: { data: Awaited<ReturnType<typeof getDashboardData>> }) {
  const router = useRouter();
  const {
    currentUser,
    pendingBillVotes,
    pendingCommitteeAssessments,
    primaryActions,
    zMentionSummary,
    activity,
    electionDashboard,
    counts,
    recentBills,
  } = data;
  const electionVotes = currentUser?.active
    ? electionDashboard.races.filter((race) => race.status === "VOTING" && !race.player.hasVoted && race.candidates.length > 0)
    : [];
  const nationalCandidacies = currentUser?.active
    ? electionDashboard.races.filter((race) => canDeclareNationalCandidacy(race, electionDashboard.races, currentUser))
    : [];
  const actionCount =
    pendingBillVotes.length + pendingCommitteeAssessments.length + Number(primaryActions.stand) + Number(primaryActions.vote) + electionVotes.length + nationalCandidacies.length;
  const electionNight = isElectionNightActive(electionDashboard);
  const [activityItems, setActivityItems] = useState(() => activity.slice(0, 6));
  const [hasMoreActivity, setHasMoreActivity] = useState(activity.length > 6);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    setActivityItems(activity.slice(0, 6));
    setHasMoreActivity(activity.length > 6);
  }, [activity]);

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
    <WikiPage>
      {electionNight && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-600/10 px-4 py-3">
          <Radio className="h-4 w-4 animate-pulse text-red-700 dark:text-red-400" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
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
        description={currentUser ? (actionCount ? `You have ${actionCount} ${actionCount === 1 ? "action" : "actions"} to take. Start below.` : "You're caught up. Explore what's happening in Oscana below.") : "See what's happening and learn how to play."}
        status={!electionNight ? <LiveLabel /> : undefined}
      >
        {currentUser && (
          <WikiStatGrid>
            <WikiStat label="Office" value={currentUser.role ?? "Citizen"} />
            <WikiStat label="Party" value={currentUser.partyName ?? "Independent"} detail={currentUser.politicalLeaning ?? undefined} />
            <WikiStat label="Pending actions" value={<a href="#next-moves" className="text-primary hover:underline">{actionCount}</a>} />
            <WikiStat label="Player record" value={
              <Link to="/dashboard/players/$playerId" params={{ playerId: String(currentUser.id) }} className="text-primary hover:underline">View profile</Link>
            } />
          </WikiStatGrid>
        )}
      </WikiHeader>

      {currentUser && (
        <div id="next-moves" className="grid scroll-mt-20 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
             <WikiSection
               title="Your next moves"
               icon={BellRing}
               description="Only the decisions waiting for you. Finished actions disappear."
              className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
              aside={
                <span className="font-mono text-xs text-muted-foreground">
                  {actionCount} pending
                </span>
              }
            >
              {actionCount ? (
                <div className="divide-y border-y">
                  {primaryActions.stand && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                      <span className="space-y-1"><span className="block font-semibold">Stand in your presidential primary</span><DashboardActionDeadline deadline={primaryActions.deadline} onExpire={() => void router.invalidate()} /></span>
                      <DashboardPrimaryAction />
                    </div>
                  )}
                  {primaryActions.vote && (
                    <Link to="/dashboard/parties/primaries" className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-muted/30">
                      <span className="space-y-1"><span className="block font-semibold">Vote in your presidential primary</span><DashboardActionDeadline deadline={primaryActions.deadline} onExpire={() => void router.invalidate()} /></span>
                      <span className="text-sm font-semibold text-primary">Vote now →</span>
                    </Link>
                  )}
                  {nationalCandidacies.map((race) => (
                    <div key={`declare-${race.election}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                      <span className="space-y-1"><span className="flex items-center gap-2 font-semibold">{race.election === "Senate" ? <Landmark className="size-4 shrink-0 text-primary" /> : <Crown className="size-4 shrink-0 text-primary" />} Stand in the {race.election} election</span><DashboardActionDeadline deadline={race.timestamps.candidacyEndsAt} onExpire={() => void router.invalidate()} /></span>
                      <CompactCandidacyStatus race={race} races={electionDashboard.races} currentUser={currentUser} onActionComplete={() => void router.invalidate()} />
                    </div>
                  ))}
                  {electionVotes.map((race) => (
                    <div key={race.election} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                      <span className="space-y-1"><span className="block font-semibold">Vote in the {race.election} election</span><DashboardActionDeadline deadline={race.timestamps.votingEndsAt} onExpire={() => void router.invalidate()} /></span>
                      <DashboardElectionBallot race={race} currentUser={currentUser} onActionComplete={() => void router.invalidate()} />
                    </div>
                  ))}
                   {pendingBillVotes.map((bill) => (
                     <div
                       key={`bill-${bill.id}`}
                       className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                    >
                      <div className="flex min-w-0 gap-3">
                        <Vote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                           <Link to="/dashboard/bills/$billId" params={{ billId: String(bill.id) }} className="font-semibold text-primary hover:underline">Vote on {bill.title}</Link>
                           <p className="text-sm text-muted-foreground">
                             A vote is waiting in the {bill.chamber}.
                           </p>
                           <DashboardActionDeadline deadline={bill.stageEndsAt} onExpire={() => void router.invalidate()} />
                        </div>
                      </div>
                       <DashboardBillVoteAction billId={bill.id} title={bill.title} stage={bill.stage} userId={currentUser.id} />
                     </div>
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
                           <DashboardActionDeadline deadline={bill.stageEndsAt} onExpire={() => void router.invalidate()} />
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
                   You are caught up. New game actions will appear here.
                </div>
              )}
             </WikiSection>

              <WikiSection
                title="Your notifications"
               icon={MessageSquareText}
               description="Mentions across accounts you control."
                className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
            >
              <ZNotifications initialPage={zMentionSummary} />
              </WikiSection>

         </div>
        )}

      <div className={currentUser?.active ? "grid items-stretch gap-6 lg:grid-cols-2" : ""}>
        {currentUser?.active && (
        <WikiSection title="Take initiative" icon={Vote} description="Start something new without leaving your dashboard." className="h-full">
          <div className="grid gap-px overflow-hidden border-y bg-border">
            <NewBillDialog userId={currentUser.id} dashboardCommand trigger={
              <button type="button" className="group flex min-h-24 min-w-0 items-start gap-3 bg-card px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-5">
                <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="min-w-0 flex-1"><span className="block font-semibold">Draft a bill</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Submit a proposal to the Senate Committee.</span></span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
              </button>
            } />
            <DashboardSocialPostDialog user={currentUser} />
          </div>
        </WikiSection>
        )}

      <WikiSection title="Explore Oscana" icon={Users} description="Browse the community and learn how the game works." className="h-full">
        <nav aria-label="Explore Oscana" className="grid gap-px overflow-hidden border-y bg-border sm:grid-cols-2">
          {[
            { to: "/dashboard/social", title: "Z.com", description: "Join the public conversation.", icon: MessageSquareText },
            { to: "/dashboard/parties", title: "Parties", description: "Find your political home.", icon: Vote, count: counts.parties },
            { to: "/dashboard/players", title: "Players", description: "Meet the people shaping Oscana.", icon: Users, count: counts.players },
            { to: "/dashboard/guide", title: "Player guide", description: "How to take part and get started.", icon: LifeBuoy },
          ].map(({ to, title, description, icon: Icon, count }) => (
            <Link key={to} to={to} search={to === "/dashboard/social" ? { postId: undefined, commentId: undefined } : undefined} className="group flex min-h-24 min-w-0 items-start gap-3 bg-card px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><span className="font-semibold">{title}</span>{count !== undefined && <span className="font-mono text-xs text-muted-foreground">{count}</span>}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
            </Link>
          ))}
        </nav>
        <details className="mt-4 border-t pt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-primary">More records and tools</summary>
          <nav aria-label="More records and tools" className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><Link to="/dashboard/nation"><Flag className="size-4" /> Nation</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/dashboard/government"><History className="size-4" /> Government history</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/dashboard/elections"><Landmark className="size-4" /> Election archive</Link></Button>
            {currentUser && <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}><MailPlus className="size-4" /> Invite a player</Button>}
          </nav>
        </details>
        {currentUser && <AccountSettingsDialog open={inviteOpen} onOpenChange={setInviteOpen} initialTab="invites" />}
      </WikiSection>
      </div>

      <div className={electionNight ? "space-y-6" : "grid items-start gap-6 lg:grid-cols-2"}>
        <WikiSection
          title="Bill status"
          icon={ScrollText}
          description="Where current proposals stand. Your votes appear above."
          aside={<Link to="/dashboard/bills" className="text-sm font-semibold text-primary hover:underline">All bills</Link>}
        >
          {recentBills.length ? (
            <div className="divide-y border-y">
              {recentBills.map((bill) => (
                <Link key={bill.id} to="/dashboard/bills/$billId" params={{ billId: String(bill.id) }} className="flex min-w-0 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted/30">
                  <span className="min-w-0 truncate">#{bill.id} {bill.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{bill.status} · {bill.stage}</span>
                </Link>
              ))}
            </div>
          ) : <WikiEmpty>No bills yet.</WikiEmpty>}
        </WikiSection>

        <DashboardElectionHub initialData={electionDashboard} currentUser={currentUser} actionsInQueue />
      </div>

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
