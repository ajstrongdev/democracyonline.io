"use client";

import withAuth from "@/lib/withAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { fetchUserInfo, getUserFullById } from "@/app/utils/userHelper";
import { Party } from "@/app/utils/partyHelper";
import { Chat } from "@/components/Chat";
import { CandidatesChart } from "@/components/CandidateChart";
import Link from "next/link";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { useState } from "react";

function SenateElections() {
  const [user] = useAuthState(auth);
  const queryClient = useQueryClient();
  const [showCandidacyDialog, setShowCandidacyDialog] = useState(false);

  // Get user info
  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });
  // Get election info
  const {
    data: electionInfo,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["electionInfo", "Senate"],
    queryFn: () =>
      axios
        .get("/api/election-info", { params: { election: "Senate" } })
        .then((res) => res.data),
    enabled: !!thisUser,
    refetchOnWindowFocus: false,
    retry: false,
  });
  // Get candidates - always fetch when we have election info
  const {
    data: candidates,
    refetch: refetchCandidates,
    isLoading: candidatesLoading,
  } = useQuery({
    queryKey: ["candidates", "Senate"],
    queryFn: () =>
      axios
        .get("/api/election-get-candidates", {
          params: { election: "Senate" },
        })
        .then((res) => res.data),
    enabled: !!electionInfo,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Check if user is a candidate in any election
  const { data: isCandidateData } = useQuery({
    queryKey: ["isCandidate", thisUser?.id],
    queryFn: () =>
      axios
        .post("/api/election-is-candidate", {
          candidate: thisUser?.id,
        })
        .then((res) => res.data),
    enabled: !!thisUser,
  });

  const isACandidate = isCandidateData?.isCandidate || false;

  // Check if user has voted
  const { data: hasVotedData, refetch: refetchHasVoted } = useQuery({
    queryKey: ["hasVoted", "Senate", thisUser?.id],
    queryFn: () =>
      axios
        .post("/api/elections-has-voted", {
          userId: thisUser?.id,
          election: "Senate",
        })
        .then((res) => res.data),
    enabled: !!thisUser && !!electionInfo && electionInfo.status === "Voting",
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasVoted = hasVotedData?.hasVoted || false;

  const CandidateItem = ({
    userId,
    candidateId,
  }: {
    userId: number;
    candidateId: number;
  }) => {
    const { data: candidateUser, isLoading: userLoading } = useQuery({
      queryKey: ["candidateUser", userId],
      queryFn: () => getUserFullById(Number(userId), true),
      enabled: !!userId,
    });

    const { data: party, isLoading: partyLoading } = useQuery<Party>({
      queryKey: ["party", candidateUser?.party_id],
      queryFn: () =>
        axios
          .get("/api/get-party-by-id", {
            params: { partyId: candidateUser?.party_id },
          })
          .then((res) => res.data),
      enabled: !!candidateUser?.party_id,
    });

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
            <>
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
            </>
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
                disabled={hasVoted}
                className="ml-4"
              >
                {hasVoted
                  ? "Already Voted"
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
    const { data: candidateUser, isLoading: userLoading } = useQuery({
      queryKey: ["candidateUser", userId],
      queryFn: () => getUserFullById(Number(userId), true),
      enabled: !!userId,
    });

    const { data: party } = useQuery<Party>({
      queryKey: ["party", candidateUser?.party_id],
      queryFn: () =>
        axios
          .get("/api/get-party-by-id", {
            params: { partyId: candidateUser?.party_id },
          })
          .then((res) => res.data),
      enabled: !!candidateUser?.party_id,
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

  const handleCandidacyConfirm = async () => {
    if (!thisUser) return;
    try {
      await axios.post("/api/election-stand-candidate", {
        userId: thisUser.id,
        election: "Senate",
      });
      await refetch();
      await refetchCandidates();
      await axios.post("/api/feed-add", {
        userId: thisUser.id,
        content: `Is running as a candidate for the Senate.`,
      });
      queryClient.invalidateQueries({ queryKey: ["candidates", "Senate"] });
    } catch (error) {
      console.error("Error standing as candidate:", error);
    }
  };

  const revokeCandidacy = async () => {
    if (!thisUser) return;
    try {
      await axios.post("/api/election-remove-candidate", {
        userId: thisUser.id,
        election: "Senate",
      });
      await refetch();
      await refetchCandidates();
      await axios.post("/api/feed-add", {
        userId: thisUser.id,
        content: `Is no longer running as a candidate for the Senate.`,
      });
      queryClient.invalidateQueries({ queryKey: ["candidates", "Senate"] });
      queryClient.invalidateQueries({ queryKey: ["isCandidate", thisUser.id] });
    } catch (error) {
      console.error("Error revoking candidacy:", error);
    }
  };
    
  const standAsCandidate = () => {
    setShowCandidacyDialog(true);
  };

  const voteForCandidate = async (candidateId: number) => {
    if (!thisUser) return;
    try {
      await axios.post("/api/elections-vote", {
        userId: thisUser.id,
        candidateId,
        election: "Senate",
      });
      await refetch();
      await refetchCandidates();
      await refetchHasVoted();
      queryClient.invalidateQueries({ queryKey: ["candidates", "Senate"] });
      queryClient.invalidateQueries({
        queryKey: ["hasVoted", "Senate", thisUser.id],
      });
    } catch (error) {
      console.error("Error voting for candidate:", error);
    }
  };

  const isAlreadyCandidate =
    candidates &&
    Array.isArray(candidates) &&
    candidates.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (candidate: any) =>
        candidate.userId === thisUser?.id || candidate.user_id === thisUser?.id
    );

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
                  Polls open in <b>{electionInfo.days_left} days</b>.
                </p>
              ) : electionInfo.status === "Voting" ? (
                <p className="text-muted-foreground text-sm">
                  Election ends in <b>{electionInfo.days_left} days</b>.
                </p>
              ) : electionInfo.status === "Concluded" ? (
                <p className="text-muted-foreground text-sm">
                  You can stand as a candidate for the next election in{" "}
                  <b>{electionInfo.days_left} days</b>.
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
          {electionInfo && electionInfo.status == "Voting" && (
            <Alert className="mb-6">
              <AlertTitle className="font-bold">Elections are live!</AlertTitle>
              <AlertDescription>
                The Senate elections are now in the voting phase. Cast your vote
                for your preferred candidate before the elections close. There
                are {electionInfo.seats} seats available.
              </AlertDescription>
            </Alert>
          )}
          {electionInfo && electionInfo.status === "Candidate" && (
            <>
              {candidatesLoading ? (
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
                    <>
                      Stand as a candidate in the upcoming Senate elections and
                      become the voice of the people.
                      {!isAlreadyCandidate && !isACandidate && thisUser ? (
                        <Button
                          className="mt-4 md:mt-0"
                          onClick={standAsCandidate}
                        >
                          Declare Candidacy!
                        </Button>
                      ) : isAlreadyCandidate ? (
                        <Button
                          className="mt-4 md:mt-0"
                          onClick={revokeCandidacy}
                        >
                          Drop out
                        </Button>
                      ) : isACandidate && !isAlreadyCandidate ? (
                        <h2 className="mt-2 text-yellow-500 font-semibold">
                          You are a candidate in another election.
                        </h2>
                      ) : null}
                    </>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
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
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((candidate: any) => {
                        const userId = candidate.userId || candidate.user_id;
                        const votes = candidate.votes || 0;
                        return (
                          <ResultsItem
                            key={candidate.id}
                            userId={userId}
                            votes={votes}
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {candidates.map((candidate: any) => {
                    const userId = candidate.userId || candidate.user_id;
                    return (
                      <CandidateItem
                        key={candidate.id}
                        userId={userId}
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
