"use client";

import React, { useState, useMemo } from "react";
import withAuth from "@/lib/withAuth";
import { useQuery } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BillItem } from "@/app/utils/billHelper";
import { getUserById } from "@/app/utils/userHelper";
import { Filter, ChevronDown, X, Check } from "lucide-react";

function Bills() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
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
          const username = await getUserById(item.creator_id);
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
      const matchesStage = stageFilter === "all" || bill.stage === stageFilter;
      return matchesStatus && matchesStage;
    });
  }, [data, statusFilter, stageFilter]);

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg hover:bg-accent transition-colors"
            >
              <Filter size={20} />
              <span className="font-medium">
                Filter Bills
                {(statusFilter !== "all" || stageFilter !== "all") && (
                  <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                    {[
                      statusFilter !== "all" ? 1 : 0,
                      stageFilter !== "all" ? 1 : 0,
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  isFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <button
              onClick={() => {
                if (statusFilter === "Passed") {
                  setStatusFilter("all");
                } else {
                  setStatusFilter("Passed");
                  setStageFilter("all");
                }
                setIsFilterOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                statusFilter === "Passed"
                  ? "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300"
                  : "bg-card hover:bg-accent"
              }`}
            >
              <Check size={20} />
              <span className="font-medium">Passed Bills</span>
            </button>
          </div>

          {/* Active Filters Display - Compact */}
          {(statusFilter !== "all" || stageFilter !== "all") &&
            !isFilterOpen && (
              <div className="flex flex-wrap gap-2 items-center">
                {statusFilter !== "all" && (
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
                    {statusFilter}
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {stageFilter !== "all" && (
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
                    {stageFilter}
                    <button
                      onClick={() => setStageFilter("all")}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            )}
        </div>
        {isFilterOpen && (
          <div className="p-4 bg-card border rounded-lg shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Status Filter */}
              <div>
                <label
                  htmlFor="status-filter"
                  className="block text-sm font-medium mb-2"
                >
                  Status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="Queued">Queued</option>
                  <option value="Voting">Voting</option>
                  <option value="Passed">Passed</option>
                  <option value="Defeated">Defeated</option>
                </select>
              </div>

              {/* Stage Filter */}
              <div>
                <label
                  htmlFor="stage-filter"
                  className="block text-sm font-medium mb-2"
                >
                  Stage
                </label>
                <select
                  id="stage-filter"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Stages</option>
                  <option value="House">House</option>
                  <option value="Senate">Senate</option>
                  <option value="Presidential">Presidential</option>
                </select>
              </div>
            </div>

            {(statusFilter !== "all" || stageFilter !== "all") && (
              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Active:</span>
                  {statusFilter !== "all" && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      Status: {statusFilter}
                    </span>
                  )}
                  {stageFilter !== "all" && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      Stage: {stageFilter}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setStageFilter("all");
                  }}
                  className="text-sm"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          All Bills
          <span className="text-lg font-normal text-muted-foreground ml-2">
            ({filteredBills.length}{" "}
            {filteredBills.length === 1 ? "bill" : "bills"})
          </span>
        </h1>
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
                  <h2 className="text-xl font-semibold">
                    Bill #{bill.id}: {bill.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    Proposed By:{" "}
                    <b className="text-black dark:text-white">
                      {bill.username}
                    </b>{" "}
                    | Status: {bill.status} | Stage: {bill.stage} | Created at:{" "}
                    {new Date(bill.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-foreground mt-5 sm:mt-3 whitespace-pre-wrap">
                    {bill.content}
                  </p>
                </div>

                {/* Bill voting */}
                <div className="grid lg:grid-cols-3 grid-cols-1 mt-3">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">House</h2>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
                        Votes For: {bill.house_total_yes}
                      </span>
                      <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
                        Votes Against: {bill.house_total_no}
                      </span>
                    </div>
                  </div>
                  {bill.stage !== "House" && (
                    <div>
                      <h2 className="text-xl font-semibold mb-2 sm:mt-0 mt-2">
                        Senate
                      </h2>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
                          Votes For: {bill.senate_total_yes}
                        </span>
                        <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
                          Votes Against: {bill.senate_total_no}
                        </span>
                      </div>
                    </div>
                  )}
                  {bill.stage === "Presidential" && (
                    <div>
                      <h2 className="text-xl font-semibold mb-2 sm:mt-0 mt-2">
                        Presidential
                      </h2>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
                          Votes For: {bill.presidential_total_yes}
                        </span>
                        <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
                          Votes Against: {bill.presidential_total_no}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent>
              <p>
                No bills found
                {statusFilter !== "all" || stageFilter !== "all"
                  ? " matching the selected filters."
                  : "."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default withAuth(Bills);
