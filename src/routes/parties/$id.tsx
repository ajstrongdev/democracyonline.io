import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Crown,
  DoorOpen,
  Handshake,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { getPartyDetails, joinParty, leaveParty } from "@/lib/server/party";
import { getMergeRequestCount } from "@/lib/server/party-merge";
import { getCurrentUserInfo } from "@/lib/server/users";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import PartyLogo from "@/components/party-logo";
import { Button } from "@/components/ui/button";
import { MessageDialog } from "@/components/message-dialog";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";

export const Route = createFileRoute("/parties/$id")({
  loader: async ({ params }) => {
    const partyId = Number(params.id);
    if (isNaN(partyId)) {
      throw redirect({ to: "/parties" });
    }

    const userInfo = await getCurrentUserInfo();

    const [partyDetails, mergeRequestCount] = await Promise.all([
      getPartyDetails({
        data: {
          partyId,
          userId: userInfo?.id ?? null,
        },
      }),
      getMergeRequestCount({ data: { partyId } }),
    ]);

    return {
      ...partyDetails,
      userInfo,
      mergeRequestCount,
    };
  },
  gcTime: 0, // Force loader to refetch on client hydration
  component: PartyPage,
});

function PartyPage() {
  const {
    party,
    stances,
    members,
    userInfo: loaderUserInfo,
    mergeRequestCount,
  } = Route.useLoaderData();
  const userInfo = useUserData(loaderUserInfo);
  const navigate = useNavigate();
  const [showKickDialog, setShowKickDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: number;
    username: string;
  } | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Hack: Determine membership status client-side since direct navigation caused the loader to return incomplete data.
  const membershipStatus = {
    isInParty: members.some((m) => m.id === userInfo?.id),
    isLeader: party?.leaderId === userInfo?.id,
  };

  const kickMember = (member: { id: number; username: string }) => {
    setSelectedMember({ id: member.id, username: member.username });
    setShowKickDialog(true);
  };

  if (!party) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Party not found</p>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <Card className="border-l-4" style={{ borderLeftColor: party.color }}>
            <CardHeader className="pb-6">
              <div className="md:flex items-center gap-4">
                <PartyLogo party_id={party.id} size={80} />
                <div className="flex-1">
                  <h1 className="text-2xl mt-8 md:mt-0 md:text-4xl font-bold text-foreground text-wrap wrap-break-words">
                    {party.name}
                  </h1>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold text-foreground">
                About This Party
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Description
                </h3>
                <p className="text-card-foreground leading-relaxed">
                  {party.bio}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Party Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Members:</span>
                      <span className="font-medium">{members.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Party Color:
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: party.color }}
                        />
                        <span className="font-mono text-xs">{party.color}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Political Leaning:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {party.leaning}
                        </span>
                      </div>
                    </div>
                    {party.leaderId ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leader:</span>
                        <span className="font-medium">
                          <Button
                            variant="link"
                            className="p-0 h-auto text-base font-medium"
                            onClick={() =>
                              navigate({
                                to: "/profile/$id",
                                params: {
                                  id: party.leaderId
                                    ? party.leaderId.toString()
                                    : "",
                                },
                              })
                            }
                          >
                            {members.find(
                              (member: any) => member.id === party.leaderId,
                            )?.username || `User ID ${party.leaderId}`}
                          </Button>
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leader:</span>
                        <span className="text-amber-600">
                          No leader assigned
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Actions
                  </h3>
                  <div className="space-y-3">
                    {membershipStatus.isInParty && (
                      <Button
                        variant="destructive"
                        className="w-full justify-start"
                        onClick={() => {
                          setShowLeaveDialog(true);
                        }}
                      >
                        <DoorOpen className="mr-2 h-4 w-4" /> Leave Party
                      </Button>
                    )}
                    {membershipStatus.isLeader && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            // TODO: Implement edit party page
                            navigate({
                              to: "/parties/manage/$id",
                              params: {
                                id: party.id.toString(),
                              },
                            });
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit Party Info
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start relative"
                          onClick={() => {
                            navigate({
                              to: "/parties/merge/$id",
                              params: { id: party.id.toString() },
                            });
                          }}
                        >
                          <ArrowLeftRight className="mr-2 h-4 w-4" /> Merge
                          Party
                          {mergeRequestCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                              {mergeRequestCount}
                            </span>
                          )}
                        </Button>
                      </>
                    )}
                    {membershipStatus.isInParty &&
                      !party.leaderId &&
                      !membershipStatus.isLeader && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            // TODO: Implement become leader functionality
                            alert("Become leader functionality coming soon");
                          }}
                        >
                          <Crown className="mr-2 h-4 w-4" /> Become Party Leader
                        </Button>
                      )}
                    {!membershipStatus.isInParty && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={async () => {
                          if (userInfo?.id) {
                            setShowJoinDialog(true);
                          }
                        }}
                      >
                        <Handshake className="mr-2 h-4 w-4" /> Join Party
                      </Button>
                    )}
                    {party.discord && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          window.open(party.discord || "", "_blank", "noopener")
                        }
                      >
                        <MessageSquare className="mr-2 h-4 w-4" /> Join Party
                        Discord
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate({ to: "/parties" })}
                    >
                      ← Back to All Parties
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {party && stances && stances.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold text-foreground">
                  Party Platform
                </h2>
              </CardHeader>
              <CardContent>
                {stances
                  .slice()
                  .sort((a, b) => {
                    if (a.stanceId == null && b.stanceId == null) return 0;
                    if (a.stanceId == null) return 1;
                    if (b.stanceId == null) return -1;
                    return a.stanceId - b.stanceId;
                  })
                  .map(
                    (stance: {
                      title: string;
                      value: string;
                      stanceId: number | null;
                    }) => (
                      <div key={stance.stanceId}>
                        <h3 className="text-xl font-medium text-foreground mb-2">
                          {stance.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                          {stance.value || "No stance provided."}
                        </p>
                      </div>
                    ),
                  )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold text-foreground">
                Party Members
              </h2>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member: (typeof members)[number]) => (
                    <div
                      key={member.id}
                      className="p-4 border rounded-lg hover:shadow transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {member.username}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.role}{" "}
                            {member.id === party.leaderId && (
                              <span className={`font-medium text-green-500`}>
                                - Party Leader
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          {party.leaderId === userInfo?.id &&
                            member.id !== party.leaderId && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="text-sm mr-2"
                                onClick={() =>
                                  kickMember({
                                    id: member.id,
                                    username: member.username,
                                  })
                                }
                              >
                                Kick Member
                              </Button>
                            )}
                          <Button
                            size="sm"
                            className="text-sm"
                            onClick={() =>
                              navigate({
                                to: "/profile/$id",
                                params: { id: member.id.toString() },
                              })
                            }
                          >
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No members found for this party.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <MessageDialog
          open={showKickDialog}
          onOpenChange={setShowKickDialog}
          title="Kick party member?"
          description={
            <span className="text-left leading-relaxed">
              <span className="block">
                Are you sure you want to remove{" "}
                <span className="font-semibold">
                  {selectedMember?.username ?? "this member"}
                </span>{" "}
                from the party?
              </span>
            </span>
          }
          confirmText="Kick"
          cancelText="Cancel"
          confirmAriaLabel="Confirm kick"
          cancelAriaLabel="Cancel kick"
          variant="destructive"
          onConfirm={() => {
            if (selectedMember?.id != null) {
              console.log("Kicked member with ID:", selectedMember.id);
            }
            setShowKickDialog(false);
          }}
        />
        <MessageDialog
          open={showLeaveDialog}
          onOpenChange={setShowLeaveDialog}
          title="Leave party?"
          description={
            <span className="text-left leading-relaxed">
              <span className="block">
                Are you sure you want to leave{" "}
                <span className="font-semibold">
                  {party?.name ?? "this party"}
                </span>
                ?
              </span>
            </span>
          }
          confirmText="Leave"
          cancelText="Cancel"
          confirmAriaLabel="Confirm leave"
          cancelAriaLabel="Cancel leave"
          variant="destructive"
          onConfirm={async () => {
            if (userInfo?.id) {
              await leaveParty({
                data: {
                  userId: userInfo.id,
                },
              });
              navigate({
                to: "/parties/$id",
                params: { id: String(party.id) },
              });
            }
            setShowLeaveDialog(false);
          }}
        />
        <MessageDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          title="Join party?"
          description={
            <span className="text-left leading-relaxed">
              <span className="block">
                Are you sure you want to join{" "}
                <span className="font-semibold">
                  {party?.name ?? "this party"}
                </span>
                ?
              </span>
            </span>
          }
          confirmText="Join"
          cancelText="Cancel"
          confirmAriaLabel="Confirm join"
          cancelAriaLabel="Cancel join"
          onConfirm={async () => {
            if (userInfo?.id) {
              await joinParty({
                data: { userId: userInfo.id, partyId: party.id },
              });
              navigate({
                to: "/parties/$id",
                params: { id: String(party.id) },
              });
            }
            setShowJoinDialog(false);
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
