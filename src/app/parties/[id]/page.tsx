/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import withAuth from "@/lib/withAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import {
  DoorOpen,
  Handshake,
  Crown,
  Pencil,
  ArrowLeftRight,
} from "lucide-react";
import { fetchUserInfo } from "@/app/utils/userHelper";
import { Key } from "react";
import { Chat } from "@/components/Chat";
import { toast } from "sonner";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { useState } from "react";
import PartyLogo from "@/components/PartyLogo";

function Home() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const queryClient = useQueryClient();
  const [showKickDialog, setShowKickDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: number;
    username: string;
  } | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Get user info
  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });

  // Party info
  const { data: party, isLoading: partyLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => {
      const response = await axios.get("/api/get-party-by-id", {
        params: { partyId: id },
      });
      return response.data;
    },
    enabled: !!id,
  });

  // Party members
  const { data: partyMembers = [] } = useQuery({
    queryKey: ["partyMembers", id],
    queryFn: async () => {
      const response = await axios.get("/api/party-members", {
        params: { partyId: id },
      });
      return response.data;
    },
    enabled: !!id,
  });

  const { data: membershipStatus, isLoading: membershipLoading } = useQuery({
    queryKey: ["membershipStatus", thisUser?.id, id],
    queryFn: async () => {
      if (!thisUser?.id || !id) return false;
      const response = await axios.post("/api/party-check-membership", {
        userId: thisUser.id,
        partyId: id,
      });
      return typeof response.data === "boolean" ? response.data : false;
    },
    enabled: !!thisUser?.id && !!id,
    initialData: false,
  });

  // Get merge request count for this party
  const { data: mergeRequestCount = 0 } = useQuery({
    queryKey: ["mergeRequestCount", id],
    queryFn: async () => {
      if (!id) return 0;
      const response = await axios.get("/api/party-merge-requests-get", {
        params: { partyId: id },
      });
      return response.data?.length || 0;
    },
    enabled: !!id && party?.leader_id === thisUser?.id,
  });

  const joinParty = useMutation({
    mutationFn: async () => {
      const res = await axios.post("/api/party-join", {
        userId: thisUser?.id,
        partyId: id,
      });
      await axios.post("/api/feed-add", {
        userId: thisUser?.id,
        content: `has joined the "${party?.name}".`,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partyMembers", id] });
      queryClient.invalidateQueries({
        queryKey: ["membershipStatus", thisUser?.id, id],
      });
      queryClient.invalidateQueries({ queryKey: ["user", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["party", id] });
    },
  });

  const leaveParty = useMutation({
    mutationFn: async () => {
      const res = await axios.post("/api/party-leave", {
        userId: thisUser?.id,
        partyId: id,
      });
      await axios.post("/api/feed-add", {
        userId: thisUser?.id,
        content: `has left the party "${party?.name}".`,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partyMembers", id] });
      queryClient.invalidateQueries({
        queryKey: ["membershipStatus", thisUser?.id, id],
      });
      queryClient.invalidateQueries({ queryKey: ["user", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["party", id] });
      router.push("/parties");
    },
  });

  const becomeLeader = useMutation({
    mutationFn: async () => {
      const res = await axios.post("/api/party-become-leader", {
        userId: thisUser?.id,
        partyId: id,
      });
      await axios.post("/api/feed-add", {
        userId: thisUser?.id,
        content: `has become the party leader for "${party?.name}".`,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", id] });
      queryClient.invalidateQueries({ queryKey: ["partyMembers", id] });
      queryClient.invalidateQueries({
        queryKey: ["membershipStatus", thisUser?.id, id],
      });
      queryClient.invalidateQueries({ queryKey: ["user", user?.email] });
    },
  });

  const handlekickMember = async (userId: number) => {
    try {
      await axios.post("/api/party-kick", {
        userId: userId,
      });
      toast.success("Member kicked successfully.");
      queryClient.invalidateQueries({ queryKey: ["partyMembers", id] });
    } catch (error) {
      toast.error("Failed to kick member.");
    }
  };

  const kickMember = (member: { id: number; username: string }) => {
    setSelectedMember({ id: member.id, username: member.username });
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
                    {party.leader_id ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leader:</span>
                        <span className="font-medium">
                          <Button
                            variant="link"
                            className="p-0 h-auto text-base font-medium"
                            onClick={() =>
                              router.push(`/profile/${party.leader_id}`)
                            }
                          >
                            {partyMembers.find(
                              (member: any) => member.id === party.leader_id
                            )?.username || `User ID ${party.leader_id}`}
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
                    {membershipStatus && party.leader_id === thisUser?.id && (
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
                          {mergeRequestCount > 0 && (
                            <span className="ml-auto bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                              {mergeRequestCount}
                            </span>
                          )}
                        </Button>
                      </>
                    )}
                    {membershipStatus &&
                      party.leader_id === null &&
                      thisUser?.id !== party.leader_id && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => becomeLeader.mutate()}
                        >
                          <Crown /> Become Party Leader
                        </Button>
                      )}
                    {thisUser?.party_id === null && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => joinParty.mutate()}
                      >
                        <Handshake /> Join Party
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
          {party && party.stances && party.stances.length > 0 && (
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
                  )
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
                  {partyMembers.map((member: any) => (
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
                            {member.id === party.leader_id && (
                              <span className={`font-medium text-green-500`}>
                                - Party Leader
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          {party.leader_id === thisUser?.id &&
                            member.id !== party.leader_id && (
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
            handlekickMember(selectedMember.id);
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
          leaveParty.mutate();
          setShowLeaveDialog(false);
        }}
      />
    </div>
  );
}

export default withAuth(Home);
