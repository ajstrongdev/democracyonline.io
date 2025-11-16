"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import GenericSkeleton from "@/components/genericskeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import type {
  BillWithUsername,
  Role,
  Stage,
  UserWithParty,
} from "@/lib/trpc/types";

type Props = {
  title: string;
  stage: Stage;
  voterRole: Role;
  chatRoom?: string;
  showRepsList?: boolean;
  repsRoleForList?: Role;
};

type PendingVote = {
  billId: number;
  vote: boolean;
  title: string;
};

export function BillsStageView({
  title,
  stage,
  voterRole,
  chatRoom,
  showRepsList = false,
  repsRoleForList,
}: Props) {
  const [user] = useAuthState(auth);
  const utils = trpc.useUtils();
  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  const {
    data: bills = [],
    isLoading,
    error,
  } = trpc.bill.getVoting.useQuery({
    stage,
  });

  const {
    data: votesData = [],
    isLoading: votesLoading,
    error: votesError,
  } = trpc.bill.getVotesForBills.useQuery(
    { stage, billIds: bills.map((b) => b.id) },
    { enabled: bills.length > 0 },
  );

  const { data: canVoteData, isLoading: canVoteLoading } =
    trpc.user.canVote.useQuery(
      { role: voterRole },
      { enabled: !!thisUser?.id },
    );

  const { data: hasVotedData } = trpc.bill.hasVotedForBills.useQuery(
    { userId: thisUser?.id ?? 0, stage, billIds: bills.map((b) => b.id) },
    { enabled: !!thisUser?.id && bills.length > 0 },
  );

  const addFeed = trpc.feed.add.useMutation();
  const voteOnBillMutation = trpc.bill.voteOnBill.useMutation({
    onSuccess: async () => {
      await utils.bill.getVotesForBills.invalidate({ stage });
      if (thisUser?.id) {
        await utils.bill.hasVotedForBills.invalidate({
          userId: thisUser.id,
          stage,
          billIds: bills.map((b) => b.id),
        });
      }
    },
  });

  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);

  const voteOnBill = async (billId: number, vote: boolean): Promise<void> => {
    if (!thisUser?.id) return;
    await voteOnBillMutation.mutateAsync({ billId, stage, vote });
    const label =
      stage === "Presidential"
        ? vote
          ? "Signed"
          : "Vetoed"
        : vote
          ? "Voted FOR"
          : "Voted AGAINST";
    try {
      await addFeed.mutateAsync({
        content:
          stage === "Presidential"
            ? `${label} bill #${billId} in the Oval Office.`
            : `${label} bill #${billId} in the ${stage}.`,
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground">
          View and vote on bills currently in the {stage}
          {stage === "Presidential" ? "" : "."}
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
            No bills currently in the {stage}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bills.map((bill: BillWithUsername) => {
              const billVotes = votesData.find((v) => v.billId === bill.id);

              return (
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
                      | Status: {bill.status} | Stage: {bill.stage} | Created
                      at: {new Date(bill.createdAt).toLocaleDateString()}
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
                    ) : billVotes ? (
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
                          Votes For: {billVotes.totals.for ?? 0}
                        </span>
                        <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
                          Votes Against: {billVotes.totals.against ?? 0}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No votes recorded yet.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3">
                    {canVoteLoading && bills.length ? (
                      <div className="animate-pulse flex space-x-2">
                        <div className="h-10 w-24 bg-muted rounded" />
                        <div className="h-10 w-32 bg-muted rounded" />
                      </div>
                    ) : !canVoteData?.canVote ? (
                      <div className="text-red-500 text-sm">
                        {stage === "Presidential"
                          ? "You are not the president, you cannot vote on this bill."
                          : `You are not a member of the ${stage}, you cannot vote on this bill.`}
                      </div>
                    ) : canVoteData.canVote &&
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
                    ) : canVoteData.canVote &&
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
                      A new bill will become available every 8 hours
                      {stage !== "Presidential" ? ` in the ${stage}` : ""}. You
                      will have 24 hours to vote on each bill.
                    </p>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {chatRoom && thisUser && (
        <div className="mb-8">
          {/* Lazy import your Chat to avoid initial bundle size if desired */}
          {/* <Chat room={chatRoom} userId={thisUser.id} username={thisUser.username} title={`${stage} Chamber`} /> */}
        </div>
      )}

      {showRepsList && repsRoleForList && (
        <ChamberMembers role={repsRoleForList} />
      )}

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

interface ChamberMembersProps {
  role: Role;
}

function ChamberMembers({ role }: ChamberMembersProps): JSX.Element {
  const router = useRouter();
  const {
    data: members = [],
    isLoading,
    error,
  } = trpc.user.getByRoleWithParty.useQuery({ role });

  if (isLoading) return <GenericSkeleton />;
  if (error) return <div className="text-red-500">Error loading members.</div>;
  if (!members.length)
    return <div className="text-muted-foreground">No members found.</div>;

  const getRoleTitle = (role: Role): string => {
    switch (role) {
      case "Representative":
        return "Representatives";
      case "Senator":
        return "Senators";
      case "President":
        return "President(s)";
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <h2 className="text-2xl font-bold">{getRoleTitle(role)}</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {members.map((mem: UserWithParty) => (
            <Card key={mem.id} className="shadow-none border">
              <CardHeader className="p-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold mb-2">{mem.username}</h3>
                  <div className="flex items-center gap-2">
                    {mem.partyId ? (
                      <div
                        className="w-[40px] h-[40px] mr-2 rounded-full"
                        style={{
                          backgroundColor: mem.partyColor || "#888",
                        }}
                      />
                    ) : (
                      <div className="w-[40px] h-[40px] mr-2 rounded-full bg-gray-400" />
                    )}
                    <h3
                      className="text-lg font-medium"
                      style={{ color: mem.partyColor ?? undefined }}
                    >
                      {mem.partyName ?? "Independent"}
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/profile/${mem.id}`)}
                    className="w-full mt-4"
                  >
                    View Profile
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
