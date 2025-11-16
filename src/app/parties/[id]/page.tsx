"use client";

import {
  ArrowLeftRight,
  Crown,
  DoorOpen,
  Handshake,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type Key, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";
import { Chat } from "@/components/Chat";
import GenericSkeleton from "@/components/genericskeleton";
import PartyLogo from "@/components/PartyLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import withAuth from "@/lib/withAuth";

function Home() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const utils = trpc.useUtils();
  const id = Number(params.id);
  const [showKickDialog, setShowKickDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: number;
    username: string;
  } | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Get user info
  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  const { data: party, isLoading: partyLoading } = trpc.party.getById.useQuery({
    partyId: Number(id),
  });

  // Party members
  const { data: partyMembers = [] } = trpc.party.members.useQuery({
    partyId: id,
  });

  const { data: membershipStatus, isLoading: membershipLoading } =
    trpc.party.checkMembership.useQuery(
      { userId: thisUser?.id ?? 0, partyId: id },
      { enabled: !!thisUser?.id && Number.isFinite(id) },
    );

  const isLeader = party?.leaderId === thisUser?.id;

  // Get merge request count for this party
  const { data: mergeRequests = [] } = trpc.party.mergeListIncoming.useQuery(
    { partyId: id },
    { enabled: isLeader && Number.isFinite(id) },
  );
  const mergeRequestCount = isLeader ? (mergeRequests?.length ?? 0) : 0;

  // Join
  const joinParty = trpc.party.join.useMutation({
    onSuccess: () => {
      utils.party.members.invalidate({ partyId: id });
      utils.party.getById.invalidate({ partyId: id });
    },
  });

  // Leave
  const leaveParty = trpc.party.leave.useMutation({
    onSuccess: () => {
      utils.party.members.invalidate({ partyId: id });
      utils.party.getById.invalidate({ partyId: id });
      router.push("/parties");
    },
  });

  // Become leader
  const becomeLeader = trpc.party.becomeLeader.useMutation({
    onSuccess: () => {
      utils.party.getById.invalidate({ partyId: id });
      utils.party.members.invalidate({ partyId: id });
    },
  });

  // Kick member
  const kickMemberMutation = trpc.party.kick.useMutation({
    onSuccess: () => {
      toast.success("Member kicked successfully.");
      utils.party.members.invalidate({ partyId: id });
    },
  });

  const kickMember = (member: { id: number; username: string }) => {
    setSelectedMember(member);
    setShowKickDialog(true);
  };

  const loading =
    partyLoading || !thisUser || !partyMembers || membershipLoading;

  return (
    <div className="container mx-auto py-8 px-4">
      {loading ? (
        <GenericSkeleton />
      ) : party ? (
        <div className="space-y-6">
          <Card className="border-l-4" style={{ borderLeftColor: party.color }}>
            <CardHeader className="pb-6">
              <div className="md:flex items-center gap-4">
                <PartyLogo party_id={Number(params.id)} size={80} />
                <div className="flex-1">
                  <h1 className="text-2xl mt-8 md:mt-0 md:text-4xl font-bold text-foreground text-wrap break-words">
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
                      <span className="font-medium">{partyMembers.length}</span>
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
                              router.push(`/profile/${party.leaderId}`)
                            }
                          >
                            {partyMembers.find(
                              (member) => member.id === party.leaderId,
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
                    {membershipLoading ? (
                      <p className="text-muted-foreground">
                        Checking membership...
                      </p>
                    ) : (
                      membershipStatus && (
                        <Button
                          variant="destructive"
                          className="w-full justify-start"
                          onClick={() => setShowLeaveDialog(true)}
                        >
                          <DoorOpen /> Leave Party
                        </Button>
                      )
                    )}
                    {membershipStatus && isLeader && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => router.push(`/parties/manage/${id}`)}
                        >
                          <Pencil /> Edit Party Info
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => router.push(`/parties/merge/${id}`)}
                        >
                          <ArrowLeftRight /> Merge Party
                          {isLeader && mergeRequestCount > 0 && (
                            <span className="ml-auto bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                              {mergeRequestCount}
                            </span>
                          )}
                        </Button>
                      </>
                    )}
                    {membershipStatus &&
                      party.leaderId === null &&
                      thisUser?.id !== party.leaderId && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => becomeLeader.mutate()}
                        >
                          <Crown /> Become Party Leader
                        </Button>
                      )}
                    {!membershipStatus && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => joinParty.mutate({ partyId: id })}
                      >
                        <Handshake /> Join Party
                      </Button>
                    )}
                    {party.discord && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          window.open(party.discord, "_blank", "noopener")
                        }
                      >
                        <MessageSquare /> Join Party Discord
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => router.push("/parties")}
                    >
                      ← Back to All Parties
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {party?.stances && party.stances.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold text-foreground">
                  Party Platform
                </h2>
              </CardHeader>
              <CardContent>
                {party.stances.map(
                  (stance: { issue: string; value: string; id: Key }) => (
                    <div key={stance.id}>
                      <h3 className="text-xl font-medium text-foreground mb-2">
                        {stance.issue}
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
          {membershipLoading
            ? null
            : membershipStatus &&
              thisUser && (
                <Chat
                  room={`party-${id}`}
                  userId={thisUser.id}
                  username={thisUser.username}
                  title="Party Chat"
                />
              )}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold text-foreground">
                Party Members
              </h2>
            </CardHeader>
            <CardContent>
              {partyMembers.length > 0 ? (
                <div className="space-y-4">
                  {partyMembers.map((member) => (
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
                          {party.leaderId === thisUser?.id &&
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
                            onClick={() => router.push(`/profile/${member.id}`)}
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
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Party Not Found
            </h2>
            <p className="text-muted-foreground mb-4">
              The party you&apos;re looking for doesn&apos;t exist or has been
              removed.
            </p>
            <Button onClick={() => router.push("/parties")}>
              ← Back to All Parties
            </Button>
          </CardContent>
        </Card>
      )}
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
            kickMemberMutation.mutate({ userId: selectedMember.id });
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
        onConfirm={() => {
          leaveParty.mutate({});
          setShowLeaveDialog(false);
        }}
      />
    </div>
  );
}

export default withAuth(Home);
