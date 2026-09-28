import { createFileRoute } from "@tanstack/react-router";
import { GovernmentCompositionTimeline } from "@/components/wiki/government-composition-timeline";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage } from "@/components/wiki/wiki-layout";
import { getGovernmentCompositionHistory } from "@/lib/server/history/history";
import { getWikiArticle } from "@/lib/server/wiki/wiki-articles";
import { formatElectionTitle, formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/government")({
  loader: async () => {
    const [history, article] = await Promise.all([
      getGovernmentCompositionHistory(),
      getWikiArticle({
        data: { entityType: "government", entityId: "overview" },
      }),
    ]);
    return { history, article };
  },
  component: GovernmentHistory,
});

function GovernmentHistory() {
  const { history, article } = Route.useLoaderData();
  const snapshots = history.map((snapshot) => ({
    id: snapshot.key,
    electionId: snapshot.electionHistoryId,
    label:
      snapshot.kind === "coup"
        ? (snapshot.changes ?? [])
            .map(
              (change) =>
                `${change.username}: ${change.fromOffice ?? "None"} → ${change.toOffice}`,
            )
            .join("; ")
        : snapshot.event
          ? `${snapshot.event.username}: ${snapshot.event.fromPartyName ?? "Independent"} to ${snapshot.event.toPartyName ?? "Independent"}`
          : formatElectionTitle(snapshot.election, snapshot.cycle),
    type:
      snapshot.kind === "coup"
        ? "Coup"
        : snapshot.event
          ? "Defection"
          : "Certified election",
    kind: snapshot.kind,
    election: snapshot.election,
    date: formatWikiDate(snapshot.occurredAt),
    composition: snapshot.composition,
  }));
  return (
    <WikiPage>
      <WikiHeader
        eyebrow="Government history"
        title="Composition of government"
        description="A latest-first record of how party and independent representation changed through elections, defections, and coups."
      />
      <WikiArticleSection
        entityType="government"
        entityId="overview"
        article={article}
      />
      <GovernmentCompositionTimeline snapshots={snapshots} />
    </WikiPage>
  );
}
