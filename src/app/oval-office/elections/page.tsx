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
import { fetchUserInfo } from "@/app/utils/userHelper";
import { getUserFullById } from "@/app/utils/userHelper";
import { Party } from "@/app/utils/partyHelper";
import { Chat } from "@/components/Chat";

function PresidentElections() {
  const [user] = useAuthState(auth);
  const queryClient = useQueryClient();

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
    queryKey: ["electionInfo", "President"],
    queryFn: () =>
      axios
        .get("/api/election-info", { params: { election: "President" } })
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
    queryKey: ["candidates", "President"],
    queryFn: () =>
      axios
        .get("/api/election-get-candidates", {
          params: { election: "President" },
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
    queryKey: ["hasVoted", "President", thisUser?.id],
    queryFn: () =>
      axios
        .post("/api/elections-has-voted", {
          userId: thisUser?.id,
          election: "President",
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
      queryFn: () => getUserFullById(Number(userId)),
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
            <h1>
              {candidateUser.username} |{" "}
              <span style={{ color: party.color }}>{party.name}</span>
            </h1>
          ) : (
            <p>
              {candidateUser.username} |{" "}
              <span className="text-muted-foreground">Independent</span>
            </p>
          )}
          {electionInfo.status === "Voting" && (
            <Button
              onClick={() => voteForCandidate(candidateId)}
              disabled={hasVoted}
            >
              {hasVoted
                ? "Already Voted"
                : `Vote for ${candidateUser.username}`}
            </Button>
          )}
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
      queryFn: () => getUserFullById(Number(userId)),
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

  const standAsCandidate = async () => {
    if (!thisUser) return;
    try {
      await axios.post("/api/election-stand-candidate", {
        userId: thisUser.id,
        election: "President",
      });
      await refetch();
      await refetchCandidates();
      queryClient.invalidateQueries({ queryKey: ["candidates", "President"] });
    } catch (error) {
      console.error("Error standing as candidate:", error);
    }
  };

  const voteForCandidate = async (candidateId: number) => {
    if (!thisUser) return;
    try {
      await axios.post("/api/elections-vote", {
        userId: thisUser.id,
        candidateId,
        election: "President",
      });
      await refetch();
      await refetchCandidates();
      await refetchHasVoted();
      queryClient.invalidateQueries({ queryKey: ["candidates", "President"] });
      queryClient.invalidateQueries({
        queryKey: ["hasVoted", "President", thisUser.id],
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
          <h1 className="text-3xl font-bold mb-4">Presidential Elections</h1>
          <p className="text-muted-foreground mb-6">
            Step into the political arena. Declare your candidacy, campaign for
            votes, and compete with other players to become the next President.
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
                The presidential elections are now in the voting phase. Cast
                your vote for your preferred candidate before the elections
                close.
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
                      !isAlreadyCandidate && !isACandidate
                        ? "md:flex md:items-center md:justify-between"
                        : ""
                    }
                  >
                    <>
                      Stand as a candidate in the upcoming presidential
                      elections. Rally support amongst players and become the
                      next President!
                      {!isAlreadyCandidate && !isACandidate && thisUser ? (
                        <Button
                          className="mt-4 md:mt-0"
                          onClick={standAsCandidate}
                        >
                          Declare Candidacy!
                        </Button>
                      ) : isAlreadyCandidate ? (
                        <h2 className="mt-2 text-green-500 font-semibold">
                          You are currently a candidate in the upcoming Senate
                          elections. Good luck!
                        </h2>
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
                The presidential elections have concluded. Here are the final
                results.
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              room="presidential-election"
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
    </div>
  );
}

export default withAuth(PresidentElections);
