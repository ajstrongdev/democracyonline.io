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
import { MessageDialog } from "@/components/ui/MessageDialog";
import { useState } from "react";
import PartyLogo from "@/components/PartyLogo";

type BillItemWithUsername = BillItem & {
  username: string;
};

function HouseOfRepresentatives() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [pendingVote, setPendingVote] = useState<{
    billId: number;
    vote: boolean;
    title: string;
  } | null>(null);

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
          if (!item.creator_id) {
            return { ...item, username: "Unknown" };
          }
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

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Current Bills</h2>
        {isLoading ? (
          <GenericSkeleton />
        ) : error ? (
          <div className="text-red-500">Error loading bills.</div>
        ) : bills.length === 0 ? (
          <div className="text-muted-foreground">
            No bills currently in the House.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bills.map((bill: BillItemWithUsername) => (
              <Card key={bill.id} className="flex flex-col">
                <CardHeader>
                  <h2 className="text-xl font-bold">
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
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-foreground mb-4">{bill.content}</p>
                  {votesLoading ? (
                    <GenericSkeleton />
                  ) : votesError ? (
                    <div className="text-red-500">Error loading votes.</div>
                  ) : votesData && votesData[bill.id] ? (
                    <div className="flex items-center gap-4 flex-wrap">
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
                <CardFooter className="flex-col items-start gap-3">
                  {canVoteLoading && data ? (
                    <div className="flex space-x-2">
                      <div className="animate-pulse flex space-x-2">
                        <div className="h-10 w-24 bg-muted rounded" />
                        <div className="h-10 w-32 bg-muted rounded" />
                      </div>
                    </div>
                  ) : canVoteError ? (
                    <div className="text-red-500 text-sm">
                      You are not a member of the House of Representatives, you
                      cannot vote on this bill.
                    </div>
                  ) : canVoteData &&
                    hasVotedData &&
                    hasVotedData[bill.id] === false ? (
                    <div className="flex space-x-2 w-full">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setPendingVote({
                            billId: bill.id,
                            vote: true,
                            title: bill.title,
                          });
                          setShowVoteDialog(true);
                        }}
                      >
                        Vote For
                      </Button>
                      <Button
                        className="flex-1"
                        variant="destructive"
                        onClick={() => {
                          setPendingVote({
                            billId: bill.id,
                            vote: false,
                            title: bill.title,
                          });
                          setShowVoteDialog(true);
                        }}
                      >
                        Vote Against
                      </Button>
                    </div>
                  ) : canVoteData &&
                    hasVotedData &&
                    hasVotedData[bill.id] === true ? (
                    <div className="text-green-600 font-semibold text-sm">
                      You have already voted on this bill.
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      You do not have permission to vote on this bill.
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    A new bill will become available every 8 hours in the House
                    of Representatives. You will have 24 hours to vote on each
                    bill.
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* House Chamber Chat */}
      {canVoteData && thisUser && (
        <div className="mb-8">
          <Chat
            room="house"
            userId={thisUser.id}
            username={thisUser.username}
            title="House Chamber"
          />
        </div>
      )}

      {/* Representatives List - Full Width */}
      <Card className="mb-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {representatives.map((rep: any) => (
                <Card key={rep.id} className="shadow-none border">
                  <CardHeader className="p-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-semibold mb-2">
                        {rep.username}
                      </h3>
                      <div className="flex items-center gap-2">
                        {rep.party_id ? (
                          <PartyLogo party_id={rep.party_id} size={40} />
                        ) : (
                          <div className="w-[40px] h-[40px] mr-2 rounded-full bg-gray-400" />
                        )}
                        <h3
                          className="text-lg font-medium"
                          style={{ color: rep.partyColor }}
                        >
                          {rep.partyName}
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/profile/${rep.id}`)}
                        className="w-full mt-4"
                      >
                        View Profile
                      </Button>
                    </div>
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
      <MessageDialog
        open={showVoteDialog}
        onOpenChange={(open) => {
          setShowVoteDialog(open);
          if (!open) setPendingVote(null);
        }}
        title="Confirm your vote"
        description={
          <span className="text-left leading-relaxed">
            <span className="block">
              Are you sure you want to vote{" "}
              <span className="font-semibold">
                {pendingVote?.vote ? "FOR" : "AGAINST"}
              </span>{" "}
              bill <span className="font-semibold">#{pendingVote?.billId}</span>
              {pendingVote?.title ? (
                <>
                  : <span className="font-semibold">{pendingVote.title}</span>
                </>
              ) : null}
              ?
            </span>
            <span className="block mt-2 text-sm text-muted-foreground">
              This action is final and visible to others.
            </span>
          </span>
        }
        confirmText={pendingVote?.vote ? "Vote FOR" : "Vote AGAINST"}
        cancelText="Cancel"
        confirmAriaLabel="Confirm vote"
        cancelAriaLabel="Cancel vote"
        variant={pendingVote?.vote ? "default" : "destructive"}
        onConfirm={async () => {
          if (pendingVote) {
            await voteOnBill(pendingVote.billId, pendingVote.vote);
          }
          setShowVoteDialog(false);
        }}
      />
    </div>
  );
}

export default withAuth(HouseOfRepresentatives);
