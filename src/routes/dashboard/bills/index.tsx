import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Search,
  XCircle,
} from "lucide-react";
import type { BillListStage } from "@/lib/bills/list-stage";
import {
  BillStageCountdown,
  getNextBillStage,
  invalidateAfterBillExpiry,
} from "@/components/bills/bill-stage-countdown";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { billListStage, billListStages } from "@/lib/bills/list-stage";
import { getWikiBills } from "@/lib/server/history/history";
import { getCurrentUserInfo } from "@/lib/server/users/users";
import { getMyBillVoteIds } from "@/lib/server/bills/bill-vote-status";
import { NewBillDialog } from "@/components/wiki/new-bill-dialog";

export const Route = createFileRoute("/dashboard/bills/")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: {
      create?: boolean;
      stage?: BillListStage;
    } = {};
    if (search.create === true || search.create === "true") {
      result.create = true;
    }
    if (billListStages.includes(search.stage as BillListStage)) {
      result.stage = search.stage as BillListStage;
    } else if (
      ["House", "Senate", "Presidential"].includes(String(search.desk))
    ) {
      result.stage =
        search.desk === "Presidential"
          ? "President"
          : (search.desk as "House" | "Senate");
    }
    return result;
  },
  loader: async () => {
    const [bills, currentUser, votedBillIds] = await Promise.all([
      getWikiBills(),
      getCurrentUserInfo(),
      getMyBillVoteIds(),
    ]);
    return {
      bills,
      currentUser,
      votedBillIds,
    };
  },
  component: BillsIndex,
});

