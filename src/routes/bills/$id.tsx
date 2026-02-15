import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { billPageData } from "@/lib/server/bills";
import BillVotersList from "@/components/bill-votes-list";
import { BackButton } from "@/components/back-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/bills/$id")({
  loader: async ({ params }) => {
    const billId = Number(params.id);
    if (isNaN(billId)) {
      throw new Response("Bill not found", { status: 404 });
    }

    const billPageDataResult = await billPageData({ data: { id: billId } });
    if (!billPageDataResult) {
      throw new Response("Bill not found", { status: 404 });
    }

    return { billPageDataResult };
  },
  component: BillDetailPage,
});

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
      <div className="p-3 sm:p-4 pb-2 space-y-2">
        <h3 className="font-semibold text-base sm:text-lg">{title}</h3>
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{votes.yes} For</span>
          </div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
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

function BillDetailPage() {
  const { billPageDataResult } = Route.useLoaderData();
  const { bill, votes, voters } = billPageDataResult;

  return (
    <ProtectedRoute>
      <div className="w-full py-4 sm:py-8 px-3 sm:px-4 max-w-5xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <BackButton fallbackUrl="/bills" />
        </div>

        <div className="flex flex-col gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold wrap-break-words hyphens-auto">
                    Bill #{bill.id}: {bill.title}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm wrap-break-words">
                    Proposed by{" "}
                    <span className="font-semibold text-foreground wrap-break-words">
                      {bill.creator || "Unknown User"}
                    </span>{" "}
                    {bill.createdAt &&
                      `on ${new Date(bill.createdAt).toLocaleDateString()}`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={bill.status} />
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border whitespace-nowrap">
                    {bill.stage} Stage
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="w-full">
                <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2">
                  Bill Content
                </h3>
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border whitespace-pre-wrap text-xs sm:text-sm leading-relaxed wrap-break-words overflow-x-auto">
                  {bill.content || "No content available."}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                Voting History
              </CardTitle>
              <CardDescription className="text-sm">
                Results from each legislative stage
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <VoteSummary
                  title="House of Representatives"
                  votes={votes.house.count}
                />
                <VoteSummary title="Senate" votes={votes.senate.count} />
                <VoteSummary
                  title="Presidential"
                  votes={votes.presidential.count}
                />
              </div>
            </CardContent>
          </Card>

          <BillVotersList votersData={voters} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
