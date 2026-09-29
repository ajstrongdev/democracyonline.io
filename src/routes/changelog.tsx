import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage, WikiSection } from "@/components/wiki/wiki-layout";

export const Route = createFileRoute("/changelog")({
  head: () => ({ meta: [{ title: "Polsimmer Changelog" }] }),
  component: ChangelogPage,
});

const releases = [
  {
    version: "0.1.2",
    date: "September 28, 2026",
    dateTime: "2026-09-28",
    summary: "Live updates, Web Push, and a clearer experience across devices.",
    changes: [
      "Added optional Web Push for Z.com mentions and pending decisions, with per-browser subscriptions, quiet hours, and private-by-default notifications. In-app alerts remain available without Push.",
      "Added live updates for social activity, the dashboard, and selected game data, with a foreground refresh fallback when the live connection is unavailable.",
      "Refined navigation across the game: a permanent desktop sidebar now matches the mobile drawer, with grouped destinations, consistent icons, and compact search, theme, and account controls.",
      "Removed the redundant dashboard destination grid, kept the sidebar visible on desktop subpages, and corrected the footer layout so it no longer cuts across the sidebar.",
      "Improved small-screen forms, dialogs, and ranked ballots; made bill progress easier to follow and polished Election Night spacing and shared interaction states.",
      "Fixed a signed-in user menu hydration mismatch.",
      "Expanded isolated end-to-end checks for live updates and mobile layouts.",
    ],
  },
  {
    version: "0.1.1",
    date: "September 27, 2026",
    dateTime: "2026-09-27",
    summary: "Government administration update.",
    changes: [
      "Added an admin action to replace the sitting President and record the change in government history.",
      "Updated the government timeline and player pages to show presidential transitions.",
    ],
  },
  {
    version: "0.1.0",
    date: "September 27, 2026",
    dateTime: "2026-09-27",
    summary: "Initial release.",
    changes: [
      "Initial release of Polsimmer, set in Oscana, with parties, elections, legislation, government, and Z.com discussion.",
    ],
  },
] as const;

function ChangelogPage() {
  return (
    <WikiPage>
      <WikiHeader
        eyebrow="Release history"
        title="Polsimmer Changelog"
        description="What has changed in Polsimmer since the initial release on September 27, 2026."
      />
      <div className="space-y-6">
        {releases.map((release) => (
          <WikiSection
            key={release.version}
            title={`v${release.version}`}
            icon={History}
            description={release.summary}
            aside={
              <time
                dateTime={release.dateTime}
                className="shrink-0 text-sm text-muted-foreground"
              >
                {release.date}
              </time>
            }
          >
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground marker:text-primary">
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </WikiSection>
        ))}
      </div>
    </WikiPage>
  );
}
