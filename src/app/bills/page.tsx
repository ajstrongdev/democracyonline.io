"use client";

import React from "react";
import withAuth from "@/lib/withAuth";
import { useQuery } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BillItem } from "@/app/utils/billHelper";
import { getUserById } from "@/app/utils/userHelper";

function Bills() {
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Legislative Bills
        </h1>
        <p className="text-muted-foreground">
          View and track the status of legislative bills here.
        </p>
        <Button asChild className="mt-4 hover:cursor-pointer">
          <Link href="/bills/create">Create New Bill</Link>
        </Button>
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          All Bills
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
        ) : data && data.length > 0 ? (
          data.map((bill) => (
            <Card key={bill.id} className="mb-4 last:mb-0">
              <CardContent>
                <h2 className="text-xl font-semibold">
                  Bill #{bill.id}: {bill.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-2">
                  Proposed By:{" "}
                  <b className="text-black dark:text-white">{bill.username}</b>{" "}
                  | Status: {bill.status} | Stage: {bill.stage} | Created at:{" "}
                  {new Date(bill.created_at).toLocaleDateString()}
                </p>
                <p className="text-foreground">{bill.content}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent>
              <p>No bills found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default withAuth(Bills);
