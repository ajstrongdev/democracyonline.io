import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Landmark,
  MessageSquareText,
  ScrollText,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage, WikiSection } from "@/components/wiki/wiki-layout";

export const Route = createFileRoute("/dashboard/guide")({
  component: PlayerGuide,
});

const firstSteps = [
  {
    title: "Make your player yours",
    text: "Open account settings to choose a username, write a short bio, set your pronouns, and build an avatar. Other players will see this around Oscana.",
  },
  {
    title: "Find your place in politics",
    text: "Browse the active parties and their platforms. You can join a party, start one, or stay independent. Party membership can connect you with other players who share your goals.",
  },
  {
    title: "Check what needs you",
    text: "Your dashboard shows pending votes, committee work, election updates, and mentions. Check it often because some actions are only available during a particular stage.",
  },
];

const legislationSteps = [
  "Read the bill and check its current stage before you act.",
  "When a vote is open in your chamber, open the bill desk from the Bills page and cast your vote.",
  "If you are serving on the Senate Committee, review the bill's likely effects on the nation and submit your assessment when asked.",
  "Discuss the proposal on its bill page. Comments support Markdown and references, and also appear on Z.com.",
];

function PlayerGuide() {
  return (
    <WikiPage>
      <WikiHeader
        eyebrow="A guide for players"
        title="Your first days in Oscana"
        description="Oscana is a shared political world. Players organise, campaign, debate proposals, and help shape the country together. You do not need to learn everything at once. Start with what interests you and follow the live stages as they change."
      />

      <WikiSection
        title="Start here"
        icon={BookOpen}
        description="A few small steps will help you find your feet."
      >
        <ol className="grid gap-px overflow-hidden border-y bg-border md:grid-cols-3">
          {firstSteps.map((step, index) => (
            <li key={step.title} className="bg-card p-5">
              <span className="font-mono text-xs font-bold text-primary">
                STEP 0{index + 1}
              </span>
              <h3 className="mt-2 font-serif text-lg font-bold">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </WikiSection>

      <WikiSection
        title="How to use your dashboard"
        icon={CheckCircle2}
        description="Think of the dashboard as your daily briefing. It brings together the parts of the game that need your attention."
      >
        <div className="grid gap-4 text-sm leading-6 md:grid-cols-3">
          <div className="border-l-2 border-primary/40 pl-4">
            <h3 className="font-semibold">Start with pending actions</h3>
            <p className="mt-1 text-muted-foreground">
              The notifications section lists votes and committee assessments
              waiting for you. Open an item to go straight to the relevant bill
              or chamber.
            </p>
          </div>
          <div className="border-l-2 border-primary/40 pl-4">
            <h3 className="font-semibold">Check the election desk</h3>
            <p className="mt-1 text-muted-foreground">
              See whether nominations, voting, or result reporting is underway.
              Available actions change with the election stage.
            </p>
          </div>
          <div className="border-l-2 border-primary/40 pl-4">
            <h3 className="font-semibold">Follow what changed</h3>
            <p className="mt-1 text-muted-foreground">
              National health gives you a quick snapshot. Latest activity links
              to the bill, election, player, or conversation behind an update.
            </p>
          </div>
        </div>
      </WikiSection>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <WikiSection
          className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
          title="How laws move"
          icon={ScrollText}
          description="Bills move through stages. The open stage tells you where discussion or action is happening now."
        >
          <div className="space-y-4 text-sm leading-6">
            <p>
              A player proposes a bill, which begins in Senate Committee. The
              Committee assesses its effects on the nation. A bill that passes
              committee moves through the House and Senate votes, then goes to
              the President for a final decision.
            </p>
            <ol className="space-y-2 border-l-2 border-primary/30 pl-4">
              {[
                "Proposal and Senate Committee",
                "House vote",
                "Senate vote",
                "Presidential decision",
              ].map((stage, index) => (
                <li key={stage} className="relative">
                  <span className="absolute -left-[1.32rem] top-2 size-2 rounded-full bg-primary" />
                  <strong>
                    {index + 1}. {stage}
                  </strong>
                </li>
              ))}
            </ol>
            <h3 className="font-semibold">When you open a bill</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              {legislationSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-muted-foreground">
              Passing a bill can change national statistics or policies. The
              bill page shows its text, current status, discussion, party
              guidance, and recorded votes.
            </p>
            <GuideLink to="/dashboard/bills" icon={ScrollText}>
              Browse bills and open the bill desk
            </GuideLink>
          </div>
        </WikiSection>

        <WikiSection
          className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
          title="Elections and office"
          icon={Vote}
          description="Campaigns happen in stages, so follow the current election page for what is open."
        >
          <div className="space-y-4 text-sm leading-6">
            <p>
              Elections begin with nominations. Presidential candidates first
              compete in party primaries, and the primary winners advance to the
              national race. Senate elections fill the seats shown for that
              cycle. When voting closes, results are revealed during election
              night and then added to the public record.
            </p>
            <p>
              You can take part by running when nominations are open, voting
              when the polls are open, and following results as they arrive.
              Your dashboard highlights actions that are currently waiting for
              you.
            </p>
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">How your ranked ballot works</h3>
              <p className="mt-2 text-muted-foreground">
                Put every candidate in order, with your favourite first. Your
                ranking gives each candidate a different number of points. With
                four candidates, your first choice gets four points, your second
                gets three, then two and one. The total points decide the
                result. For Senate races, the highest-scoring candidates fill
                the seats available. For President, the top candidate wins the
                single seat.
              </p>
              <p className="mt-2 text-muted-foreground">
                You must rank everyone, and you can submit only once. Use the up
                and down controls to check your order before submitting. Ranking
                someone lower still gives them points, so put candidates in your
                real order of preference.
              </p>
            </div>
            <GuideLink to="/dashboard/elections" icon={Landmark}>
              See current races and past results
            </GuideLink>
          </div>
        </WikiSection>

        <WikiSection
          className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
          title="Parties and coalitions"
          icon={Users}
          description="Politics is social. A party gives players a way to organise around shared priorities."
        >
          <div className="space-y-4 text-sm leading-6">
            <p>
              Explore a party's platform, membership, and history before
              deciding whether it is a fit. Party leaders can set non-binding
              voting guidance on bills during the voting stage and post from the
              party's Z.com account. Members still cast their own votes.
            </p>
            <p>
              Parties can also work together in coalitions. If you lead a party,
              its management pages contain the tools available to you.
            </p>
            <GuideLink to="/dashboard/parties" icon={Users}>
              Explore parties, primaries, and coalitions
            </GuideLink>
          </div>
        </WikiSection>

        <WikiSection
          className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
          title="Understanding the Nation"
          icon={ShieldCheck}
          description="The Nation page is your guide to how the country is doing and what its laws have changed."
        >
          <div className="space-y-4 text-sm leading-6">
            <p>
              Start with National condition for the headline picture: civil
              rights, the economy, and political freedoms. Each score combines
              several underlying indicators, so it is a useful summary, not the
              whole story.
            </p>
            <p>
              Open National indicators to see individual measures grouped by
              area. A higher score is not automatically better for every
              measure. For example, the system accounts for negative indicators
              such as unemployment and corruption when calculating the headline
              scores.
            </p>
            <p>
              Use National trends to follow a selected indicator or compare the
              headline scores over time. Hover over a point to see which bill
              changed the score. The policies in force section shows current
              laws and settings, while What changed links back to the bills
              behind recent updates.
            </p>
            <GuideLink to="/dashboard/nation" icon={ShieldCheck}>
              View national condition, indicators, and policies
            </GuideLink>
          </div>
        </WikiSection>

        <WikiSection
          className="flex h-full flex-col [&>.wiki-section-content]:flex-1"
          title="Z.com and the national record"
          icon={MessageSquareText}
          description="Follow the conversation, then check the public pages for the details behind it."
        >
          <div className="space-y-4 text-sm leading-6">
            <p>
              Z.com is Oscana's public square. Share short posts, reply to
              players, and discuss bills by attaching one to a post. Bill
              discussions appear on both the bill page and Z.com. Markdown and
              linked references help make longer ideas easier to follow.
            </p>
            <GuideLink to="/social" icon={MessageSquareText}>
              Visit Z.com
            </GuideLink>
          </div>
        </WikiSection>
      </div>

      <div className="border bg-muted/30 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-bold">A useful habit</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Before making a decision, open the relevant bill or election page and
          check its status and deadline. If something is available to you right
          now, it will usually also appear in your dashboard notifications.
        </p>
      </div>
    </WikiPage>
  );
}

function GuideLink({
  to,
  icon: Icon,
  children,
}: {
  to:
    | "/dashboard/bills"
    | "/dashboard/elections"
    | "/dashboard/parties"
    | "/social"
    | "/dashboard/nation";
  icon: typeof BookOpen;
  children: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
    >
      <Icon className="size-4" />
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}
