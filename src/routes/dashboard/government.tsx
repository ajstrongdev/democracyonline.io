import { createFileRoute } from "@tanstack/react-router";
import { GovernmentCompositionTimeline } from "@/components/wiki/government-composition-timeline";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage } from "@/components/wiki/wiki-layout";
import { getGovernmentCompositionHistory } from "@/lib/server/history";
import { getWikiArticle } from "@/lib/server/wiki-articles";
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
    label: snapshot.event
      ? `${snapshot.event.username}: ${snapshot.event.fromPartyName ?? "Independent"} to ${snapshot.event.toPartyName ?? "Independent"}`
      : formatElectionTitle(snapshot.election, snapshot.cycle),
    type: snapshot.event ? "Defection" : "Certified election",
    date: formatWikiDate(snapshot.occurredAt),
    composition: snapshot.composition,
  }));
  return (
    <WikiPage>
      <WikiHeader
        eyebrow="Government history"
        title="Composition of government"
        description="A latest-first record of how party and independent representation changed through elections and defections."
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
