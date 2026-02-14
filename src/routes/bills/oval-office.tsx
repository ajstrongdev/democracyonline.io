import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type {President, PresidentialBill} from "@/lib/server/oval-office-bills";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  
  
  canVoteOnPresidentialBill,
  hasVotedOnPresidentialBill,
  presidentialBillsPageData,
  voteOnPresidentialBill
} from "@/lib/server/oval-office-bills";
import { useUserData } from "@/lib/hooks/use-user-data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { MessageDialog } from "@/components/message-dialog";
import PartyLogo from "@/components/party-logo";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/bills/oval-office")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const pageData = await presidentialBillsPageData();
    const { bills, presidents } = pageData;

    const sortedPresidents = presidents.sort((a, b) => {
      if (a.partyName === null && b.partyName === null) return 0;
      if (a.partyName === null) return 1;
      if (b.partyName === null) return -1;
      return a.partyName.localeCompare(b.partyName);
    });

    return { userData, bills, presidents: sortedPresidents };
  },
  component: RouteComponent,
});

type BillWithVotes = PresidentialBill & {
  votes: { signed: number; vetoed: number };
};

function RouteComponent() {
  const router = useRouter();
  const { bills, presidents, userData: loaderUserData } = Route.useLoaderData();
  const userData = useUserData(loaderUserData);

  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [pendingVote, setPendingVote] = useState<{
    billId: number;
    vote: boolean;
    title: string;
  } | null>(null);
  const [canVote, setCanVote] = useState<boolean | null>(null);
  const [hasVotedMap, setHasVotedMap] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<
    Record<number, { signed: number; vetoed: number }>
  >(() => {
    const initial: Record<number, { signed: number; vetoed: number }> = {};
    bills.forEach((bill: BillWithVotes) => {
      initial[bill.id] = bill.votes;
    });
    return initial;
  });

  // Check if user can vote (is a President)
  useState(() => {
    if (userData?.id) {
      canVoteOnPresidentialBill({ data: { userId: userData.id } }).then(
        setCanVote,
      );

      // Check voting status for each bill
      Promise.all(
        bills.map(async (bill: BillWithVotes) => {
          const hasVoted = await hasVotedOnPresidentialBill({
            data: { userId: userData.id, billId: bill.id },
          });
          return { billId: bill.id, hasVoted };
        }),
      ).then((results) => {
        const map: Record<number, boolean> = {};
        results.forEach(({ billId, hasVoted }) => {
          map[billId] = hasVoted;
        });
        setHasVotedMap(map);
      });
    }
  });

  const handleVote = async (billId: number, voteYes: boolean) => {
    if (!userData?.id) return;

    setIsLoading(true);
    try {
      await voteOnPresidentialBill({
        data: {
          userId: userData.id,
          billId,
          voteYes,
        },
      });

      // Update local state
      setHasVotedMap((prev) => ({ ...prev, [billId]: true }));
      setVotesData((prev) => ({
        ...prev,
        [billId]: {
          signed: prev[billId].signed + (voteYes ? 1 : 0),
          vetoed: prev[billId].vetoed + (voteYes ? 0 : 1),
        },
      }));

      router.invalidate();
    } catch (error) {
      console.error("Error signing/vetoing bill:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Oval Office
          </h1>
          <p className="text-muted-foreground">
            Sign or veto bills that have passed through the Senate.
          </p>
        </div>

        {/* Bills Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Bills Awaiting Decision</h2>
          {bills.length === 0 ? (
            <div className="text-muted-foreground">
              No bills currently awaiting presidential decision.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {bills.map((bill: BillWithVotes) => (
                <Card key={bill.id} className="flex flex-col">
                  <CardHeader>
                    <h2 className="text-xl font-bold">
                      Bill #{bill.id}: {bill.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      Proposed By:{" "}
                      <b className="text-black dark:text-white">
                        {bill.creator || "Unknown"}
                      </b>{" "}
                      | Status: {bill.status} | Stage: {bill.stage} | Created
                      at:{" "}
                      {bill.createdAt
                        ? new Date(bill.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </CardHeader>
                  <CardContent className="grow">
                    <p className="text-foreground mb-2 whitespace-pre-wrap line-clamp-3">
                      {bill.content}
                    </p>
                    {votesData[bill.id] ? (
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{votesData[bill.id].signed} Signed</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>{votesData[bill.id].vetoed} Vetoed</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mt-2">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                (votesData[bill.id].signed /
                                  (votesData[bill.id].signed +
                                    votesData[bill.id].vetoed || 1)) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${
                                (votesData[bill.id].vetoed /
                                  (votesData[bill.id].signed +
                                    votesData[bill.id].vetoed || 1)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No decisions recorded yet.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3">
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/bills/$id" params={{ id: bill.id.toString() }}>
                        View Full Bill
                      </Link>
                    </Button>
                    {canVote === null ? (
                      <div className="flex space-x-2">
                        <div className="animate-pulse flex space-x-2">
                          <div className="h-10 w-24 bg-muted rounded" />
                          <div className="h-10 w-32 bg-muted rounded" />
                        </div>
                      </div>
                    ) : !canVote ? (
                      <div className="text-red-500 text-sm">
                        You are not the President, you cannot sign or veto this
                        bill.
                      </div>
                    ) : hasVotedMap[bill.id] === false ? (
                      <div className="flex space-x-2 w-full">
                        <Button
                          className="flex-1"
                          disabled={isLoading}
                          onClick={() => {
                            setPendingVote({
                              billId: bill.id,
                              vote: true,
                              title: bill.title,
                            });
                            setShowVoteDialog(true);
                          }}
                        >
                          Sign Bill
                        </Button>
                        <Button
                          className="flex-1"
                          variant="destructive"
                          disabled={isLoading}
                          onClick={() => {
                            setPendingVote({
                              billId: bill.id,
                              vote: false,
                              title: bill.title,
                            });
                            setShowVoteDialog(true);
                          }}
                        >
                          Veto Bill
                        </Button>
                      </div>
                    ) : hasVotedMap[bill.id] === true ? (
                      <div className="text-green-600 font-semibold text-sm">
                        You have already decided on this bill.
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        You do not have permission to sign or veto this bill.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Bills that pass the Senate will arrive here for
                      presidential approval.
                    </p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Presidents List */}
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-2xl font-bold">President</h2>
          </CardHeader>
          <CardContent>
            {presidents.length === 0 ? (
              <div className="text-muted-foreground">
                No president has been elected.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {presidents.map((president: President) => (
                  <Card key={president.id} className="shadow-none border">
                    <CardContent className="grow">
                      <div className="flex h-full flex-col gap-2">
                        <h3 className="text-lg font-semibold mb-2">
                          {president.username}
                        </h3>
                        <div className="flex items-center gap-2">
                          {president.partyId ? (
                            <PartyLogo party_id={president.partyId} size={40} />
                          ) : (
                            <div className="w-10 h-10 mr-2 rounded-full bg-gray-400" />
                          )}
                          <h3
                            className="text-lg font-medium"
                            style={{ color: president.partyColor || undefined }}
                          >
                            {president.partyName || "Independent"}
                          </h3>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.navigate({ to: `/profile/${president.id}` })
                          }
                          className="w-full mt-auto"
                        >
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              The President reviews bills that have passed the Senate and can
              sign them into law or veto them.
            </p>
          </CardFooter>
        </Card>

        {/* Vote Confirmation Dialog */}
        <MessageDialog
          open={showVoteDialog}
          onOpenChange={(open) => {
            setShowVoteDialog(open);
            if (!open) setPendingVote(null);
          }}
          title="Confirm your decision"
          description={
            <span className="text-left leading-relaxed">
              <span className="block">
                Are you sure you want to{" "}
                <span className="font-semibold">
                  {pendingVote?.vote ? "SIGN" : "VETO"}
                </span>{" "}
                bill{" "}
                <span className="font-semibold">#{pendingVote?.billId}</span>
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
          confirmText={pendingVote?.vote ? "Sign Bill" : "Veto Bill"}
          cancelText="Cancel"
          confirmAriaLabel="Confirm decision"
          cancelAriaLabel="Cancel decision"
          variant={pendingVote?.vote ? "default" : "destructive"}
          onConfirm={async () => {
            if (pendingVote) {
              await handleVote(pendingVote.billId, pendingVote.vote);
            }
            setShowVoteDialog(false);
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
