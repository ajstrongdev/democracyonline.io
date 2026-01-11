import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Filter,
  Pencil,
  User,
  X,
  XCircle,
} from "lucide-react";
import { getBills } from "@/lib/server/bills";
import { fetchUserInfoByEmail } from "@/lib/server/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export const Route = createFileRoute("/bills/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }
    const userData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    });

    const bills = await getBills();
    return { userData, bills };
  },
  component: RouteComponent,
});

type creatorFilter = "all" | "mine";

function RouteComponent() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<creatorFilter>("all");
  const { userData, bills } = Route.useLoaderData();
  const user = userData[0];

  const filteredBills = useMemo(() => {
    if (!bills || !userData) return [];

    return bills.filter((bill) => {
      const matchesStatus =
        statusFilter === "all" || bill.status === statusFilter;
      const matchesCreator =
        creatorFilter === "all" ||
        (creatorFilter === "mine" && user.id === bill.creatorId);
      return matchesStatus && matchesCreator;
    });
  }, [bills, statusFilter, creatorFilter, user]);

  return (
    <div className="container mx-auto py-8 px-2 sm:px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Bills</h1>
        <p className="text-muted-foreground">
          View and track the status of bills here.
        </p>
        <Button asChild className="mt-4 hover:cursor-pointer">
          <Link to="/bills/create">Create New Bill</Link>
        </Button>
      </div>
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (statusFilter === "Passed") {
                setStatusFilter("all");
              } else {
                setStatusFilter("Passed");
                setCreatorFilter("all");
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              statusFilter === "Passed"
                ? "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300"
                : "bg-card hover:bg-accent"
            }`}
          >
            <Check size={20} />
            <span className="font-medium">Passed</span>
          </button>

          <button
            onClick={() => {
              if (statusFilter === "Defeated") {
                setStatusFilter("all");
              } else {
                setStatusFilter("Defeated");
                setCreatorFilter("all");
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              statusFilter === "Defeated"
                ? "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-700 dark:text-red-300"
                : "bg-card hover:bg-accent"
            }`}
          >
            <X size={20} />
            <span className="font-medium">Defeated</span>
          </button>

          <button
            onClick={() => {
              if (statusFilter === "Voting") {
                setStatusFilter("all");
              } else {
                setStatusFilter("Voting");
                setCreatorFilter("all");
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              statusFilter === "Voting"
                ? "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500 text-yellow-700 dark:text-yellow-300"
                : "bg-card hover:bg-accent"
            }`}
          >
            <Filter size={20} />
            <span className="font-medium">Voting</span>
          </button>

          <button
            onClick={() => {
              if (creatorFilter === "mine") {
                setCreatorFilter("all");
              } else {
                setCreatorFilter("mine");
                setStatusFilter("all");
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              creatorFilter === "mine"
                ? "bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300"
                : "bg-card hover:bg-accent"
            }`}
          >
            <User size={20} />
            <span className="font-medium">My Bills</span>
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 border-b pb-2">
          All Bills
          <span className="text-base sm:text-lg font-normal text-muted-foreground ml-2">
            ({filteredBills.length}{" "}
            {filteredBills.length === 1 ? "bill" : "bills"})
          </span>
        </h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredBills && filteredBills.length > 0 ? (
            filteredBills.map((bill) => (
              <Card key={bill.id} className="mb-4 last:mb-0">
                <CardContent>
                  {/* Bill details */}
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                      <h2 className="text-lg sm:text-xl font-semibold wrap-break-words">
                        Bill #{bill.id}: {bill.title}
                      </h2>

                      {user.id === bill.creatorId &&
                        bill.status === "Queued" && (
                          <Link
                            to="/bills/edit/$id"
                            params={{ id: bill.id.toString() }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                          </Link>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 wrap-break-words">
                      Proposed By:{" "}
                      <b className="text-black dark:text-white wrap-break-words">
                        {bill.creator}
                      </b>{" "}
                      | Status: {bill.status} | Stage: {bill.stage} | Created
                      at:{" "}
                      {bill.createdAt
                        ? new Date(bill.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </p>
                    <p className="line-clamp-3 text-foreground mt-5 sm:mt-3 whitespace-pre-wrap wrap-break-words">
                      {bill.content}
                    </p>
                  </div>

                  {/* Bill voting */}
                  <div className="flex flex-col gap-4 mt-3">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">House</h2>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{bill.houseTotalYes} For</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>{bill.houseTotalNo} Against</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                (Number(bill.houseTotalYes) /
                                  (Number(bill.houseTotalYes) +
                                    Number(bill.houseTotalNo) || 1)) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${
                                (Number(bill.houseTotalNo) /
                                  (Number(bill.houseTotalYes) +
                                    Number(bill.houseTotalNo) || 1)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {bill.stage !== "House" && (
                      <div>
                        <h2 className="text-xl font-semibold mb-2 sm:mt-0 mt-2">
                          Senate
                        </h2>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{bill.senateTotalYes} For</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4" />
                              <span>{bill.senateTotalNo} Against</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${
                                  (Number(bill.senateTotalYes) /
                                    (Number(bill.senateTotalYes) +
                                      Number(bill.senateTotalNo) || 1)) *
                                  100
                                }%`,
                              }}
                            />
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${
                                  (Number(bill.senateTotalNo) /
                                    (Number(bill.senateTotalYes) +
                                      Number(bill.senateTotalNo) || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {bill.stage === "Presidential" && (
                      <div>
                        <h2 className="text-xl font-semibold mb-2 sm:mt-0 mt-2">
                          Presidential
                        </h2>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{bill.presidentialTotalYes} For</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4" />
                              <span>{bill.presidentialTotalNo} Against</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${
                                  (Number(bill.presidentialTotalYes) /
                                    (Number(bill.presidentialTotalYes) +
                                      Number(bill.presidentialTotalNo) || 1)) *
                                  100
                                }%`,
                              }}
                            />
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${
                                  (Number(bill.presidentialTotalNo) /
                                    (Number(bill.presidentialTotalYes) +
                                      Number(bill.presidentialTotalNo) || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/bills/$id" params={{ id: bill.id.toString() }}>
                      View Bill
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent>
                <p>
                  No bills found
                  {statusFilter !== "all" || creatorFilter !== "all"
                    ? " matching the selected filters."
                    : "."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
