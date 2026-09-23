import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import {
  BillStageCountdown,
  billStatusLabel,
  getNextBillStage,
  invalidateAfterBillExpiry,
} from "@/components/bill-stage-countdown";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage, WikiSearch } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWikiBills } from "@/lib/server/history";
import { getCurrentUserInfo } from "@/lib/server/users";
import { houseBillsPageData } from "@/lib/server/house-bills";
import { senateBillsPageData } from "@/lib/server/senate-bills";
import { presidentialBillsPageData } from "@/lib/server/oval-office-bills";
import {
  BillDeskDialog,
  NewBillDialog,
} from "@/components/wiki/bill-desk-dialogs";

export const Route = createFileRoute("/dashboard/bills/")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: {
      desk?: "House" | "Senate" | "Presidential";
      create?: boolean;
    } = {};
    if (["House", "Senate", "Presidential"].includes(String(search.desk))) {
      result.desk = String(search.desk) as "House" | "Senate" | "Presidential";
    }
    if (search.create === true || search.create === "true") {
      result.create = true;
    }
    return result;
  },
  loader: async () => {
    const [bills, currentUser, house, senate, presidential] = await Promise.all(
      [
        getWikiBills(),
        getCurrentUserInfo(),
        houseBillsPageData(),
        senateBillsPageData(),
        presidentialBillsPageData(),
      ],
    );
    return {
      bills,
      currentUser,
      desks: {
        House: {
          bills: house.bills.map((bill) => ({
            ...bill,
            votes: { yes: bill.votes.for, no: bill.votes.against },
          })),
          members: house.representatives,
        },
        Senate: {
          bills: senate.bills.map((bill) => ({
            ...bill,
            votes: { yes: bill.votes.for, no: bill.votes.against },
          })),
          members: senate.senators,
        },
        Presidential: {
          bills: presidential.bills.map((bill) => ({
            ...bill,
            votes: { yes: bill.votes.signed, no: bill.votes.vetoed },
          })),
          members: presidential.presidents,
        },
      },
    };
  },
  component: BillsIndex,
});

function BillsIndex() {
  const { bills, currentUser, desks } = Route.useLoaderData();
  const { create, desk } = Route.useSearch();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [mineOnly, setMineOnly] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = bills.filter(
    (bill) =>
      (status === "All" || bill.status === status) &&
      (!mineOnly || bill.creatorId === currentUser?.id) &&
      `${bill.title} ${bill.content} ${bill.creator ?? ""} ${bill.status}`
        .toLowerCase()
        .includes(deferredQuery),
  );

  return (
    <WikiPage>
      <WikiHeader
        eyebrow={`${bills.length} articles`}
        title="Bills"
        description="Every proposal and its complete House, Senate, and presidential roll call."
      />
      <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
        <NewBillDialog userId={currentUser?.id} autoOpen={create} />
        <BillDeskDialog
          data={desks}
          user={currentUser}
          initialChamber={desk}
          autoOpen={Boolean(desk)}
        />
      </nav>
      <WikiSearch
        value={query}
        onChange={setQuery}
        placeholder="Search bills, authors, or statuses"
        resultCount={filtered.length}
      />
      <div className="flex flex-wrap gap-2">
        {[
          { value: "All", label: "All" },
          { value: "Committee", label: "Senate Committee" },
          { value: "Voting", label: "Voting" },
          { value: "Passed", label: "Passed" },
          { value: "Defeated", label: "Defeated" },
        ].map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {label}
          </Button>
        ))}
        {currentUser && (
          <Button
            size="sm"
            variant={mineOnly ? "default" : "outline"}
            onClick={() => setMineOnly((value) => !value)}
          >
            My bills
          </Button>
        )}
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        {filtered.map((bill) => {
          return (
            <Card
              key={bill.id}
              className="h-full rounded-sm shadow-none transition-colors hover:border-primary"
            >
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-xl font-bold">
                    Bill #{bill.id}: {bill.title}
                  </h2>
                  <Badge variant="outline">
                    {billStatusLabel(bill.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Proposed by {bill.creator ?? "Unknown"} ·{" "}
                  {bill.status === "Committee"
                    ? "Senate Committee"
                    : `${bill.stage} stage`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {bill.stageEndsAt ? (
                    <>
                      <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        <BillStageCountdown
                          target={bill.stageEndsAt}
                          onExpire={() =>
                            invalidateAfterBillExpiry(() => router.invalidate())
                          }
                        />
                      </Badge>
                      {getNextBillStage(bill) ? (
                        <span className="text-xs text-muted-foreground">
                          Next stage: {getNextBillStage(bill)}
                        </span>
                      ) : null}
                    </>
                  ) : bill.status === "Passed" || bill.status === "Defeated" ? (
                    <span className="text-xs text-muted-foreground">
                      Lifecycle complete — no further deadlines
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No active deadline
                    </span>
                  )}
                </div>
                <div className="space-y-3 border-y py-3">
                  <StageVotes
                    label="House"
                    yes={Number(bill.houseYes)}
                    no={Number(bill.houseNo)}
                  />
                  {bill.stage !== "House" && (
                    <StageVotes
                      label="Senate"
                      yes={Number(bill.senateYes)}
                      no={Number(bill.senateNo)}
                    />
                  )}
                  {bill.stage === "Presidential" && (
                    <StageVotes
                      label="President"
                      yes={Number(bill.presidentYes)}
                      no={Number(bill.presidentNo)}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/dashboard/bills/$billId"
                      params={{ billId: String(bill.id) }}
                    >
                      View bill
                    </Link>
                  </Button>
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
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!filtered.length && (
          <div className="col-span-full">
            <WikiEmpty>No bills match this search.</WikiEmpty>
          </div>
        )}
      </section>
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
  const total = yes + no;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 font-mono text-xs">
        <strong className="text-foreground">{label}</strong>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {yes} for
          </span>
          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" /> {no} against
          </span>
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden bg-muted">
        <div
          className="bg-emerald-600"
          style={{ width: `${(yes / (total || 1)) * 100}%` }}
        />
        <div
          className="bg-red-600"
          style={{ width: `${(no / (total || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
