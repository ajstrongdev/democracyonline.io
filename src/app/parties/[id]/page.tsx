"use client";

import withAuth from "@/lib/withAuth";
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import GenericSkeleton from "@/components/genericskeleton";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { DoorOpen, Scroll, Handshake, Crown } from "lucide-react";
import { fetchUserInfo } from "@/app/utils/userHelper";
import type { UserInfo } from "@/app/utils/userHelper";
import type { Party } from "@/app/utils/partyHelper";

function Home() {
  const [party, setParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<UserInfo[]>([]);
  const [thisUser, setThisUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<boolean>(false);
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const fetchPartyMembers = async () => {
    try {
      const response = await axios.get("/api/party-members", {
        params: { partyId: id },
      });
      setPartyMembers(response.data);
    } catch (error) {
      console.error("Error fetching party members:", error);
    }
  };

  const fetchMembershipStatus = async () => {
    try {
      const response = await axios.post("/api/party-check-membership", {
        partyId: id,
        userId: thisUser?.id,
      });
      setMembershipStatus(response.data);
    } catch (error) {
      console.error("Error fetching membership status:", error);
    }
    fetchPartyMembers();
  };

  const leaveParty = async () => {
    fetchUserInfo(user?.email || "").then((userInfo) => {
      setThisUser(userInfo || null);
    });
    try {
      const response = await axios.post("/api/party-leave", {
        userId: thisUser?.id,
        partyId: id,
      });
      setThisUser(response.data);
    } catch (error) {
      console.error("Error leaving party:", error);
    }
    fetchMembershipStatus();
    fetchParty();
  };

  const joinParty = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/parties/join`,
        {
          userId: thisUser?.id,
          partyId: id,
        }
      );
      setThisUser(response.data);
    } catch (error) {
      console.error("Error joining party:", error);
    }
    await fetchPartyMembers();
    await fetchMembershipStatus();
  };

  const fetchParty = async () => {
    try {
      const response = await axios.get("/api/get-party-by-id", {
        params: { partyId: id },
      });
      setParty(response.data);
    } catch (error) {
      console.error("Error fetching party:", error);
    } finally {
      setLoading(false);
    }
  };

  const becomeLeader = async () => {
    try {
      const response = await axios.post("/api/party-become-leader", {
        userId: thisUser?.id,
        partyId: id,
      });
      setThisUser(response.data);
    } catch (error) {
      console.error("Error becoming party leader:", error);
    }
    await fetchParty();
    await fetchMembershipStatus();
    console.log("Refreshed");
    // HOTFIX: Temporary hotfix, leaving the party after becoming leader fails because userId not found.
    window.location.reload();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (user?.email) {
        const userInfo = await fetchUserInfo(user.email);
        setThisUser(userInfo || null);
      }
    };
    fetchData();
    fetchParty();
  }, [id, router, user]);

  useEffect(() => {
    if (thisUser?.id && id) {
      fetchMembershipStatus();
    }
  }, [thisUser, id]);

  return (
    <div className="container mx-auto py-8 px-4">
      {loading ? (
        <GenericSkeleton />
      ) : party ? (
        <div className="space-y-6">
          <Card className="border-l-4" style={{ borderLeftColor: party.color }}>
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div
                  className="flex aspect-square size-16 items-center justify-center rounded-lg shadow-md"
                  style={{ backgroundColor: party.color }}
                >
                  <span className="text-3xl font-bold text-white">
                    {party.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold text-foreground">
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
                              (member) => member.id === party.leader_id
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
                    {membershipStatus && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={leaveParty}
                      >
                        <DoorOpen /> Leave Party
                      </Button>
                    )}
                    {membershipStatus && !party.leader_id && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={becomeLeader}
                      >
                        <Crown /> Become Party Leader
                      </Button>
                    )}
                    {thisUser?.party_id === null && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={joinParty}
                      >
                        <Handshake /> Join Party
                      </Button>
                    )}
                    {party.manifesto_url ? (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          window.open(party.manifesto_url, "_blank")
                        }
                      >
                        <Scroll /> Read Party Manifesto
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        disabled
                      >
                        📄 No Manifesto Available
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
                            {member.id === party.leader_id && (
                              <span className={`font-medium text-green-500`}>
                                - Party Leader
                              </span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="text-sm"
                          onClick={() => router.push(`/profile/${member.id}`)}
                        >
                          View Profile
                        </Button>
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
              The party you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => router.push("/parties")}>
              ← Back to All Parties
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default withAuth(Home);
