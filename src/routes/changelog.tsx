import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage } from "@/components/wiki/wiki-layout";

export const Route = createFileRoute("/changelog")({
  head: () => ({ meta: [{ title: "Polsimmer Changelog" }] }),
  component: ChangelogPage,
});

const releases = [
  {
    version: "0.1.2",
    date: "September 29, 2026",
    dateTime: "2026-09-29",
    headline: "The game feels closer.",
    summary: "More of the game at your fingertips, wherever you play.",
    highlights: [
      {
        title: "Stay in the loop",
        detail: "Optional browser notifications can let you know about Z.com mentions and decisions waiting for you. Set quiet hours, choose your browsers, or stick with in-game alerts—the choice is yours.",
      },
      {
        title: "See the game move",
        detail: "The dashboard, conversations, and key game information update live. If the connection drops, the game catches up when you return.",
      },
      {
        title: "Follow the whole election-night count",
        detail: "Live Wire updates now read like short reports drawn from the results so far. Alongside the leader, they follow challengers, changes in the wider field, and the fight for the last Senate seat as new returns arrive.",
      },
      {
        title: "Vote where you read the bill",
        detail: "Eligible officeholders can vote directly from a bill’s page and see when their vote has been recorded. The progress bar now ends with the presidential stage; the passed or defeated result appears separately once the count is complete.",
      },
      {
        title: "Find your way faster",
        detail: "A persistent desktop sidebar and a reach-friendly mobile bar make it easier to move between bills, elections, parties, Z.com, and the rest of the game. The mobile menu keeps the less-used destinations close by without getting in your way.",
      },
      {
        title: "Make it yours",
        detail: "New imagery gives each corner of the game its own character, while your dashboard and profile reflect the office you currently hold. Bills, ballots, forms, and dialogs have also had a small-screen polish pass.",
      },
      {
        title: "The little fixes matter",
        detail: "Election Night layouts are clearer, and navigation, the footer, and signed-in account controls have had a tidy-up.",
      },
    ],
  },
  {
    version: "0.1.1",
    date: "September 27, 2026",
    dateTime: "2026-09-27",
    headline: "Every change of power has a story.",
    summary: "A clearer record of who held office, and when.",
    highlights: [
      {
        title: "Presidential transitions",
        detail: "Admins can replace a sitting President when the game calls for it, with that change preserved in government history.",
      },
      {
        title: "History you can follow",
        detail: "Government timelines and player pages now show those transitions, so the story of each administration stays visible.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "September 27, 2026",
    dateTime: "2026-09-27",
    headline: "Welcome to Polsimmer.",
    summary: "The first release of a political world you can make your own.",
    highlights: [
      {
        title: "A nation to shape",
        detail: "Build a political career: form parties, contest elections, write and vote on legislation, and leave your mark on government.",
      },
      {
        title: "A conversation to join",
        detail: "Meet other players and make your case on Z.com. Polsimmer is self-hostable, so the first instance can be the start of many nations people create themselves.",
      },
    ],
  },
] as const;

function ChangelogPage() {
  return (
    <WikiPage className="max-w-5xl">
      <WikiHeader
        eyebrow="Release notes"
        title="What’s new in Polsimmer"
        description="New ways to play, small things made better, and the story so far. Polsimmer is a self-hostable political simulation platform—these are updates to the platform, wherever you play it."
      >
        <div className="rounded-lg border bg-card/90 p-4 backdrop-blur-sm sm:p-5">
          <p className="font-serif text-base font-bold sm:text-lg">How “0ver” works</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The major number stays at 0 because Polsimmer is never finished. The other numbers tell you what kind of update you’re getting.
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-muted/50 px-3 py-2"><dt className="font-semibold">0 · Major</dt><dd className="text-muted-foreground">This will never change.</dd></div>
            <div className="rounded-md bg-muted/50 px-3 py-2"><dt className="font-semibold">.1 · Minor</dt><dd className="text-muted-foreground">New or changed core gameplay.</dd></div>
            <div className="rounded-md bg-muted/50 px-3 py-2"><dt className="font-semibold">.2 · Patch</dt><dd className="text-muted-foreground">Visual refinements, tweaks, and bug fixes.</dd></div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Our release model favors smaller gamedrops over huge releases: little and often, with fresh content arriving regularly.
          </p>
        </div>
      </WikiHeader>

      <section className="space-y-4 sm:space-y-6" aria-label="Releases">
        {releases.map((release, index) => (
          <article key={release.version} className="wiki-section overflow-hidden" aria-labelledby={`release-${release.version}`}>
            <header className="border-b bg-muted/25 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">v{release.version}</span>
                {index === 0 && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Sparkles className="size-3.5" /> Latest update</span>}
                <time dateTime={release.dateTime} className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{release.date}</time>
              </div>
              <h2 id={`release-${release.version}`} className="mt-3 font-serif text-xl font-bold leading-tight sm:text-2xl">{release.headline}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{release.summary}</p>
            </header>
            <ul className="divide-y px-4 sm:px-6">
              {release.highlights.map((highlight) => (
                <li key={highlight.title} className="py-3.5 sm:py-4">
                  <h3 className="font-semibold">{highlight.title}</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{highlight.detail}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <aside className="wiki-section px-4 py-5 sm:px-6" aria-label="Polsimmer community">
        <h2 className="font-serif text-lg font-bold">Keep the conversation going</h2>
        <p className="mt-1 text-sm text-muted-foreground">Follow platform updates and meet the people building and playing Polsimmer.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <a href="https://discord.gg/XREYCNFAdC" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Polsimmer Discord <ArrowUpRight className="size-4" aria-hidden="true" /></a>
        </div>
      </aside>
    </WikiPage>
  );
}
