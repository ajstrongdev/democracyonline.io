import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import BillVotersList from "@/components/BillVotersList";

async function getVotes(billId: string, stage: string) {
  try {
    const res = await query(
      `SELECT
            COUNT(*) FILTER (WHERE vote_yes = true) AS yes_count,
            COUNT(*) FILTER (WHERE vote_yes = false) AS no_count
         FROM bill_votes_${stage.toLowerCase()}
         WHERE bill_id = $1`,
      [billId]
    );
    return {
      yes: parseInt(res.rows[0].yes_count || "0"),
      no: parseInt(res.rows[0].no_count || "0"),
    };
  } catch (e) {
    console.error(`Error fetching ${stage} votes:`, e);
    return { yes: 0, no: 0 };
  }
}

function VoteSummary({
  title,
  votes,
}: {
  title: string;
  votes: { yes: number; no: number };
}) {
  const total = votes.yes + votes.no;
  const yesPercent = total > 0 ? (votes.yes / total) * 100 : 0;
  const noPercent = total > 0 ? (votes.no / total) * 100 : 0;

  return (
    <div className="flex flex-col border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="p-4 pb-2 space-y-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>{votes.yes} For</span>
          </div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span>{votes.no} Against</span>
          </div>
        </div>
      </div>
      <div className="h-2 w-full bg-secondary flex">
        <div
          className="h-full bg-green-500"
          style={{ width: `${yesPercent}%` }}
        />
        <div className="h-full bg-red-500" style={{ width: `${noPercent}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let colorClass =
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";

  if (status === "Passed") {
    colorClass =
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  } else if (
    status === "Failed" ||
    status === "Rejected" ||
    status === "Defeated"
  ) {
    colorClass =
      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-500";
  } else if (status === "Voting") {
    colorClass =
      "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500 text-yellow-700 dark:text-yellow-300";
  }

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const billRes = await query(
    `SELECT b.*, u.username as creator_name
     FROM bills b
     LEFT JOIN users u ON b.creator_id = u.id
     WHERE b.id = $1`,
    [id]
  );

  const bill = billRes.rows[0];

  if (!bill) {
    notFound();
  }

  const [houseVotes, senateVotes, presidentialVotes] = await Promise.all([
    getVotes(id, "House"),
    getVotes(id, "Senate"),
    getVotes(id, "Presidential"),
  ]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Link href="/bills">
          <Button
            variant="ghost"
            className="gap-2 pl-0 hover:pl-2 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bills
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">
                  Bill #{bill.id}: {bill.title}
                </CardTitle>
                <CardDescription className="text-base">
                  Proposed by{" "}
                  <span className="font-semibold text-foreground">
                    {bill.creator_name || "Unknown User"}
                  </span>{" "}
                  on {new Date(bill.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={bill.status} />
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                  {bill.stage} Stage
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <h3 className="text-lg font-semibold mb-2">Bill Content</h3>
              <div className="p-4 bg-muted/50 rounded-lg border whitespace-pre-wrap text-sm leading-relaxed">
                {bill.content || bill.description || "No content available."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voting History</CardTitle>
            <CardDescription>
              Results from each legislative stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <VoteSummary
                title="House of Representatives"
                votes={houseVotes}
              />
              <VoteSummary title="Senate" votes={senateVotes} />
              <VoteSummary title="Presidential" votes={presidentialVotes} />
            </div>
          </CardContent>
        </Card>

        <BillVotersList billId={id} />
      </div>
    </div>
  );
}
