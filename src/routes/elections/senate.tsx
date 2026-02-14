import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Candidate } from "@/lib/server/elections";
import { getCurrentUserInfo, getUserFullById } from "@/lib/server/users";
import { getPartyById } from "@/lib/server/party";
import {
  declareCandidate,
  electionPageData,
  revokeCandidate,
  donateToCandidate,
  getCampaignHistory,
} from "@/lib/server/elections";
import { toast } from "sonner";
import { useUserData } from "@/lib/hooks/use-user-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import GenericSkeleton from "@/components/generic-skeleton";
import { MessageDialog } from "@/components/message-dialog";
import PartyLogo from "@/components/party-logo";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Label,
  YAxis,
} from "recharts";
import { TrendingUp, DollarSign, Users, PieChartIcon } from "lucide-react";

export const Route = createFileRoute("/elections/senate")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const { candidates, ...pageData } = await electionPageData({
      data: { election: "Senate", userId: userData?.id },
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

    // Fetch campaign history for graphs
    const campaignHistory = await getCampaignHistory({
      data: { election: "Senate" },
    });

    return {
      userData,
      candidates: sortedCandidates,
      campaignHistory,
      ...pageData,
    };
  },
  component: RouteComponent,
});

// Component to display individual candidate details
function CandidateItem({
  candidate,
  electionStatus,
  currentUserId,
  currentUserMoney,
  rank,
  totalVotes,
  seatsAvailable,
}: {
  candidate: Candidate;
  electionStatus: string;
  currentUserId?: number;
  currentUserMoney?: number;
  rank?: number;
  totalVotes: number;
  seatsAvailable?: number;
}) {
  const router = useRouter();
  const [candidateUser, setCandidateUser] = useState<Awaited<
    ReturnType<typeof getUserFullById>
  > | null>(null);
  const [party, setParty] = useState<Awaited<
    ReturnType<typeof getPartyById>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [isDonating, setIsDonating] = useState(false);

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

  const handleDonate = async () => {
    if (!currentUserId || !donationAmount) return;
    const amount = parseInt(donationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid donation amount");
      return;
    }
    if (currentUserMoney && amount > currentUserMoney) {
      toast.error("Insufficient funds");
      return;
    }
    setIsDonating(true);
    try {
      await donateToCandidate({
        data: { candidateId: candidate.id, amount },
      });
      toast.success(
        `Donated $${amount} to ${candidateUser?.username}'s campaign!`,
      );
      setDonationAmount("");
      // Reload the page to update balances
      router.invalidate();
    } catch (error) {
      console.error("Error donating:", error);
      toast.error("Failed to donate. Please try again.");
    } finally {
      setIsDonating(false);
    }
  };

  const showVotingInfo =
    electionStatus === "Voting" || electionStatus === "Concluded";

  const votePercentage =
    totalVotes > 0 ? ((candidate.votes || 0) / totalVotes) * 100 : 0;
  const isElected =
    electionStatus === "Concluded" &&
    rank &&
    seatsAvailable &&
    rank <= seatsAvailable;

  return (
    <div
      className="group relative border-l-4 hover:bg-accent/50 transition-all duration-200 rounded-lg p-4 bg-card"
      style={{ borderLeftColor: party?.color || "#94a3b8" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {showVotingInfo && party && (
              <div
                className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden bg-card border-2"
                style={{ borderColor: party.color || "#94a3b8" }}
              >
                <PartyLogo party_id={party.id} size={40} />
              </div>
            )}
            {showVotingInfo && !party && (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground font-bold text-sm">
                IND
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-semibold">
                  {candidateUser.username}
                </h3>
                {isElected && (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    Elected
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {candidateUser.role}
                {party && (
                  <>
                    {" • "}
                    <span style={{ color: party.color || undefined }}>
                      {party.name}
                    </span>
                  </>
                )}
                {!party && " • Independent"}
              </p>
            </div>
          </div>

          {showVotingInfo && (
            <div className="flex gap-6 mt-3 ml-0 md:ml-13">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Votes</p>
                  <p className="font-bold text-lg">
                    {candidate.votes?.toLocaleString() ?? 0}
                    <span className="text-sm text-muted-foreground ml-2">
                      ({votePercentage.toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Campaign Funds
                  </p>
                  <p className="font-bold text-lg">
                    ${candidate.donations?.toLocaleString() ?? 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <Button asChild variant="outline">
            <Link
              to="/profile/$id"
              params={{ id: candidateUser.id.toString() }}
            >
              View Profile
            </Link>
          </Button>
        </div>
      </div>

      {electionStatus === "Voting" && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Donate to Campaign
              </span>
              <span className="text-sm font-semibold">
                ${donationAmount || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[parseInt(donationAmount) || 0]}
                onValueChange={(value) =>
                  setDonationAmount(value[0].toString())
                }
                max={currentUserMoney || 0}
                step={10}
                disabled={isDonating || !currentUserId}
                className="flex-1"
              />
              <Button
                onClick={handleDonate}
                disabled={
                  !donationAmount ||
                  isDonating ||
                  !currentUserId ||
                  parseInt(donationAmount) === 0
                }
                size="sm"
                className="min-w-[100px]"
              >
                {isDonating ? "Donating..." : "Donate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Component to display campaign graphs
function CampaignGraphs({
  campaignHistory,
  candidates,
}: {
  campaignHistory: Awaited<ReturnType<typeof getCampaignHistory>>;
  candidates: Candidate[];
}) {
  // Group snapshots by timestamp
  const timePoints = Array.from(
    new Set(
      campaignHistory.map((snapshot) =>
        snapshot.snapshotAt ? new Date(snapshot.snapshotAt).toISOString() : "",
      ),
    ),
  ).sort();

  // Create a color mapping for candidates based on their party color
  const candidateColors: Record<number, string> = {};
  candidates.forEach((candidate) => {
    candidateColors[candidate.id] = candidate.partyColor || "#94a3b8";
  });

  // Prepare votes data - carry forward last known values
  const lastKnownVotes: Record<string, number> = {};
  const votesData = timePoints.map((timePoint) => {
    const dataPoint: Record<string, any> = {
      time: new Date(timePoint).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    };

    candidates.forEach((candidate) => {
      const snapshot = campaignHistory.find(
        (s) =>
          s.candidateId === candidate.id &&
          s.snapshotAt &&
          new Date(s.snapshotAt).toISOString() === timePoint,
      );

      if (snapshot) {
        lastKnownVotes[candidate.username] = snapshot.votes || 0;
      }

      dataPoint[candidate.username] = lastKnownVotes[candidate.username] ?? 0;
    });

    return dataPoint;
  });

  // Prepare donations data - carry forward last known values
  const lastKnownDonations: Record<string, number> = {};
  const donationsData = timePoints.map((timePoint) => {
    const dataPoint: Record<string, any> = {
      time: new Date(timePoint).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    };

    candidates.forEach((candidate) => {
      const snapshot = campaignHistory.find(
        (s) =>
          s.candidateId === candidate.id &&
          s.snapshotAt &&
          new Date(s.snapshotAt).toISOString() === timePoint,
      );

      if (snapshot) {
        lastKnownDonations[candidate.username] = snapshot.donations || 0;
      }

      dataPoint[candidate.username] =
        lastKnownDonations[candidate.username] ?? 0;
    });

    return dataPoint;
  });

  if (votesData.length === 0 || donationsData.length === 0) {
    return (
      <Alert className="mb-6">
        <AlertTitle>No campaign data available yet</AlertTitle>
        <AlertDescription>
          Campaign tracking data will be available once hourly snapshots are
          taken.
        </AlertDescription>
      </Alert>
    );
  }

  // Prepare pie chart data
  const totalVotes = candidates.reduce(
    (sum, candidate) => sum + (candidate.votes || 0),
    0,
  );
  const pieData = candidates
    .filter((c) => (c.votes || 0) > 0)
    .map((candidate) => ({
      name: candidate.username,
      value: candidate.votes || 0,
      color: candidateColors[candidate.id],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="mb-8">
      <Tabs defaultValue="votes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="votes">
            <TrendingUp className="w-4 h-4 mr-2" />
            Votes Over Time
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <PieChartIcon className="w-4 h-4 mr-2" />
            Vote Distribution
          </TabsTrigger>
          <TabsTrigger value="funds">
            <DollarSign className="w-4 h-4 mr-2" />
            Campaign Funds
          </TabsTrigger>
        </TabsList>

        {/* Votes Graph */}
        <TabsContent value="votes" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={votesData}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.35)]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                    formatter={(value: any, name: string) => [
                      `${Number(value).toLocaleString()} votes`,
                      name,
                    ]}
                    labelFormatter={() => ""}
                  />
                  {candidates.map((candidate) => (
                    <Line
                      key={candidate.id}
                      type="natural"
                      dataKey={candidate.username}
                      stroke={candidateColors[candidate.id]}
                      strokeWidth={3}
                      strokeLinecap="round"
                      dot={false}
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Votes Distribution Pie Chart */}
        <TabsContent value="distribution" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="none"
                      />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-3xl font-bold"
                              >
                                {totalVotes.toLocaleString()}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 24}
                                className="fill-muted-foreground text-sm"
                              >
                                Total Votes
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3">
                            <p className="font-semibold">{payload[0].name}</p>
                            <p className="text-sm text-muted-foreground">
                              {Number(payload[0].value).toLocaleString()} votes
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Donations Graph */}
        <TabsContent value="funds" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={donationsData}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.35)]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                    formatter={(value: any, name: string) => [
                      `$${Number(value).toLocaleString()}`,
                      name,
                    ]}
                    labelFormatter={() => ""}
                  />
                  {candidates.map((candidate) => (
                    <Line
                      key={candidate.id}
                      type="natural"
                      dataKey={candidate.username}
                      stroke={candidateColors[candidate.id]}
                      strokeWidth={3}
                      strokeLinecap="round"
                      dot={false}
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RouteComponent() {
  const router = useRouter();
  const {
    electionInfo,
    candidates,
    isCandidateInAny,
    userData: loaderUserData,
    campaignHistory,
  } = Route.useLoaderData();
  const userData = useUserData(loaderUserData);

  const [showCandidacyDialog, setShowCandidacyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localCandidates, setLocalCandidates] = useState<Array<Candidate>>(
    candidates || [],
  );

  const isAlreadyCandidate =
    localCandidates &&
    localCandidates.some((candidate) => candidate.userId === userData?.id);

  const isACandidate = isCandidateInAny?.isCandidate || false;

  const handleCandidacyConfirm = async () => {
    if (!userData) return;
    setIsSubmitting(true);
    try {
      const newCandidate = await declareCandidate({
        data: { election: "Senate" },
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
        data: { election: "Senate" },
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

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-4">Senate Elections</h1>
            <p className="text-muted-foreground mb-6">
              Participate in the democratic process by standing as a candidate
              or donating to campaigns in the Senate elections.
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
              <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
                <AlertTitle className="font-bold text-blue-600 dark:text-blue-400">
                  Elections are live!
                </AlertTitle>
                <AlertDescription>
                  The Senate elections are now in the voting phase. Support your
                  preferred candidates by donating to their campaigns before the
                  elections close. There are {electionInfo.seats} seats
                  available.
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
                    Stand as a candidate in the upcoming Senate elections and
                    become the voice of the people.
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
                  The Senate elections have concluded. Here are the final
                  results. The top{" "}
                  {electionInfo.seats && electionInfo.seats > 1
                    ? electionInfo.seats
                    : 1}{" "}
                  candidates have been elected to the Senate.
                </AlertDescription>
              </Alert>
            )}

            {/* Election Results */}
            {(electionInfo.status === "Concluded" ||
              electionInfo.status === "Voting") && (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">
                    {electionInfo.status === "Concluded"
                      ? "Election Results"
                      : "Current Results"}
                  </h2>

                  {/* Campaign Graphs */}
                  {localCandidates && localCandidates.length > 0 && (
                    <CampaignGraphs
                      campaignHistory={campaignHistory}
                      candidates={localCandidates}
                    />
                  )}

                  {/* Statistics */}
                  {localCandidates && localCandidates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Total Candidates
                              </p>
                              <p className="text-3xl font-bold">
                                {localCandidates.length}
                              </p>
                            </div>
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Total Votes Cast
                              </p>
                              <p className="text-3xl font-bold">
                                {localCandidates
                                  .reduce((sum, c) => sum + (c.votes || 0), 0)
                                  .toLocaleString()}
                              </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Seats Available
                              </p>
                              <p className="text-3xl font-bold">
                                {electionInfo.seats}
                              </p>
                            </div>
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Candidates List */}
                  {localCandidates && localCandidates.length > 0 ? (
                    <div className="space-y-3">
                      {[...localCandidates]
                        .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                        .map((candidate, index) => {
                          const totalVotes = localCandidates.reduce(
                            (sum, c) => sum + (c.votes || 0),
                            0,
                          );
                          return (
                            <CandidateItem
                              key={candidate.id}
                              candidate={candidate}
                              electionStatus={electionInfo.status}
                              currentUserId={userData?.id}
                              currentUserMoney={
                                userData?.money ? Number(userData.money) : 0
                              }
                              rank={index + 1}
                              totalVotes={totalVotes}
                              seatsAvailable={electionInfo.seats ?? 1}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No candidates yet.</p>
                  )}
                </div>
              </>
            )}

            {/* Candidates List */}
            {electionInfo && electionInfo.status === "Candidate" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Candidates</h2>
                <p className="text-muted-foreground mb-4">
                  Sorted alphabetically by name and grouped by party.
                </p>
                {localCandidates && localCandidates.length > 0 ? (
                  <div className="space-y-2">
                    {localCandidates.map((candidate) => (
                      <CandidateItem
                        key={candidate.id}
                        candidate={candidate}
                        electionStatus={electionInfo.status}
                        currentUserId={userData?.id}
                        currentUserMoney={
                          userData?.money ? Number(userData.money) : 0
                        }
                        rank={0}
                        totalVotes={0}
                        seatsAvailable={electionInfo.seats ?? 1}
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
    </ProtectedRoute>
  );
}
