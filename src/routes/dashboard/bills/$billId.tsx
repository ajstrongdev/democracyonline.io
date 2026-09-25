import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { Check, Clock3, X } from "lucide-react";
import {
  BillStageCountdown,
  billStatusLabel,
  getNextBillStage,
  invalidateAfterBillExpiry,
} from "@/components/bill-stage-countdown";
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
import { getCommitteeData } from "@/lib/server/committee";
import { CommitteeOutcome } from "@/components/wiki/committee-outcome";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import { BillComments } from "@/components/bills/bill-comments";
import { getBillComments, getBillWhips } from "@/lib/server/bill-comments";

export const Route = createFileRoute("/dashboard/bills/$billId")({
  loader: async ({ params }) => {
    const id = Number(params.billId);
    if (!Number.isInteger(id))
      throw new Response("Bill not found", { status: 404 });
    const [billData, article, committee, comments, whipData] =
      await Promise.all([
        getWikiBill({ data: { id } }),
        getWikiArticle({
          data: { entityType: "bill", entityId: params.billId },
        }),
        getCommitteeData({ data: { billId: id } }),
        getBillComments({ data: { billId: id } }),
        getBillWhips({ data: { billId: id } }),
      ]);
    if (!billData) throw new Response("Bill not found", { status: 404 });
    return { billData, article, committee, comments, whipData };
  },
  component: BillArticle,
});

function BillArticle() {
  const { billData, article, committee, comments, whipData } =
    Route.useLoaderData();
  const { bill, rollCalls } = billData;
  const router = useRouter();
  return (
    <WikiPage width="article">
      <WikiHeader
        eyebrow={`Bill #${bill.id} · ${billStatusLabel(bill.status)}${bill.status === "Committee" ? "" : ` · ${bill.stage} stage`}`}
        title={bill.title}
        description={`Proposed by ${bill.creator ?? "Unknown"}${bill.createdAt ? ` on ${formatWikiDate(bill.createdAt)}` : ""}.`}
        status={<Badge variant="outline">{billStatusLabel(bill.status)}</Badge>}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <WikiArticleSection
          entityType="bill"
          entityId={String(bill.id)}
          article={article}
        />
        <WikiInfobox title={`Bill #${bill.id}`}>
          <WikiInfoboxRow label="Status">
            {billStatusLabel(bill.status)}
          </WikiInfoboxRow>
          <WikiInfoboxRow label="Stage">
            {bill.status === "Committee" ? "Senate Committee" : bill.stage}
          </WikiInfoboxRow>
          <WikiInfoboxRow label="Stage ends">
            {bill.stageEndsAt ? (
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                <BillStageCountdown
                  target={bill.stageEndsAt}
                  onExpire={() =>
                    invalidateAfterBillExpiry(() => router.invalidate())
                  }
                />
              </Badge>
            ) : (
              "No active deadline"
            )}
          </WikiInfoboxRow>
          {getNextBillStage(bill) ? (
            <WikiInfoboxRow label="Next stage">
              {getNextBillStage(bill)}
            </WikiInfoboxRow>
          ) : null}
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
        <div className="border-l-2 border-primary/40 pl-5">
          <MarkdownContent content={bill.content} />
        </div>
      </WikiSection>
      {committee && <CommitteeOutcome billId={bill.id} data={committee} />}
      <BillComments
        billId={bill.id}
        comments={comments}
        whips={whipData.whips}
        currentPartyId={whipData.currentPartyId}
        canWhip={whipData.canWhip}
        isVoting={whipData.isVoting}
      />
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
