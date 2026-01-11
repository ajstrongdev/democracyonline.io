import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Crown,
  Edit,
  Handshake,
  XCircle,
} from "lucide-react";
import {
  fetchUserInfoByEmail,
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

export const Route = createFileRoute("/profile/$id")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ params, context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    // Get current user's DB info
    const currentUserData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    });
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
        votes: [],
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
    const votes = await getUserVotingHistory({
      data: { userId: targetUserId },
    });

    return {
      targetUser,
      party,
      votes,
      currentUser,
      error: null,
    };
  },
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { targetUser, party, votes, currentUser, error } =
    Route.useLoaderData();

  if (error || !targetUser) {
    return (
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
    );
  }

  const isOwnProfile = currentUser?.id === targetUser.id;
  const partyColor = party?.color || "#6b7280";

  return (
    <div className="container mx-auto p-8 max-w-4xl space-y-6">
      {/* Header Card */}
      <Card
        className="relative overflow-hidden"
        style={{ borderLeftColor: partyColor, borderLeftWidth: "6px" }}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {party ? (
                <PartyLogo party_id={party.id} size={64} />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
                  I
                </div>
              )}
              <div>
                <CardTitle className="text-3xl mb-2">
                  {targetUser.username}'s Profile
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    {targetUser.role || "Representative"}
                  </span>
                  {party && targetUser.id === party.leaderId && (
                    <span className="px-3 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full font-medium flex items-center gap-1">
                      <Crown className="w-4 h-4" />
                      Party Leader
                    </span>
                  )}
                  {targetUser.lastActivity !== null &&
                    targetUser.lastActivity > 15 && (
                      <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full font-medium">
                        Inactive
                      </span>
                    )}
                  <span className="flex items-center gap-1 text-muted-foreground">
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
                onClick={() => navigate({ to: "/settings" })}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* About This User */}
      <Card>
        <CardHeader>
          <CardTitle>About This User</CardTitle>
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

      {/* Party Information */}
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
                <p className="text-base">{party.leaning || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Party Color
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
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

      {/* Voting History */}
      <Card>
        <CardHeader>
          <CardTitle>Voting History</CardTitle>
        </CardHeader>
        <CardContent>
          {votes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No voting history available.
            </p>
          ) : (
            <div className="space-y-3">
              {votes.map((vote) => (
                <Card key={vote.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {vote.voteYes ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium mb-1">
                          Bill #{vote.billId}: {vote.billTitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="px-2 py-0.5 bg-muted rounded">
                            {vote.stage}
                          </span>
                          <span className="px-2 py-0.5 bg-muted rounded">
                            {vote.billStatus}
                          </span>
                          <span>Voted: {vote.voteYes ? "For" : "Against"}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({
                          to: "/bills/$id",
                          params: { id: String(vote.billId) },
                        })
                      }
                    >
                      View Bill
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