function BillsIndex() {
  const { bills, currentUser, votedBillIds } = Route.useLoaderData();
  const { create, stage } = Route.useSearch();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const matching = bills.filter(
    (bill) =>
      (!mineOnly || bill.creatorId === currentUser?.id) &&
      `${bill.title} ${bill.content} ${bill.creator ?? ""} ${bill.status} ${bill.stage} ${billListStage(bill)}`
        .toLowerCase()
        .includes(deferredQuery),
  );
  const selectedStage = stage ?? "All";
  const filtered = matching.filter(
    (bill) => selectedStage === "All" || billListStage(bill) === selectedStage,
  );

  return (
    <WikiPage>
      <WikiHeader
        artwork="bills"
        eyebrow={`${bills.length} articles`}
        title="Bills"
        description="Follow proposals through each stage, from committee review to the final outcome. Open any bill for its text, discussion, and full voting record."
      >
        <NewBillDialog userId={currentUser?.id} autoOpen={create} />
      </WikiHeader>
      <Tabs
        value={selectedStage}
        onValueChange={(value) => {
          void router.navigate({
            to: "/dashboard/bills",
            search: (previous) => ({
              ...previous,
              stage: value === "All" ? undefined : (value as BillListStage),
            }),
          });
        }}
        className="min-w-0 gap-0"
      >
        <div className="flex min-w-0 flex-col gap-3 border-b bg-card px-3 py-3 sm:px-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3 lg:order-1 lg:flex-1">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <TabsList
                aria-label="Bill stages"
                className="h-11 min-w-max gap-1 rounded-sm bg-transparent p-0"
              >
                {billListStages.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-10 min-w-11 flex-none rounded-sm px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {value}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {value === "All"
                        ? matching.length
                        : matching.filter(
                            (bill) => billListStage(bill) === value,
                          ).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <span
              className="shrink-0 font-mono text-xs text-muted-foreground"
              aria-live="polite"
            >
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2 lg:order-2 lg:w-auto">
            <label className="relative min-w-0 flex-1 lg:w-56 lg:flex-none xl:w-64">
              <span className="sr-only">Search bills</span>
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bills or authors"
                className="h-10 rounded-sm bg-muted/50 pl-9 shadow-none"
              />
            </label>
            {currentUser && (
              <Button
                size="sm"
                variant={mineOnly ? "default" : "outline"}
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((value) => !value)}
              >
                My bills
              </Button>
            )}
          </div>
        </div>
        <TabsContent value={selectedStage} className="mt-0">
          <section
            aria-label={`${selectedStage} bills`}
            className="divide-y border-x border-b bg-card"
          >
            {filtered.map((bill) => {
              const listStage = billListStage(bill);
              const votePending =
                bill.status === "Voting" &&
                currentUser?.isActive &&
                currentUser?.role ===
                  (bill.stage === "House"
                    ? "Representative"
                    : bill.stage === "Senate"
                      ? "Senator"
                      : "President") &&
                !votedBillIds.includes(bill.id);
              const voteRecorded =
                bill.status === "Voting" && votedBillIds.includes(bill.id);
              const voteTally =
                bill.status === "Committee"
                  ? null
                  : bill.stage === "Presidential"
                    ? {
                        label: "President",
                        yes: Number(bill.presidentYes),
                        no: Number(bill.presidentNo),
                      }
                    : bill.stage === "Senate"
                      ? {
                          label: "Senate",
                          yes: Number(bill.senateYes),
                          no: Number(bill.senateNo),
                        }
                      : {
                          label: "House",
                          yes: Number(bill.houseYes),
                          no: Number(bill.houseNo),
                        };
              return (
                <article
                  key={bill.id}
                  className="border-l-2 border-l-transparent px-4 py-4 transition-colors hover:border-l-primary hover:bg-muted/30 sm:px-5"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-sm">
                          {listStage}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          Bill #{bill.id}
                        </span>
                        {listStage === "Defeated" && (
                          <span className="text-xs text-muted-foreground">
                            ·{" "}
                            {bill.stage === "Presidential"
                              ? "President"
                              : bill.stage}{" "}
                            decision
                          </span>
                        )}
                      </div>
                      <h2 className="break-words font-serif text-lg font-bold leading-snug sm:text-xl">
                        <Link
                          to="/dashboard/bills/$billId"
                          params={{ billId: String(bill.id) }}
                          className="hover:text-primary hover:underline"
                        >
                          {bill.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Proposed by {bill.creator ?? "Unknown"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        {bill.stageEndsAt ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-3.5" />
                            <BillStageCountdown
                              target={bill.stageEndsAt}
                              onExpire={() =>
                                invalidateAfterBillExpiry(() =>
                                  router.invalidate(),
                                )
                              }
                            />
                            {getNextBillStage(bill) && (
                              <span>· Next: {getNextBillStage(bill)}</span>
                            )}
                          </span>
                        ) : null}
                        {voteTally && <StageVotes {...voteTally} />}
                        {votePending && (
                          <span className="font-semibold text-primary">
                            Your vote is pending
                          </span>
                        )}
                        {voteRecorded && (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3.5" /> You voted
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {currentUser?.id === bill.creatorId &&
                        bill.status === "Committee" && (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              to="/dashboard/bills/edit/$id"
                              params={{ id: String(bill.id) }}
                            >
                              Edit
                            </Link>
                          </Button>
                        )}
                      <Button
                        asChild
                        variant={votePending ? "default" : "outline"}
                        size="sm"
                      >
                        <Link
                          to="/dashboard/bills/$billId"
                          params={{ billId: String(bill.id) }}
                          hash={votePending ? "your-vote" : undefined}
                        >
                          {votePending ? "Vote on bill" : "Read bill"}{" "}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!filtered.length && (
              <WikiEmpty>
                {deferredQuery || mineOnly
                  ? "No bills match these filters. Try a different search or stage."
                  : selectedStage === "All"
                    ? "No bills have been proposed yet."
                    : `No bills in ${selectedStage.toLowerCase()} right now.`}
              </WikiEmpty>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </WikiPage>
  );
}

function StageVotes({
  label,
  yes,
  no,
}: {
  label: string;
  yes: number;
  no: number;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
      <span className="font-semibold text-foreground">{label} vote</span>
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" /> {yes} for
      </span>
      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
        <XCircle className="size-3.5" /> {no} against
      </span>
    </span>
  );
}
