"use client";

import React, { useState, useMemo } from "react";
import withAuth from "@/lib/withAuth";
import { useQuery } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import axios from "axios";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BillItem } from "@/app/utils/billHelper";
import { getUserById, fetchUserInfo } from "@/app/utils/userHelper";
import {
  Filter,
  X,
  Check,
  Pencil,
  User,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

function Bills() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all"); // "all" or "mine"
  const [user] = useAuthState(auth);

  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });

  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const res = await axios.get("/api/bills-list");
      const bills = res.data.bills || [];
      const billsWithUsernames = await Promise.all(
        bills.map(async (item: BillItem) => {
          if (!item.creator_id) {
            return { ...item, username: "Unknown User" };
          }
          const username = await getUserById(item.creator_id, true);
          return { ...item, username };
        })
      );
      console.log(billsWithUsernames);
      return billsWithUsernames;
    },
  });

  const filteredBills = useMemo(() => {
    if (!data) return [];

    return data.filter((bill) => {
      const matchesStatus =
        statusFilter === "all" || bill.status === statusFilter;
      const matchesCreator =
        creatorFilter === "all" ||
        (creatorFilter === "mine" && currentUser?.id === bill.creator_id);
      return matchesStatus && matchesCreator;
    });
  }, [data, statusFilter, creatorFilter, currentUser]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Bills</h1>
        <p className="text-muted-foreground">
          View and track the status of bills here.
        </p>
        <Button asChild className="mt-4 hover:cursor-pointer">
          <Link href="/bills/create">Create New Bill</Link>
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
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          All Bills
          <span className="text-lg font-normal text-muted-foreground ml-2">
            ({filteredBills.length}{" "}
            {filteredBills.length === 1 ? "bill" : "bills"})
          </span>
        </h1>
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {isLoading ? (
            <Card>
              <CardContent>
                <GenericSkeleton />
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent>
                <p className="text-red-500">Error loading bills.</p>
              </CardContent>
            </Card>
          ) : filteredBills && filteredBills.length > 0 ? (
            filteredBills.map((bill) => (
              <Card key={bill.id} id={bill.id} className="mb-4 last:mb-0">
                <CardContent>
                  {/* Bill details */}
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-semibold">
                        Bill #{bill.id}: {bill.title}
                      </h2>

                      {currentUser?.id === bill.creator_id &&
                        bill.status === "Queued" && (
                          <Link href={`/bills/edit/${bill.id}`}>
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
                    <p className="text-sm text-muted-foreground mb-2">
                      Proposed By:{" "}
                      <b className="text-black dark:text-white">
                        {bill.username}
                      </b>{" "}
                      | Status: {bill.status} | Stage: {bill.stage} | Created
                      at: {new Date(bill.created_at).toLocaleDateString()}
                    </p>
                    <p className="line-clamp-3 text-foreground mt-5 sm:mt-3 whitespace-pre-wrap">
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
                            <span>{bill.house_total_yes} For</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>{bill.house_total_no} Against</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                (Number(bill.house_total_yes) /
                                  (Number(bill.house_total_yes) +
                                    Number(bill.house_total_no) || 1)) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${
                                (Number(bill.house_total_no) /
                                  (Number(bill.house_total_yes) +
                                    Number(bill.house_total_no) || 1)) *
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
                              <span>{bill.senate_total_yes} For</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4" />
                              <span>{bill.senate_total_no} Against</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${
                                  (Number(bill.senate_total_yes) /
                                    (Number(bill.senate_total_yes) +
                                      Number(bill.senate_total_no) || 1)) *
                                  100
                                }%`,
                              }}
                            />
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${
                                  (Number(bill.senate_total_no) /
                                    (Number(bill.senate_total_yes) +
                                      Number(bill.senate_total_no) || 1)) *
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
                              <span>{bill.presidential_total_yes} For</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4" />
                              <span>{bill.presidential_total_no} Against</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${
                                  (Number(bill.presidential_total_yes) /
                                    (Number(bill.presidential_total_yes) +
                                      Number(bill.presidential_total_no) ||
                                      1)) *
                                  100
                                }%`,
                              }}
                            />
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${
                                  (Number(bill.presidential_total_no) /
                                    (Number(bill.presidential_total_yes) +
                                      Number(bill.presidential_total_no) ||
                                      1)) *
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
                    <Link href={`/bills/${bill.id}`}>View Bill</Link>
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

export default withAuth(Bills);
