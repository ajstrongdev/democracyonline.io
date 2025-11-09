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
import { MessageDialog } from "@/components/ui/MessageDialog";
import { useState } from "react";
import PartyLogo from "@/components/PartyLogo";

type BillItemWithUsername = BillItem & {
  username: string;
};

function OvalOfficeBills() {
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
        params: { stage: "Presidential" },
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
    queryKey: ["ovalOfficeVotes", data.map((bill: BillItem) => bill.id)],
    queryFn: async () => {
      if (data.length === 0) return {};
      const votesResults = await Promise.all(
        data.map(async (bill: BillItem) => {
          const res = await axios.post(`/api/get-bill-votes`, {
            billId: bill.id,
            stage: "Presidential",
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

  const {
    data: repsData,
    isLoading: repsLoading,
    error: repsError,
  } = useQuery({
    queryKey: ["presidents"],
    queryFn: async () => {
      const res = await axios.get("/api/get-role", {
        params: { role: "President" },
      });
      const presidents = res.data.representatives || [];
      const presidentsWithParties = await Promise.all(
        presidents.map(async (pres: UserInfo) => {
          if (!pres.party_id) {
            return { ...pres, partyName: "Independent", partyColor: null };
          }
          const partyRes = await fetch(
            `/api/get-party-by-id?partyId=${pres.party_id}`
          );
          const partyData = await partyRes.json();
          return {
            ...pres,
            partyName: partyData?.name || "Independent",
            partyColor: partyData?.color || null,
          };
        })
      );
      return presidentsWithParties;
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
        role: "President",
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
            stage: "Presidential",
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
        role: "President",
        vote,
      });
      await axios.post("/api/feed-add", {
        userId: thisUser.id,
        content: `${
          vote ? "Signed" : "Vetoed"
        } bill #${billId} in the Oval Office.`,
      });
      queryClient.invalidateQueries({ queryKey: ["ovalOfficeVotes"] });
      queryClient.invalidateQueries({ queryKey: ["hasVoted"] });
      return res.data;
    } catch (error) {
      console.error("Error voting on bill:", error);
      return null;
    }
  };

  const bills: BillItemWithUsername[] = data;

  const presidents: any[] = repsData || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Oval Office</h1>
        <p className="text-muted-foreground">
          View and vote on bills currently in the Oval Office.
        </p>
      </div>

      {/* Bills Grid - 1, 2, or 3 columns based on screen size */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Current Bills</h2>
        {isLoading ? (
          <GenericSkeleton />
        ) : error ? (
          <div className="text-red-500">Error loading bills.</div>
        ) : bills.length === 0 ? (
          <div className="text-muted-foreground">
            No bills currently in the Oval Office.
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
                    | Status: Presidential | Stage: {bill.stage} | Created at:{" "}
                    {new Date(bill.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent className="grow">
                  <p className="text-foreground mb-4 whitespace-pre-wrap">
                    {bill.content}
                  </p>
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
                      You are not the President, you cannot vote on this bill.
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
                    A new bill will become available every 8 hours. You will
                    have 24 hours to vote on each bill.
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* The President - Full Width */}
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-2xl font-bold">The President</h2>
        </CardHeader>
        <CardContent>
          {repsLoading ? (
            <GenericSkeleton />
          ) : repsError ? (
            <div className="text-red-500">Error loading presidents.</div>
          ) : presidents.length === 0 ? (
            <div className="text-muted-foreground">
              This office is currently vacant.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {presidents.map((sen: any) => (
                <Card key={sen.id} className="shadow-none border">
                  <CardHeader className="p-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-semibold mb-2">
                        {sen.username}
                      </h3>
                      <div className="flex items-center gap-2">
                        {sen.party_id ? (
                          <PartyLogo party_id={sen.party_id} size={40} />
                        ) : (
                          <div className="w-[40px] h-[40px] mr-2 rounded-full bg-gray-400" />
                        )}
                        <h3
                          className="text-lg font-medium"
                          style={{ color: sen.partyColor }}
                        >
                          {sen.partyName}
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/profile/${sen.id}`)}
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
            The President can vote to approve or veto bills that reach the Oval
            Office.
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

export default withAuth(OvalOfficeBills);
