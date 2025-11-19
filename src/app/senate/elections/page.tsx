"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { CandidatesChart } from "@/components/CandidateChart";
import { Chat } from "@/components/Chat";
import GenericSkeleton from "@/components/genericskeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import withAuth from "@/lib/withAuth";

function SenateElections() {
  const [user] = useAuthState(auth);
  const utils = trpc.useUtils();
  const [showCandidacyDialog, setShowCandidacyDialog] = useState(false);

  // Get user info
  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  // Get election info
  const {
    data: electionInfo,
    isLoading,
    isError,
  } = trpc.election.info.useQuery(
    { election: "Senate" },
    { enabled: !!thisUser, refetchOnWindowFocus: false, retry: false },
  );

  // Get candidates - always fetch when we have election info
  const { data: candidates, isLoading: candidatesLoading } =
    trpc.election.getCandidates.useQuery(
      { election: "Senate" },
      { enabled: !!electionInfo, refetchOnWindowFocus: false, retry: false },
    );

  // Check if user is a candidate in any election
  const { data: isCandidateData } = trpc.election.isCandidate.useQuery(
    { userId: thisUser?.id },
    { enabled: !!thisUser },
  );

  const isACandidate = isCandidateData?.isCandidate || false;

  // Check if user has voted
  const { data: hasVotedData } = trpc.election.hasVoted.useQuery(
    { userId: thisUser?.id, election: "Senate" },
    {
      enabled: !!thisUser && !!electionInfo && electionInfo.status === "Voting",
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const maxVotes = hasVotedData?.maxVotes || 0;
  const votesRemaining = hasVotedData?.votesRemaining || 0;
  const votedCandidateIds = hasVotedData?.votedCandidateIds || [];

  const CandidateItem = ({
    userId,
    candidateId,
  }: {
    userId: number;
    candidateId: number;
  }) => {
    const { data: candidateUser, isLoading: userLoading } =
      trpc.user.getById.useQuery(
        { userId: Number(userId), omitEmail: true },
        { enabled: !!userId },
      );

    const { data: party, isLoading: partyLoading } =
      trpc.party.getById.useQuery(
        { partyId: candidateUser?.partyId },
        { enabled: !!candidateUser?.partyId },
      );

    if (userLoading) {
      return <GenericSkeleton />;
    }

    if (!candidateUser) {
      return <div className="p-2">Unknown candidate</div>;
    }

    return (
      <Card className="py-4 my-4">
        <CardContent className="md:flex md:items-center md:justify-between">
          {partyLoading ? (
            <p className="text-sm text-muted-foreground">Loading party...</p>
          ) : party ? (
            <div>
              <h1 className="text-xl font-semibold">
                {candidateUser.username}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Current role: {candidateUser.role}
              </p>
              <p
                className="text-sm text-muted-foreground mt-1"
                style={party ? { color: party.color } : {}}
              >
                <span className="text-muted-foreground">Party:</span>{" "}
                {party ? party.name : "Independent"}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-semibold">
                {candidateUser.username}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Party: Independent
              </p>
            </div>
          )}
          <div className="mt-4 md:mt-0 flex items-center">
            <Button asChild>
              <Link href={`/profile/${candidateUser.id}`}>View Profile</Link>
            </Button>
            {electionInfo.status === "Voting" && (
              <Button
                onClick={() => voteForCandidate(candidateId)}
                disabled={
                  votesRemaining === 0 ||
                  votedCandidateIds.includes(candidateId)
                }
                className="ml-4"
              >
                {votedCandidateIds.includes(candidateId)
                  ? "✓ Voted"
                  : votesRemaining === 0
                    ? "No Votes Left"
                    : `Vote for ${candidateUser.username}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const ResultsItem = ({
    userId,
    votes,
  }: {
    userId: number;
    votes: number;
  }) => {
    const { data: candidateUser, isLoading: userLoading } =
      trpc.user.getById.useQuery(
        { userId: Number(userId), omitEmail: true },
        { enabled: !!userId },
      );

    const { data: party } = trpc.party.getById.useQuery({
      partyId: Number(id),
    });

    if (userLoading) {
      return <GenericSkeleton />;
    }

    if (!candidateUser) {
      return <div className="p-2">Unknown candidate</div>;
    }

    return (
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">{candidateUser.username}</h3>
          <p
            className="text-sm text-muted-foreground"
            style={{ color: party?.color }}
          >
            {party?.name || "Independent"}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-primary">{votes}</p>
          <p className="text-sm text-muted-foreground">votes</p>
        </CardContent>
      </Card>
    );
  };

  const addFeed = trpc.feed.add.useMutation();

  const stand = trpc.election.stand.useMutation({
    onSuccess: async () => {
      await utils.election.getCandidates.invalidate({ election: "Senate" });
      await addFeed.mutateAsync({
        content: `Is running as a candidate for the Senate.`,
      });
    },
  });

  const handleCandidacyConfirm = async () => {
    if (!thisUser) return;
    await stand.mutateAsync({ election: "Senate" });
  };

  const withdraw = trpc.election.withdraw.useMutation({
    onSuccess: async () => {
      await utils.election.getCandidates.invalidate({ election: "Senate" });
      await utils.election.isCandidate.invalidate({ userId: thisUser?.id });
      await addFeed.mutateAsync({
        content: `Is no longer running as a candidate for the Senate.`,
      });
    },
  });

  const revokeCandidacy = async () => {
    if (!thisUser) return;
    await withdraw.mutateAsync({ election: "Senate" });
  };

  const standAsCandidate = () => {
    setShowCandidacyDialog(true);
  };

  const voteMutation = trpc.election.vote.useMutation({
    onSuccess: async () => {
      await utils.election.getCandidates.invalidate({ election: "Senate" });
      await utils.election.hasVoted.invalidate({
        userId: thisUser?.id,
        election: "Senate",
      });
    },
  });

  const voteForCandidate = async (candidateId: number) => {
    if (!thisUser) return;
    await voteMutation.mutateAsync({ candidateId, election: "Senate" });
  };

  const isAlreadyCandidate =
    candidates &&
    Array.isArray(candidates) &&
    candidates.some((candidate) => candidate.userId === thisUser?.id);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold mb-4">Senate Elections</h1>
          <p className="text-muted-foreground mb-6">
            Participate in the democratic process by standing as a candidate or
            voting for in the Senate elections.
          </p>
        </div>
        {electionInfo && (
          <Card>
            <CardContent>
              {electionInfo.status === "Candidate" ? (
                <p className="text-muted-foreground text-sm">
                  Polls open in <b>{electionInfo.daysLeft} days</b>.
                </p>
              ) : electionInfo.status === "Voting" ? (
                <p className="text-muted-foreground text-sm">
                  Election ends in <b>{electionInfo.daysLeft} days</b>.
                </p>
              ) : electionInfo.status === "Concluded" ? (
                <p className="text-muted-foreground text-sm">
                  You can stand as a candidate for the next election in{" "}
                  <b>{electionInfo.daysLeft} days</b>.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
      {isLoading ? (
        <GenericSkeleton />
      ) : isError ? (
        <Alert className="mb-6">
          <AlertTitle className="font-bold">
            Error loading election info
          </AlertTitle>
          <AlertDescription>
            There was an error fetching the election information. Please try
            again later.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {electionInfo && electionInfo.status === "Voting" && (
            <Alert className="mb-6">
              <AlertTitle className="font-bold">Elections are live!</AlertTitle>
              <AlertDescription>
                The Senate elections are now in the voting phase. Cast your
                votes for your preferred candidates before the elections close.
                There are {electionInfo.seats} seats available.
                {hasVotedData && (
                  <span className="block mt-2 font-semibold">
                    You have {votesRemaining} of {maxVotes} votes remaining.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          {electionInfo &&
            electionInfo.status === "Candidate" &&
            (candidatesLoading ? (
              <GenericSkeleton />
            ) : (
              <Alert className="mb-6">
                <AlertTitle className="font-bold">
                  {isAlreadyCandidate
                    ? "You are standing in this election"
                    : "Stand as a candidate!"}
                </AlertTitle>
                <AlertDescription
                  className={
                    isAlreadyCandidate || !isACandidate
                      ? "md:flex md:items-center md:justify-between"
                      : ""
                  }
                >
                  Stand as a candidate in the upcoming Senate elections and
                  become the voice of the people.
                  {!isAlreadyCandidate && !isACandidate && thisUser ? (
                    <Button className="mt-4 md:mt-0" onClick={standAsCandidate}>
                      Declare Candidacy!
                    </Button>
                  ) : isAlreadyCandidate ? (
                    <Button className="mt-4 md:mt-0" onClick={revokeCandidacy}>
                      Drop out
                    </Button>
                  ) : isACandidate && !isAlreadyCandidate ? (
                    <h2 className="mt-2 text-yellow-500 font-semibold">
                      You are a candidate in another election.
                    </h2>
                  ) : null}
                </AlertDescription>
              </Alert>
            ))}
          {electionInfo && electionInfo.status === "Concluded" && (
            <Alert className="mb-6">
              <AlertTitle className="font-bold">Elections concluded</AlertTitle>
              <AlertDescription>
                The Senate elections have concluded. Here are the final results.
                The top {electionInfo.seats > 1 ? electionInfo.seats : 1}{" "}
                candidates have been elected to the Senate.
              </AlertDescription>
            </Alert>
          )}
          {/* Election Results */}
          {electionInfo &&
            (electionInfo.status === "Concluded" ||
              electionInfo.status === "Voting") && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                  {electionInfo.status === "Concluded"
                    ? "Election Results"
                    : "Current Results"}
                </h2>
                {candidates && candidates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                    <CandidatesChart candidates={candidates} />
                    {[...candidates]
                      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                      .map((candidate) => {
                        const _userId = candidate.userId;
                        const _votes = candidate.votes;
                        return (
                          <ResultsItem
                            key={candidate.id}
                            userId={candidate.userId}
                            votes={candidate.votes}
                          />
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No candidates yet.</p>
                )}
              </div>
            )}
          {thisUser && (
            <Chat
              room="senate-election"
              userId={thisUser.id}
              username={thisUser.username}
              title="Election Discussion"
            />
          )}
          {electionInfo && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Candidates</h2>
              {candidates && candidates.length > 0 ? (
                <div className="space-y-2">
                  {candidates.map((candidate) => {
                    return (
                      <CandidateItem
                        key={candidate.id}
                        userId={candidate.userId}
                        candidateId={candidate.id}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
      <MessageDialog
        open={showCandidacyDialog}
        onOpenChange={setShowCandidacyDialog}
        title="Important Election Rule"
        description={
          <span className="text-left leading-relaxed">
            <span className="block">
              <span className="font-semibold">Warning:</span> If you declare
              your candidacy for the senate election, you{" "}
              <span className="font-semibold">cannot</span> be a candidate for
              any other elections during this cycle.
            </span>
            <span className="mt-2 block">
              This is a binding decision that prevents running for multiple
              positions simultaneously. You can declare candidacy for other
              offices again after this election has concluded.
            </span>
          </span>
        }
        confirmText="I Understand, Declare Candidacy"
        cancelText="Cancel"
        confirmAriaLabel="Confirm and declare candidacy"
        cancelAriaLabel="Cancel declaration"
        variant="destructive"
        onConfirm={handleCandidacyConfirm}
      />
    </div>
  );
}

export default withAuth(SenateElections);
