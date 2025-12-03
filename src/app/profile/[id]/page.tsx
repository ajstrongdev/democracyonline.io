/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import withAuth from "@/lib/withAuth";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserInfo, getUserFullById } from "@/app/utils/userHelper";
import GenericSkeleton from "@/components/common/genericskeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Handshake,
  Crown,
  Clock,
  Edit,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import PartyLogo from "@/components/parties/PartyLogo";
import React from "react";

function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user] = useAuthState(auth);

  const getLastSeenText = (lastActivity: number | string | undefined) => {
    const days = Number(lastActivity);
    if (isNaN(days) || days < 0) return "Unknown";
    if (days === 0) return "Today.";
    if (days === 1) return "1 day ago.";
    return `${days} days ago.`;
  };

  const { data: thisUser, isLoading: isThisUserLoading } = useQuery({
    queryKey: ["fetchUserInfo", user?.email],
    queryFn: async () => {
      return fetchUserInfo(user?.email || "").then((data) => data || null);
    },
    enabled: !!user?.email,
  });

  const {
    data: userData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["userInfo", id],
    queryFn: async () => {
      return getUserFullById(Number(id), true).then((data) => data || null);
    },
    enabled: !!id,
    retry: false,
  });

  const { data: partyData, isLoading: partyLoading } = useQuery({
    queryKey: ["partyInfo", userData?.party_id],
    queryFn: async () => {
      if (!userData?.party_id) return null;
      return fetch(`/api/get-party-by-id?partyId=${userData.party_id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data) => data || null);
    },
    enabled: !!userData?.party_id,
  });

  const { data: votesData, isLoading: votesLoading } = useQuery({
    queryKey: ["userVotes", id],
    queryFn: async () => {
      return fetch(`/api/bill-get-user-votes?userId=${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((data) => data.votes || []);
    },
    enabled: !!id,
  });

  if (isLoading || partyLoading || votesLoading || isThisUserLoading) {
    return <GenericSkeleton />;
  }

  // Check if user is disabled
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="mt-8">
          <CardHeader>
            <h1 className="text-2xl font-bold text-foreground">
              Profile Not Available
            </h1>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This user profile is not available. The user may have been
              disabled or removed.
            </p>
            <Button asChild className="mt-4">
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto p-4">
        <Card className="mt-8">
          <CardHeader>
            <h1 className="text-2xl font-bold text-foreground">
              User Not Found
            </h1>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The user you are looking for does not exist.
            </p>
            <Button asChild className="mt-4">
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="my-4">
        <Card
          className="border-l-4"
          style={{ borderLeftColor: partyData?.color || "#808080" }}
        >
          <CardHeader>
            <div className="flex items-start gap-4">
              {partyData ? (
                <PartyLogo party_id={partyData.id} size={64} />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  I
                </div>
              )}
              <div className="flex-1 min-w-0 overflow-hidden">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words hyphens-auto">
                  {userData?.username}&apos;s Profile
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm sm:text-base">
                  <Handshake className="w-4 h-4 flex-shrink-0" />{" "}
                  {userData?.role}
                </p>
                {userData?.id == partyData?.leader_id && (
                  <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm font-medium text-yellow-500">
                    <Crown className="w-4 h-4 flex-shrink-0" />
                    Party Leader
                  </div>
                )}
                <p className="mt-1 text-muted-foreground leading-relaxed text-xs sm:text-sm flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {getLastSeenText(userData?.last_activity)}
                </p>
                {userData?.id === thisUser.id && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full sm:w-auto"
                  >
                    <Link
                      href="/user-settings"
                      className="flex items-center gap-1.5 justify-center"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
      <div className="">
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              About This User
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col">
              <p className="text-muted-foreground leading-relaxed">
                Political Leaning:
              </p>
              <p className="text-card-foreground leading-relaxed">
                {userData?.political_leaning || "Not specified"}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-muted-foreground leading-relaxed">Bio:</p>
              <p className="text-card-foreground leading-relaxed">
                {userData?.bio}
              </p>
            </div>
          </CardContent>
          <CardHeader>
            <h2 className="text-xl sm:text-2xl font-semibold leading-relaxed">
              Party Information
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
              <p className="text-muted-foreground leading-relaxed">Party:</p>
              <p className="text-card-foreground leading-relaxed">
                {partyData?.name || "Independent"}
              </p>
            </div>
            {userData?.party_id != null && (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <p className="text-muted-foreground leading-relaxed">
                    Party Leaning:
                  </p>
                  <p className="text-card-foreground leading-relaxed">
                    {partyData.leaning}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <p className="text-muted-foreground leading-relaxed">
                    Party Color:
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: partyData.color }}
                    ></div>
                    <p className="text-card-foreground leading-relaxed font-mono">
                      {partyData.color}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground leading-relaxed">
                    Party Description:
                  </p>
                  <p className="text-card-foreground leading-relaxed">
                    {partyData.bio}
                  </p>
                  <Button
                    asChild
                    className="mt-4 w-full sm:w-auto sm:float-right"
                  >
                    <Link href={`/parties/${partyData.id}`}>
                      View Party Page
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Voting history
          </h2>
        </CardHeader>
        <CardContent>
          {votesData && votesData.length > 0 ? (
            <div className="space-y-4">
              {[...votesData].reverse().map((vote: any, index: number) => (
                <Card key={`${vote.id}-${vote.bill_id}-${vote.stage}-${index}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 break-words">
                          Bill #{vote.bill_id}: {vote.title}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`flex items-center gap-1.5 ${
                              vote.vote_yes
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {vote.vote_yes ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                              {vote.vote_yes ? "For" : "Against"}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            • {vote.stage}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Status: {vote.status || "N/A"}
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto sm:shrink-0"
                      >
                        <Link href={`/bills/${vote.bill_id}`}>View Bill</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-card-foreground">No voting history available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(ProfilePage);
