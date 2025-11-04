/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import withAuth from "@/lib/withAuth";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { fetchUserInfo } from "@/app/utils/userHelper";
import type { BillItem } from "@/app/utils/billHelper";
import { getUserFullById } from "@/app/utils/userHelper";
import { UserInfo } from "@/app/utils/userHelper";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/Chat";

type BillItemWithUsername = BillItem & {
  username: string;
};

function HouseOfRepresentatives() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Get user info
  const { data: thisUser } = useQuery({
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
      const res = await axios.get("/api/bills-get-voting", {
        params: { stage: "House" },
      });
      const bills = res.data.bills || [];
      const billsWithUsernames = await Promise.all(
        bills.map(async (item: BillItem) => {
          const user = await getUserFullById(item.creator_id);
          return { ...item, username: user?.username || "Unknown" };
        })
      );
      console.log(billsWithUsernames);
      return billsWithUsernames;
    },
  });

  // Get bill voting data
  const {
    data: votesData,
    isLoading: votesLoading,
    error: votesError,
  } = useQuery({
    queryKey: ["houseVotes", data.map((bill: BillItem) => bill.id)],
    queryFn: async () => {
      if (data.length === 0) return {};
      const votesResults = await Promise.all(
        data.map(async (bill: BillItem) => {
          const res = await axios.post(`/api/get-bill-votes`, {
            billId: bill.id,
            stage: "House",
          });
          return { billId: bill.id, votes: res.data };
        })
      );
      const votesMap: Record<number, { for: number; against: number }> = {};
      votesResults.forEach(({ billId, votes }) => {
        votesMap[billId] = { for: votes.for, against: votes.against };
      });
      return votesMap;
    },
    enabled: data.length > 0,
  });

  // Get party data from party ids of representatives
  const { data: partyData } = useQuery({
    queryKey: ["parties", thisUser?.party_id],
    queryFn: async () => {
      if (!thisUser?.party_id) return null;
      return fetch(`/api/get-party-by-id?partyId=${thisUser.party_id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data) => data || null);
    },
    enabled: !!thisUser?.party_id,
  });

  const {
    data: repsData,
    isLoading: repsLoading,
    error: repsError,
  } = useQuery({
    queryKey: ["representatives"],
    queryFn: async () => {
      const res = await axios.get("/api/get-role", {
        params: { role: "Representative" },
      });
      const representatives = res.data.representatives || [];
      const representativesWithParties = await Promise.all(
        representatives.map(async (rep: UserInfo) => {
          if (!rep.party_id) {
            return { ...rep, partyName: "Independent", partyColor: null };
          }
          const partyRes = await fetch(
            `/api/get-party-by-id?partyId=${rep.party_id}`
          );
          const partyData = await partyRes.json();
          return {
            ...rep,
            partyName: partyData?.name || "Independent",
            partyColor: partyData?.color || null,
          };
        })
      );
      return representativesWithParties;
    },
  });

  const {
    data: canVoteData,
    isLoading: canVoteLoading,
    error: canVoteError,
  } = useQuery({
    queryKey: ["canVote", thisUser?.id],
    queryFn: async () => {
      if (!thisUser?.id) return false;
      const res = await axios.post("/api/user-can-vote", {
        userId: thisUser.id,
        role: "Representative",
      });
      return res.data.canVote || false;
    },
    enabled: !!thisUser?.id,
  });

  const { data: hasVotedData } = useQuery({
    queryKey: ["hasVoted", thisUser?.id],
    queryFn: async () => {
      if (!thisUser?.id) return {};
      const votesResults = await Promise.all(
        data.map(async (bill: BillItem) => {
          const res = await axios.post(`/api/user-has-voted`, {
            userId: thisUser.id,
            billId: bill.id,
            stage: "House",
          });
          return { billId: bill.id, hasVoted: res.data.hasVoted || false };
        })
      );

      const votesMap: Record<number, boolean> = {};
      votesResults.forEach(({ billId, hasVoted }) => {
        votesMap[billId] = hasVoted;
      });
      return votesMap;
    },
    enabled: thisUser?.id && data.length > 0,
  });

  const voteOnBill = async (billId: number, vote: boolean) => {
    if (!thisUser?.id) {
      alert("You must be logged in to vote.");
      return;
    }
    try {
      const res = await axios.post("/api/bill-vote", {
        userId: thisUser.id,
        billId,
        role: "Representative",
        vote,
      });
      await axios.post("/api/feed-add", {
        userId: thisUser.id,
        content: `Voted ${
          vote ? "FOR" : "AGAINST"
        } bill #${billId} in the House of Representatives.`,
      });
      queryClient.invalidateQueries({ queryKey: ["houseVotes"] });
      queryClient.invalidateQueries({ queryKey: ["hasVoted"] });
      return res.data;
    } catch (error) {
      console.error("Error voting on bill:", error);
      return null;
    }
  };

  const bills: BillItemWithUsername[] = data;

  const representatives: any[] = repsData || [];
  const votedRecord =
    bills.length > 0 ? hasVotedData?.[bills[0].id] : undefined;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          House of Representatives
        </h1>
        <p className="text-muted-foreground">
          View and vote on bills currently in the House of Representatives.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        {isLoading ? (
          <GenericSkeleton />
        ) : error ? (
          <div className="text-red-500">Error loading bills.</div>
        ) : bills.length === 0 ? (
          <div className="text-muted-foreground">
            No bills currently in the House.
          </div>
        ) : (
          bills.map((bill: BillItemWithUsername) => (
            <Card key={bill.id} className="mb-4">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Bill #{bill.id}: {bill.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-2">
                  Proposed By:{" "}
                  <b className="text-black dark:text-white">{bill.username}</b>{" "}
                  | Status: {bill.status} | Stage: {bill.stage} | Created at:{" "}
                  {new Date(bill.created_at).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-foreground mb-4">{bill.content}</p>
                {votesLoading ? (
                  <GenericSkeleton />
                ) : votesError ? (
                  <div className="text-red-500">Error loading votes.</div>
                ) : votesData && votesData[bill.id] ? (
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
                      Votes For: {votesData[bill.id].for}
                    </span>
                    <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
                      Votes Against: {votesData[bill.id].against}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No votes recorded yet.
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {canVoteLoading && data ? (
                  <div className="flex space-x-2">
                    <div className="animate-pulse flex space-x-2">
                      <div className="h-10 w-24 bg-muted rounded" />
                      <div className="h-10 w-32 bg-muted rounded" />
                    </div>
                  </div>
                ) : canVoteError ? (
                  <div className="text-red-500">
                    You are not a member of the House of Representatives, you
                    cannot vote on this bill.
                  </div>
                ) : canVoteData &&
                  hasVotedData &&
                  hasVotedData[bill.id] === false ? (
                  <div className="flex space-x-2">
                    <Button onClick={() => voteOnBill(bill.id, true)}>
                      Vote For
                    </Button>
                    <Button onClick={() => voteOnBill(bill.id, false)}>
                      Vote Against
                    </Button>
                  </div>
                ) : canVoteData &&
                  hasVotedData &&
                  hasVotedData[bill.id] === true ? (
                  <div className="text-green-600 font-semibold">
                    You have already voted on this bill.
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    You do not have permission to vote on this bill.
                  </div>
                )}
              </CardFooter>
              <CardFooter>
                <p className="text-sm text-muted-foreground">
                  Bills reset daily at 8pm UTC. After 24 hours votes will be
                  tallied and the bill will either pass to the Senate or be
                  defeated.
                </p>
              </CardFooter>
            </Card>
          ))
        )}
        <Card className="mb-4 max-h-[500px] overflow-y-auto">
          <CardHeader>
            <h2 className="text-2xl font-bold">Representatives</h2>
          </CardHeader>
          <CardContent>
            {repsLoading ? (
              <GenericSkeleton />
            ) : repsError ? (
              <div className="text-red-500">Error loading representatives.</div>
            ) : representatives.length === 0 ? (
              <div className="text-muted-foreground">
                No representatives found.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {representatives.map((rep: any) => (
                  <Card key={rep.id} className="shadow-none border">
                    <CardHeader className="flex flex-row items-center justify-between p-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {rep.username}
                        </h3>
                        <p
                          className="text-sm text-muted-foreground"
                          style={{ color: rep.partyColor }}
                        >
                          {rep.partyName}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/profile/${rep.id}`)}
                      >
                        View Profile
                      </Button>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Members of the House of Representatives can propose and vote on
              bills.
            </p>
          </CardFooter>
        </Card>
      </div>
      {canVoteData && thisUser && (
        <Chat
          room="house"
          userId={thisUser.id}
          username={thisUser.username}
          title="House Chamber"
        />
      )}
    </div>
  );
}

export default withAuth(HouseOfRepresentatives);
