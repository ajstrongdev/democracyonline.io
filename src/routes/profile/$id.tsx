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
} from "lucide-react";
import { useState } from "react";
import {
  getCurrentUserInfo,
  getUserFullById,
  getUserVotingHistory,
} from "@/lib/server/users";
import { getPartyById } from "@/lib/server/party";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

    return {
      targetUser,
      party,
      allVotes,
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
  const partyColor = party?.color || "#6b7280";

  const loadMoreVotes = () => {
    const nextBatch = allVotes.slice(currentOffset, currentOffset + 10);
    setDisplayedVotes([...displayedVotes, ...nextBatch]);
    setCurrentOffset(currentOffset + 10);
  };
  
  const withSoftHyphens = (text: string): string => {
    return Array.from(text).join('\u00AD');
  }

  return (
    <ProtectedRoute>
      <div className="p-8 space-y-6">
        <Card
          className="relative overflow-hidden border-0 border-t-[6px] sm:border-t-0 sm:border-l-[6px]"
          style={{ borderColor: partyColor }}
        >
          <CardHeader className="sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start sm:gap-4 w-full sm:w-auto">
                {party ? (
                  <PartyLogo party_id={party.id} size={64} />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
                    I
                  </div>
                )}
                <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                  <CardTitle className="text-3xl mb-2 text-center sm:text-left">
                    {withSoftHyphens(targetUser.username)}'s Profile
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-center gap-3 text-sm w-full">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium w-full sm:w-auto text-center">
                      {targetUser.role || "Representative"}
                    </span>
                    {party && targetUser.id === party.leaderId && (
                      <span className="px-3 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full font-medium flex items-center justify-center gap-1 w-full sm:w-auto">
                        <Crown className="w-4 h-4" />
                        Party Leader
                      </span>
                    )}
                    {targetUser.lastActivity !== null &&
                      targetUser.lastActivity > 15 && (
                        <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full font-medium w-full sm:w-auto text-center">
                          Inactive
                        </span>
                      )}
                    <span className="flex items-center justify-center gap-1 text-muted-foreground w-full sm:w-auto">
                      <Clock className="w-4 h-4" />
                      Last seen: {getLastSeenText(targetUser.lastActivity)}
                    </span>
                  </div>
                </div>
              </div>
              {isOwnProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate({ to: "/settings" })}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              About This User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Political Leaning
              </p>
              <p className="text-base">
                {targetUser.politicalLeaning || "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Bio
              </p>
              <p className="text-base whitespace-pre-wrap">
                {targetUser.bio || "No bio provided."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5" />
              Party Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {party ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Party
                  </p>
                  <p className="text-base">{party.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Party Leaning
                  </p>
                  <p className="text-base">
                    {party.leaning || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Party Color
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-4 rounded-full"
                      style={{ backgroundColor: party.color }}
                    />
                    <span className="text-base font-mono">{party.color}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Party Description
                  </p>
                  <p className="text-base whitespace-pre-wrap">
                    {party.bio || "No description available."}
                  </p>
                </div>
                <Button
                  className="mt-4"
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
              <p className="text-muted-foreground">Independent</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Voting History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allVotes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No voting history available.
              </p>
            ) : (
              <div className="space-y-3">
                {displayedVotes.map((vote) => (
                  <div
                    key={vote.id}
                    className="p-4 py-8 border rounded-lg hover:shadow transition"
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium mb-1">
                          Bill #{vote.billId}: {vote.billTitle}
                        </h3>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`flex items-center gap-1 text-sm font-medium ${
                              vote.voteYes
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {vote.voteYes ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {vote.voteYes ? "For" : "Against"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            •
                          </span>
                          <span className="text-sm text-muted-foreground capitalize">
                            {vote.stage}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Status: {vote.billStatus}
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
      </div>
    </ProtectedRoute>
  );
}
