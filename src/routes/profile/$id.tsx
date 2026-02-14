import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Crown,
  Edit,
  Handshake,
  History,
  UserCircle,
  XCircle,
  Building2,
  DollarSign,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  getCurrentUserInfo,
  getUserFullById,
  getUserVotingHistory,
} from "@/lib/server/users";
import { getPartyById } from "@/lib/server/party";
import {
  getUserCEOCompanies,
  getUserDividendCompanies,
} from "@/lib/server/stocks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PartyLogo from "@/components/party-logo";
import { getLastSeenText } from "@/lib/constants";
import { useUserData } from "@/lib/hooks/use-user-data";
import ProtectedRoute from "@/components/auth/protected-route";

export const Route = createFileRoute("/profile/$id")({
  loader: async ({ params }) => {
    // Get current user's DB info
    const currentUserData = await getCurrentUserInfo();

    const currentUser = Array.isArray(currentUserData)
      ? currentUserData[0]
      : currentUserData;

    // Get target user
    const targetUserId = parseInt(params.id);
    if (isNaN(targetUserId)) {
      throw new Error("Invalid user ID");
    }

    let targetUser;
    try {
      targetUser = await getUserFullById({
        data: { userId: targetUserId, checkActive: false },
      });
    } catch (error) {
      return {
        targetUser: null,
        party: null,
        allVotes: [],
        currentUser,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load user profile",
      };
    }

    // Get party if user has one
    let party = null;
    if (targetUser.partyId) {
      party = await getPartyById({ data: { partyId: targetUser.partyId } });
    }

    // Get voting history
    const allVotes = await getUserVotingHistory({
      data: { userId: targetUserId },
    });

    // Get CEO companies
    const ceoCompanies = await getUserCEOCompanies({
      data: { userId: targetUserId },
    });

    // Get dividend companies (all shares held)
    const dividendCompanies = await getUserDividendCompanies({
      data: { userId: targetUserId },
    });

    return {
      targetUser,
      party,
      allVotes,
      ceoCompanies,
      dividendCompanies,
      currentUser,
      error: null,
    };
  },
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const {
    targetUser,
    party,
    allVotes = [],
    dividendCompanies = [],
    currentUser: currentUserLoaderData,
    error,
  } = Route.useLoaderData();

  // Hack: Load currentUser client-side for direct nav.
  const currentUser = useUserData(currentUserLoaderData);

  // State for pagination
  const [displayedVotes, setDisplayedVotes] = useState(allVotes.slice(0, 10));
  const [currentOffset, setCurrentOffset] = useState(10);
  const hasMoreVotes = currentOffset < allVotes.length;

  if (error || !targetUser) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-8 max-w-4xl">
          <Card className="p-6">
            <CardHeader>
              <CardTitle>Profile Not Available</CardTitle>
              <CardDescription>
                {error || "This user profile could not be found."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate({ to: "/" })}>Go Home</Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const isOwnProfile = currentUser?.id === targetUser.id;

  const loadMoreVotes = () => {
    const nextBatch = allVotes.slice(currentOffset, currentOffset + 10);
    setDisplayedVotes([...displayedVotes, ...nextBatch]);
    setCurrentOffset(currentOffset + 10);
  };

  const withSoftHyphens = (text: string): string => {
    return Array.from(text).join("\u00AD");
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: party?.color
                  ? `${party.color}20`
                  : "hsl(var(--primary) / 0.1)",
              }}
            >
              {party ? (
                <PartyLogo party_id={party.id} size={32} />
              ) : (
                <UserCircle className="w-8 h-8 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {withSoftHyphens(targetUser.username)}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{targetUser.role || "Representative"}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm">
                    {getLastSeenText(targetUser.lastActivity)}
                  </span>
                </div>
                {party && targetUser.id === party.leaderId && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                      <Crown className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">Party Leader</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {isOwnProfile && (
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        {targetUser.lastActivity !== null && targetUser.lastActivity > 14 && (
          <div className="mb-6 px-4 py-3 rounded-lg border-l-4 border-red-500 bg-red-500/10 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                This user is currently inactive
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                About This User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Political Leaning
                </p>
                <p className="text-base font-semibold">
                  {targetUser.politicalLeaning || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Bio
                </p>
                <p className="text-base whitespace-pre-wrap leading-relaxed">
                  {targetUser.bio || "No bio provided."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="w-5 h-5" />
                Party Affiliation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {party ? (
                <>
                  <div className="flex items-start gap-4 p-4 rounded-lg border-2 bg-muted/30">
                    <PartyLogo party_id={party.id} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-xl truncate">
                          {party.name}
                        </p>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium shrink-0">
                          <Users className="w-3 h-3" />
                          <span>Member</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {party.leaning || "Not specified"}
                      </p>
                    </div>
                  </div>
                  {party.bio && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Party Description
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {party.bio}
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigate({
                        to: "/parties/$id",
                        params: { id: String(party.id) },
                      })
                    }
                  >
                    View Party Page
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <Handshake className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground font-medium">
                    Independent
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Not affiliated with any party
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="companies" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Portfolio{" "}
              {dividendCompanies.length > 0 && `(${dividendCompanies.length})`}
            </TabsTrigger>
            <TabsTrigger value="votes" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Voting History {allVotes.length > 0 && `(${allVotes.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle>Investment Portfolio</CardTitle>
                </div>
                <CardDescription>
                  {dividendCompanies.length > 0
                    ? `${targetUser.username} holds shares in ${dividendCompanies.length} compan${dividendCompanies.length === 1 ? "y" : "ies"}`
                    : "No shares held"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dividendCompanies.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground font-medium">
                      No shares held
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 p-6 rounded-lg bg-linear-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/20">
                      <h3 className="text-sm font-medium text-muted-foreground mb-4">
                        Total Dividends from All Holdings
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Per Hour
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              $
                              {dividendCompanies
                                .reduce((sum, c) => sum + c.hourlyDividend, 0)
                                .toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Per Day
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              $
                              {dividendCompanies
                                .reduce((sum, c) => sum + c.dailyDividend, 0)
                                .toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {dividendCompanies.map((company) => (
                        <Link
                          key={company.id}
                          to="/companies/$id"
                          params={{ id: String(company.id) }}
                          className="block"
                        >
                          <div className="p-4 rounded-lg border-2 hover:bg-accent/50 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-lg truncate">
                                    {company.name}
                                  </h3>
                                  <span className="text-xs px-2 py-1 bg-muted rounded font-mono font-medium">
                                    {company.symbol}
                                  </span>
                                  {company.isCEO && (
                                    <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full font-medium flex items-center gap-1">
                                      <Crown className="w-3 h-3" />
                                      CEO
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground font-medium">
                                      Shares
                                    </span>
                                    <p className="font-bold">
                                      {company.sharesOwned.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-medium">
                                      Ownership
                                    </span>
                                    <p className="font-bold">
                                      {(company.ownershipPct * 100).toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-medium">
                                      Share Price
                                    </span>
                                    <p className="font-bold">
                                      $
                                      {company.stockPrice?.toLocaleString() ||
                                        "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-medium">
                                      Market Cap
                                    </span>
                                    <p className="font-bold">
                                      ${company.marketCap.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="pt-3 border-t grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Hourly Dividend
                                  </p>
                                  <p className="font-bold text-green-600 dark:text-green-400">
                                    ${company.hourlyDividend.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Daily Dividend
                                  </p>
                                  <p className="font-bold text-green-600 dark:text-green-400">
                                    ${company.dailyDividend.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="votes">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <CardTitle>Voting History</CardTitle>
                </div>
                <CardDescription>
                  {allVotes.length > 0
                    ? `${allVotes.length} vote${allVotes.length === 1 ? "" : "s"} cast`
                    : "No votes yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allVotes.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground font-medium">
                      No voting history available
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Votes will appear here once cast
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedVotes.map((vote) => (
                      <div
                        key={vote.id}
                        className="p-4 border-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <Link
                              to="/bills/$id"
                              params={{ id: String(vote.billId) }}
                              className="hover:underline"
                            >
                              <h3 className="text-lg font-bold mb-2">
                                Bill #{vote.billId}: {vote.billTitle}
                              </h3>
                            </Link>
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <span
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                                  vote.voteYes
                                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                                }`}
                              >
                                {vote.voteYes ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                                Voted {vote.voteYes ? "For" : "Against"}
                              </span>
                              <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium capitalize">
                                {vote.stage}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Status:{" "}
                              <span className="font-medium">
                                {vote.billStatus}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            asChild
                          >
                            <Link
                              to="/bills/$id"
                              params={{ id: String(vote.billId) }}
                            >
                              View Bill
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {hasMoreVotes && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={loadMoreVotes}
                      >
                        Load More
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
