import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Crown, Users, Vote, Trophy, AlertCircle } from "lucide-react";
import {
  getPrimariesData,
  declarePrimaryCandidate,
  withdrawPrimaryCandidate,
  voteInPrimary,
} from "@/lib/server/primaries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageDialog } from "@/components/message-dialog";
import PartyLogo from "@/components/party-logo";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/parties/primaries")({
  loader: async () => {
    const data = await getPrimariesData();
    return data;
  },
  gcTime: 0,
  component: PrimariesPage,
});

function PrimariesPage() {
  const data = Route.useLoaderData();
  const router = useRouter();

  const [showDeclareDialog, setShowDeclareDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null,
  );
  const [endorseCandidateId, setEndorseCandidateId] = useState<number | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    electionStatus,
    daysLeft,
    partyId,
    coalitionId: _coalitionId,
    candidates,
    hasVoted,
    votedCandidateId,
    isCandidate,
    userId,
    userRole,
    groupName,
    groupColor,
    isCoalitionPrimary,
  } = data;

  const isCandidatePhase = electionStatus === "Candidate";
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

  const handleDeclare = async () => {
    setIsSubmitting(true);
    try {
      await declarePrimaryCandidate();
      router.invalidate();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setIsSubmitting(true);
    try {
      await withdrawPrimaryCandidate({
        data: { endorseCandidateId: endorseCandidateId ?? undefined },
      });
      setShowWithdrawDialog(false);
      router.invalidate();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
      setEndorseCandidateId(null);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidateId) return;
    setIsSubmitting(true);
    try {
      await voteInPrimary({ data: { candidateId: selectedCandidateId } });
      router.invalidate();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
      setSelectedCandidateId(null);
    }
  };

  // Not in a party
  if (!partyId) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Join a Party to Participate
              </h2>
              <p className="text-muted-foreground mb-4">
                You must be a member of a political party to participate in
                presidential primaries.
              </p>
              <Button asChild>
                <Link to="/parties">Browse Parties</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  // Not candidate phase
  if (!isCandidatePhase) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Presidential Primaries
            </h1>
            <p className="text-muted-foreground">
              Primaries are not currently active.
            </p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Primaries Not Active
              </h2>
              <p className="text-muted-foreground mb-2">
                The presidential election is currently in the{" "}
                <Badge variant="outline">{electionStatus}</Badge> phase.
              </p>
              <p className="text-muted-foreground mb-4">
                Check back when the next election cycle begins.
              </p>
              <Button asChild variant="outline">
                <Link to="/elections/president">
                  View Presidential Election
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const canDeclare = isCandidatePhase && !isCandidate && userRole !== "Senator";

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Presidential Primaries
            </h1>
            <p className="text-muted-foreground">
              {isCoalitionPrimary
                ? `Coalition-wide primary for ${groupName}`
                : `Party primary for ${groupName}`}
            </p>
          </div>

          {/* Status Banner */}
          <Card
            className="border-l-4"
            style={{ borderLeftColor: groupColor ?? "#3b82f6" }}
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">
                    {isCoalitionPrimary ? "Coalition" : "Party"} Primary
                  </CardTitle>
                  <CardDescription>
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining in the
                    Candidate phase · {candidates.length} candidate
                    {candidates.length !== 1 ? "s" : ""} · {totalVotes} vote
                    {totalVotes !== 1 ? "s" : ""} cast
                  </CardDescription>
                </div>
                <Badge variant="default" className="text-sm px-3 py-1 w-fit">
                  Active
                </Badge>
              </div>
            </CardHeader>
          </Card>

          <Alert>
            <Vote className="h-4 w-4" />
            <AlertTitle>How Primaries Work</AlertTitle>
            <AlertDescription>
              During the primaries, party members can declare themselves as
              primary candidates.{" "}
              {isCoalitionPrimary
                ? "Since your party is in a coalition, all coalition members vote together. "
                : "All party members can vote for one candidate. "}
              When the primaries end and voting begins, the winner of each
              primary is automatically registered as the presidential candidate.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Candidates
                </CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{candidates.length}</div>
                <p className="text-xs text-muted-foreground">
                  Running in this primary
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Votes Cast
                </CardTitle>
                <Vote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalVotes}</div>
                <p className="text-xs text-muted-foreground">
                  Total votes so far
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Your Status
                </CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {isCandidate ? "Candidate" : hasVoted ? "Voted" : "Not Voted"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isCandidate
                    ? "You are running"
                    : hasVoted
                      ? "Your vote has been cast"
                      : "You can still vote"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {canDeclare && (
                <Button
                  onClick={() => setShowDeclareDialog(true)}
                  disabled={isSubmitting}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Declare Candidacy
                </Button>
              )}
              {isCandidate && (
                <Button
                  variant="destructive"
                  onClick={() => setShowWithdrawDialog(true)}
                  disabled={isSubmitting}
                >
                  Withdraw Candidacy
                </Button>
              )}
              {userRole === "Senator" && (
                <p className="text-sm text-muted-foreground self-center">
                  Senators cannot run for President.
                </p>
              )}
              <Button asChild variant="outline">
                <Link to="/elections/president">
                  View Presidential Election
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Candidates List */}
          <Card>
            <CardHeader>
              <CardTitle>Primary Candidates</CardTitle>
              <CardDescription>
                {candidates.length === 0
                  ? "No one has declared yet. Be the first!"
                  : `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""} running`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <div className="text-center py-8">
                  <Crown className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No candidates have declared yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.map((candidate, index) => {
                    const votePercent =
                      totalVotes > 0
                        ? Math.round((candidate.votes / totalVotes) * 100)
                        : 0;
                    const isLeading = index === 0 && candidate.votes > 0;
                    const isVotedFor = votedCandidateId === candidate.id;
                    const isSelf = candidate.userId === userId;

                    return (
                      <div
                        key={candidate.id}
                        className="p-4 border rounded-lg transition-colors hover:shadow"
                        style={{
                          borderLeftWidth: "4px",
                          borderLeftColor: candidate.partyColor,
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <PartyLogo party_id={candidate.partyId} size={40} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base truncate">
                                  {candidate.username}
                                </span>
                                {isLeading && (
                                  <Badge variant="default" className="text-xs">
                                    Leading
                                  </Badge>
                                )}
                                {isSelf && (
                                  <Badge variant="outline" className="text-xs">
                                    You
                                  </Badge>
                                )}
                                {isVotedFor && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Your Vote
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {candidate.partyName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Vote bar */}
                            <div className="hidden sm:flex flex-col items-end gap-1 min-w-[120px]">
                              <span className="text-sm font-medium">
                                {candidate.votes} vote
                                {candidate.votes !== 1 ? "s" : ""} (
                                {votePercent}%)
                              </span>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${votePercent}%`,
                                    backgroundColor: candidate.partyColor,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Vote button */}
                            {!hasVoted && isCandidatePhase && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedCandidateId(candidate.id);
                                  setShowVoteDialog(true);
                                }}
                              >
                                <Vote className="mr-1 h-4 w-4" />
                                Vote
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Mobile vote bar */}
                        <div className="sm:hidden mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>
                              {candidate.votes} vote
                              {candidate.votes !== 1 ? "s" : ""}
                            </span>
                            <span>{votePercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${votePercent}%`,
                                backgroundColor: candidate.partyColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialogs */}
        <MessageDialog
          open={showDeclareDialog}
          onOpenChange={setShowDeclareDialog}
          title="Declare Candidacy"
          description={`Are you sure you want to run in your ${isCoalitionPrimary ? "coalition" : "party"}'s presidential primary? If you win, you'll be automatically registered as a presidential candidate.`}
          confirmText="Declare"
          onConfirm={handleDeclare}
        />

        {/* Withdraw dialog with endorsement */}
        <Dialog
          open={showWithdrawDialog}
          onOpenChange={(open) => {
            setShowWithdrawDialog(open);
            if (!open) setEndorseCandidateId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Candidacy</DialogTitle>
              <DialogDescription>
                You can optionally endorse another candidate. Your votes will be
                transferred to them.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Endorse a candidate (optional)
              </label>
              <Select
                value={endorseCandidateId?.toString() ?? "none"}
                onValueChange={(v) =>
                  setEndorseCandidateId(v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No endorsement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No endorsement</SelectItem>
                  {candidates
                    .filter((c) => c.userId !== userId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.username} ({c.partyName})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {endorseCandidateId && (
                <p className="text-sm text-muted-foreground mt-2">
                  Your votes will be transferred to{" "}
                  <span className="font-medium">
                    {candidates.find((c) => c.id === endorseCandidateId)
                      ?.username ?? "the selected candidate"}
                  </span>
                  .
                </p>
              )}
              {!endorseCandidateId && (
                <p className="text-sm text-muted-foreground mt-2">
                  All votes cast for you will be discarded.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWithdrawDialog(false);
                  setEndorseCandidateId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleWithdraw}
                disabled={isSubmitting}
              >
                Withdraw
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <MessageDialog
          open={showVoteDialog}
          onOpenChange={setShowVoteDialog}
          title="Cast Your Vote"
          description={`Are you sure you want to vote for ${candidates.find((c) => c.id === selectedCandidateId)?.username ?? "this candidate"}? You cannot change your vote once cast.`}
          confirmText="Vote"
          onConfirm={handleVote}
        />
      </div>
    </ProtectedRoute>
  );
}
