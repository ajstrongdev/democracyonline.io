import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getCurrentUserInfo, getUserFullById } from "@/lib/server/users";
import { getPartyById } from "@/lib/server/party";
import {
  electionPageData,
  declareCandidate,
  revokeCandidate,
  voteForCandidate,
  getUserVotingStatus,
  type Candidate,
  type VotingStatus,
} from "@/lib/server/elections";
import { useUserData } from "@/lib/hooks/use-user-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import GenericSkeleton from "@/components/generic-skeleton";
import { MessageDialog } from "@/components/message-dialog";
import { CandidatesChart } from "@/components/candidates-chart";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/elections/president")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const { candidates, ...pageData } = await electionPageData({
      data: { election: "President", userId: userData?.id },
    });
    const sortedCandidates = [...candidates].sort((a, b) => {
      // Group by party (nulls/Independent last), then sort alphabetically by username
      const partyA = a.partyName || "";
      const partyB = b.partyName || "";
      if (partyA !== partyB) {
        if (!a.partyName) return 1;
        if (!b.partyName) return -1;
        return partyA.localeCompare(partyB);
      }
      return a.username.localeCompare(b.username);
    });
    return { userData, candidates: sortedCandidates, ...pageData };
  },
  component: RouteComponent,
});

// Component to display individual candidate details
function CandidateItem({
  candidate,
  electionStatus,
  votesRemaining,
  votedCandidateIds,
  onVote,
  isVoting,
}: {
  candidate: Candidate;
  electionStatus: string;
  votesRemaining: number;
  votedCandidateIds: number[];
  onVote: (candidateId: number) => void;
  isVoting: boolean;
}) {
  const [candidateUser, setCandidateUser] = useState<Awaited<
    ReturnType<typeof getUserFullById>
  > | null>(null);
  const [party, setParty] = useState<Awaited<
    ReturnType<typeof getPartyById>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (candidate.userId) {
        try {
          const user = await getUserFullById({
            data: { userId: candidate.userId, checkActive: false },
          });
          setCandidateUser(user);

          if (user?.partyId) {
            const partyData = await getPartyById({
              data: { partyId: user.partyId },
            });
            setParty(partyData);
          }
        } catch (error) {
          console.error("Error loading candidate data:", error);
        }
      }
      setIsLoading(false);
    };
    loadData();
  }, [candidate.userId]);

  if (isLoading) {
    return <GenericSkeleton />;
  }

  if (!candidateUser) {
    return <div className="p-2">Unknown candidate</div>;
  }

  const hasVotedForThis = votedCandidateIds.includes(candidate.id);
  const canVote = votesRemaining > 0 && !hasVotedForThis;

  return (
    <Card className="py-4 my-4">
      <CardContent className="md:flex md:items-center md:justify-between">
        {party ? (
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
                style={party ? { color: party.color || undefined } : {}}
              >
                <span className="text-muted-foreground">Party:</span>{" "}
                {party ? party.name : "Independent"}
              </p>
            </div>
          </>
        ) : (
          <div>
            <h1 className="text-xl font-semibold">{candidateUser.username}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Party: Independent
            </p>
          </div>
        )}
        <div className="mt-4 md:mt-0 flex items-center">
          <Button asChild>
            <Link
              to="/profile/$id"
              params={{ id: candidateUser.id.toString() }}
            >
              View Profile
            </Link>
          </Button>
          {electionStatus === "Voting" && (
            <Button
              onClick={() => onVote(candidate.id)}
              disabled={!canVote || isVoting}
              className="ml-4"
            >
              {hasVotedForThis
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
}

// Component to display results item
function ResultsItem({ candidate }: { candidate: Candidate }) {
  const [candidateUser, setCandidateUser] = useState<Awaited<
    ReturnType<typeof getUserFullById>
  > | null>(null);
  const [party, setParty] = useState<Awaited<
    ReturnType<typeof getPartyById>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (candidate.userId) {
        try {
          const user = await getUserFullById({
            data: { userId: candidate.userId, checkActive: false },
          });
          setCandidateUser(user);

          if (user?.partyId) {
            const partyData = await getPartyById({
              data: { partyId: user.partyId },
            });
            setParty(partyData);
          }
        } catch (error) {
          console.error("Error loading candidate data:", error);
        }
      }
      setIsLoading(false);
    };
    loadData();
  }, [candidate.userId]);

  if (isLoading) {
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
          style={{ color: party?.color || undefined }}
        >
          {party?.name || "Independent"}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary">
          {candidate.votes ?? 0}
        </p>
        <p className="text-sm text-muted-foreground">votes</p>
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const router = useRouter();
  const {
    electionInfo,
    candidates,
    votingStatus: initialVotingStatus,
    isCandidateInAny,
    userData: loaderUserData,
  } = Route.useLoaderData();
  const userData = useUserData(loaderUserData);

  const [showCandidacyDialog, setShowCandidacyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingStatus, setVotingStatus] = useState<VotingStatus | null>(
    initialVotingStatus,
  );
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>(
    candidates || [],
  );

  const votesRemaining = votingStatus?.votesRemaining || 0;
  const maxVotes = votingStatus?.maxVotes || 0;
  const votedCandidateIds = votingStatus?.votedCandidateIds || [];

  const isAlreadyCandidate =
    localCandidates &&
    localCandidates.some((candidate) => candidate.userId === userData?.id);

  const isACandidate = isCandidateInAny?.isCandidate || false;

  const handleCandidacyConfirm = async () => {
    if (!userData) return;
    setIsSubmitting(true);
    try {
      const newCandidate = await declareCandidate({
        data: { userId: userData.id, election: "President" },
      });
      setLocalCandidates((prev) => [
        ...prev,
        {
          ...newCandidate,
          username: userData.username,
          partyName: null,
          partyColor: null,
        },
      ]);
      router.invalidate();
    } catch (error) {
      console.error("Error standing as candidate:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeCandidacy = async () => {
    if (!userData) return;
    setIsSubmitting(true);
    try {
      await revokeCandidate({
        data: { userId: userData.id, election: "President" },
      });
      setLocalCandidates((prev) =>
        prev.filter((c) => c.userId !== userData.id),
      );
      router.invalidate();
    } catch (error) {
      console.error("Error revoking candidacy:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const standAsCandidate = () => {
    setShowCandidacyDialog(true);
  };

  const handleVoteForCandidate = async (candidateId: number) => {
    if (!userData) return;
    setIsSubmitting(true);
    try {
      await voteForCandidate({
        data: { userId: userData.id, candidateId, election: "President" },
      });

      // Update local candidate votes
      setLocalCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, votes: (c.votes || 0) + 1 } : c,
        ),
      );

      // Refresh voting status
      const newVotingStatus = await getUserVotingStatus({
        data: { userId: userData.id, election: "President" },
      });
      setVotingStatus(newVotingStatus);

      router.invalidate();
    } catch (error) {
      console.error("Error voting for candidate:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-4">Presidential Elections</h1>
            <p className="text-muted-foreground mb-6">
              Participate in the democratic process by standing as a candidate
              or voting in the Presidential elections.
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

        {!electionInfo ? (
          <Alert className="mb-6 bg-card">
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
            {/* Voting Phase Alert */}
            {electionInfo.status === "Voting" && (
              <Alert className="mb-6 bg-card">
                <AlertTitle className="font-bold">
                  Elections are live!
                </AlertTitle>
                <AlertDescription>
                  The Presidential elections are now in the voting phase. Cast
                  your vote for your preferred candidate before the elections
                  close.
                  {votingStatus && (
                    <span className="block mt-2 font-semibold">
                      You have {votesRemaining} of {maxVotes} vote
                      {maxVotes !== 1 ? "s" : ""} remaining.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Candidacy Phase */}
            {electionInfo.status === "Candidate" && (
              <Alert className="mb-6 bg-card">
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
                    Stand as a candidate in the upcoming Presidential elections
                    and lead the nation.
                    {!isAlreadyCandidate && !isACandidate && userData ? (
                      <Button
                        className="mt-4 md:mt-0"
                        onClick={standAsCandidate}
                        disabled={isSubmitting}
                      >
                        Declare Candidacy!
                      </Button>
                    ) : isAlreadyCandidate ? (
                      <Button
                        className="mt-4 md:mt-0"
                        onClick={handleRevokeCandidacy}
                        disabled={isSubmitting}
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

            {/* Concluded Phase */}
            {electionInfo.status === "Concluded" && (
              <Alert className="mb-6 bg-card">
                <AlertTitle className="font-bold">
                  Elections concluded
                </AlertTitle>
                <AlertDescription>
                  The Presidential elections have concluded. Here are the final
                  results. The winning candidate has been elected as President.
                </AlertDescription>
              </Alert>
            )}

            {/* Election Results */}
            {(electionInfo.status === "Concluded" ||
              electionInfo.status === "Voting") && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                  {electionInfo.status === "Concluded"
                    ? "Election Results"
                    : "Current Results"}
                </h2>
                {localCandidates && localCandidates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                    <CandidatesChart
                      candidates={localCandidates.map((c) => ({
                        id: c.id,
                        username: c.username,
                        votes: c.votes,
                        partyName: c.partyName,
                        partyColor: c.partyColor,
                      }))}
                    />
                    {[...localCandidates]
                      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                      .map((candidate) => (
                        <ResultsItem key={candidate.id} candidate={candidate} />
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No candidates yet.</p>
                )}
              </div>
            )}

            {/* Candidates List */}
            {electionInfo && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Candidates</h2>
                <p className="text-muted-foreground">
                  Sorted alphabetically by name and grouped by party.
                </p>
                {localCandidates && localCandidates.length > 0 ? (
                  <div className="space-y-2">
                    {localCandidates.map((candidate) => (
                      <CandidateItem
                        key={candidate.id}
                        candidate={candidate}
                        electionStatus={electionInfo.status}
                        votesRemaining={votesRemaining}
                        votedCandidateIds={votedCandidateIds}
                        onVote={handleVoteForCandidate}
                        isVoting={isSubmitting}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}

        {/* Candidacy Confirmation Dialog */}
        <MessageDialog
          open={showCandidacyDialog}
          onOpenChange={setShowCandidacyDialog}
          title="Important Election Rule"
          description={
            <span className="text-left leading-relaxed">
              <span className="block">
                <span className="font-semibold">Warning:</span> If you declare
                your candidacy for the presidential election, you{" "}
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
    </ProtectedRoute>
  );
}
