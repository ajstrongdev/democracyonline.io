import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { PartyMark, WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiInfobox,
  WikiInfoboxRow,
  WikiPage,
  WikiSection,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { getWikiBill } from "@/lib/server/history";
import { getWikiArticle } from "@/lib/server/wiki-articles";
import { formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/bills/$billId")({
  loader: async ({ params }) => {
    const id = Number(params.billId);
    if (!Number.isInteger(id))
      throw new Response("Bill not found", { status: 404 });
    const [billData, article] = await Promise.all([
      getWikiBill({ data: { id } }),
      getWikiArticle({
        data: { entityType: "bill", entityId: params.billId },
      }),
    ]);
    if (!billData) throw new Response("Bill not found", { status: 404 });
    return { billData, article };
  },
  component: BillArticle,
});

function BillArticle() {
  const { billData, article } = Route.useLoaderData();
  const { bill, rollCalls } = billData;
  return (
    <WikiPage width="article">
      <WikiHeader
        eyebrow={`Bill #${bill.id} · ${bill.status} · ${bill.stage} stage`}
        title={bill.title}
        description={`Proposed by ${bill.creator ?? "Unknown"}${bill.createdAt ? ` on ${formatWikiDate(bill.createdAt)}` : ""}.`}
        status={<Badge variant="outline">{bill.status}</Badge>}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <WikiArticleSection
          entityType="bill"
          entityId={String(bill.id)}
          article={article}
        />
        <WikiInfobox title={`Bill #${bill.id}`}>
          <WikiInfoboxRow label="Status">{bill.status}</WikiInfoboxRow>
          <WikiInfoboxRow label="Stage">{bill.stage}</WikiInfoboxRow>
          <WikiInfoboxRow label="Proposer">
            {bill.creator ?? "Unknown"}
          </WikiInfoboxRow>
          <WikiInfoboxRow label="Introduced">
            {bill.createdAt ? formatWikiDate(bill.createdAt) : "Unknown"}
          </WikiInfoboxRow>
        </WikiInfobox>
      </div>
      <WikiSection
        title="Official text"
        description="The authoritative text submitted with this proposal."
      >
        <div className="whitespace-pre-wrap border-l-2 border-primary/40 pl-5 leading-7">
          {bill.content}
        </div>
      </WikiSection>
      <section className="grid gap-4 lg:grid-cols-3">
        <RollCall title="House of Representatives" votes={rollCalls.house} />
        <RollCall title="Senate" votes={rollCalls.senate} />
        <RollCall
          title="President"
          votes={rollCalls.president}
          yesLabel="Signed"
          noLabel="Vetoed"
        />
      </section>
    </WikiPage>
  );
}

function RollCall({
  title,
  votes,
  yesLabel = "For",
  noLabel = "Against",
}: {
  title: string;
  votes: Array<{
    userId: number | null;
    username: string | null;
    voteYes: boolean;
    partyName: string | null;
    partyColor: string | null;
  }>;
  yesLabel?: string;
  noLabel?: string;
}) {
  const yes = votes.filter((vote) => vote.voteYes).length;
  const no = votes.length - yes;
  return (
    <WikiSection
      title={title}
      aside={
        <div className="flex gap-3 font-mono text-xs">
          <span className="text-emerald-700 dark:text-emerald-400">
            {yes} {yesLabel.toLowerCase()}
          </span>
          <span className="text-red-700 dark:text-red-400">
            {no} {noLabel.toLowerCase()}
          </span>
        </div>
      }
    >
      <div className="flex h-1.5 overflow-hidden bg-muted">
        <div
          className="bg-emerald-600"
          style={{ width: `${(yes / (votes.length || 1)) * 100}%` }}
        />
        <div
          className="bg-red-600"
          style={{ width: `${(no / (votes.length || 1)) * 100}%` }}
        />
      </div>
      <div className="mt-3">
        {votes.map((vote, index) => {
          const content = (
            <div className="wiki-record-row flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {vote.username ?? "Unknown player"}
                </p>
                <PartyMark name={vote.partyName} color={vote.partyColor} />
              </div>
              <Badge variant={vote.voteYes ? "default" : "destructive"}>
                {vote.voteYes ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {vote.voteYes ? yesLabel : noLabel}
              </Badge>
            </div>
          );
          return vote.userId ? (
            <Link
              key={vote.userId}
              to="/dashboard/players/$playerId"
              params={{ playerId: String(vote.userId) }}
              className="block hover:text-primary"
            >
              {content}
            </Link>
          ) : (
            <div key={index}>{content}</div>
          );
        })}
        {!votes.length && <WikiEmpty>No votes recorded.</WikiEmpty>}
      </div>
    </WikiSection>
  );
}
