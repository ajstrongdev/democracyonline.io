import { useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertCircle, Crown, Trophy, Users, Vote } from "lucide-react";
import {
  declarePrimaryCandidate,
  getPrimariesData,
  voteInPrimary,
  withdrawPrimaryCandidate,
} from "@/lib/server/primaries";
import {
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/dashboard/parties/primaries")({
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
        <WikiPage>
          <WikiHeader
            eyebrow="Presidential election"
            title="Presidential primaries"
            description="Party members select their nominee for the presidential election."
          />
          <Card className="rounded-sm shadow-none">
            <CardContent className="py-12 text-center sm:py-16">
              <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="mb-2 font-serif text-2xl font-semibold">
                Join a Party to Participate
              </h2>
              <p className="mx-auto mb-5 max-w-xl text-sm text-muted-foreground">
                You must be a member of a political party to participate in
                presidential primaries.
              </p>
              <Button asChild>
                <Link to="/dashboard/parties">Browse Parties</Link>
              </Button>
            </CardContent>
          </Card>
        </WikiPage>
      </ProtectedRoute>
    );
  }

  // Not candidate phase
  if (!isCandidatePhase) {
    return (
      <ProtectedRoute>
        <WikiPage>
          <WikiHeader
            eyebrow="Presidential election"
            title="Presidential primaries"
            description="The primary archive opens during the candidate phase of each presidential election."
            status={<Badge variant="secondary">{electionStatus}</Badge>}
          />
          <Card className="rounded-sm shadow-none">
            <CardContent className="py-12 text-center sm:py-16">
              <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="mb-2 font-serif text-2xl font-semibold">
                Primaries Not Active
              </h2>
              <p className="mb-2 text-sm text-muted-foreground">
                The presidential election is currently in the{" "}
                <Badge variant="outline">{electionStatus}</Badge> phase.
              </p>
              <p className="mb-5 text-sm text-muted-foreground">
                Check back when the next election cycle begins.
              </p>
              <Button asChild variant="outline">
                <Link to="/dashboard/elections">View Elections</Link>
              </Button>
            </CardContent>
          </Card>
        </WikiPage>
      </ProtectedRoute>
    );
  }

  const canDeclare = isCandidatePhase && !isCandidate && userRole !== "Senator";

  return (
    <ProtectedRoute>
      <WikiPage>
        <WikiHeader
          eyebrow={`${isCoalitionPrimary ? "Coalition" : "Party"} primary · Candidate phase`}
          title="Presidential primaries"
          description={
            isCoalitionPrimary
              ? `Coalition-wide nomination record for ${groupName}.`
              : `Party nomination record for ${groupName}.`
          }
          status={<Badge>Active</Badge>}
        />

        <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/parties">Party archive</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/elections">Election archive</Link>
          </Button>
        </nav>

        <Card
          className="overflow-hidden rounded-sm border-t-4 shadow-none"
          style={{ borderTopColor: groupColor ?? "#3b82f6" }}
        >
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <CardTitle className="font-serif text-2xl">
                {groupName} {isCoalitionPrimary ? "coalition" : "party"} primary
              </CardTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert className="rounded-sm shadow-none">
              <Vote className="h-4 w-4" />
              <AlertTitle>How Primaries Work</AlertTitle>
              <AlertDescription>
                During the primaries, party members can declare themselves as
                primary candidates.{" "}
                {isCoalitionPrimary
                  ? "Since your party is in a coalition, all coalition members vote together. "
                  : "All party members can vote for one candidate. "}
                When the primaries end and voting begins, the winner of each
                primary is automatically registered as the presidential
                candidate.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <WikiStatGrid>
          <WikiStat
            label="Candidates"
            value={candidates.length}
            detail="Running in this primary"
          />
          <WikiStat
            label="Votes cast"
            value={totalVotes}
            detail="Total votes recorded"
          />
          <WikiStat
            label="Your status"
            value={isCandidate ? "Candidate" : hasVoted ? "Voted" : "Not voted"}
            detail={
              isCandidate
                ? "You are running"
                : hasVoted
                  ? "Your vote has been cast"
                  : "You can still vote"
            }
          />
        </WikiStatGrid>

        <WikiSection title="Primary actions" icon={Trophy}>
          <div className="flex flex-col gap-3 border-y bg-card px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center">
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
              <p className="self-center text-sm text-muted-foreground">
                Senators cannot run for President.
              </p>
            )}
            <Button asChild variant="outline">
              <Link to="/dashboard/elections">View Elections</Link>
            </Button>
          </div>
        </WikiSection>

        <WikiSection
          title="Primary candidates"
          icon={Crown}
          description={
            candidates.length === 0
              ? "No one has declared yet. Be the first."
              : `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""} in the nomination record.`
          }
          aside={
            <span className="font-mono text-xs text-muted-foreground">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </span>
          }
        >
          {candidates.length === 0 ? (
            <div className="border border-dashed px-5 py-10 text-center">
              <Crown className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No candidates have declared yet.
              </p>
            </div>
          ) : (
            <div className="divide-y border-y bg-card">
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
                    className="grid gap-4 border-l-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] sm:items-center sm:px-5"
                    style={{ borderLeftColor: candidate.partyColor }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <PartyLogo party_id={candidate.partyId} size={40} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/dashboard/players/$playerId"
                            params={{ playerId: String(candidate.userId) }}
                            className="truncate font-serif text-lg font-semibold hover:text-primary"
                          >
                            {candidate.username}
                          </Link>
                          {isLeading && (
                            <Badge className="text-xs">Leading</Badge>
                          )}
                          {isSelf && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                          {isVotedFor && (
                            <Badge variant="secondary" className="text-xs">
                              Your Vote
                            </Badge>
                          )}
                        </div>
                        <Link
                          to="/dashboard/parties/$partyId"
                          params={{ partyId: String(candidate.partyId) }}
                          className="text-sm text-muted-foreground hover:text-primary"
                        >
                          {candidate.partyName}
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between gap-3 font-mono text-xs text-muted-foreground">
                        <span>
                          {candidate.votes} vote
                          {candidate.votes !== 1 ? "s" : ""}
                        </span>
                        <span>{votePercent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${votePercent}%`,
                            backgroundColor: candidate.partyColor,
                          }}
                        />
                      </div>
                    </div>

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
                );
              })}
            </div>
          )}
        </WikiSection>

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
      </WikiPage>
    </ProtectedRoute>
  );
}
