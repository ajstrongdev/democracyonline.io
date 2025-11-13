/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import withAuth from "@/lib/withAuth";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import GenericSkeleton from "@/components/genericskeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Handshake, Crown } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import PartyLogo from "@/components/PartyLogo";
import React from "react";

function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user] = useAuthState(auth);

  const { data: thisUser, isLoading: isThisUserLoading } =
    trpc.user.getByEmail.useQuery(
      { email: user?.email || "" },
      { enabled: !!user?.email }
    );

  const { data: userData, isLoading, error } = trpc.user.getById.useQuery(
    { userId: Number(id), omitEmail: true },
    { enabled: !!id, retry: false }
  );

  const { data: partyData, isLoading: partyLoading } = trpc.party.getById.useQuery(
    { partyId: Number(userData?.party_id) },
    { enabled: !!userData?.party_id }
  );

  const { data: votesData, isLoading: votesLoading } = trpc.bill.getUserVotes.useQuery(
    { userId: Number(id) },
    { enabled: !!id }
  );

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
            <div className="md:flex items-center gap-4">
              {partyData ? (
                <PartyLogo party_id={partyData.id} size={80} />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-400 flex items-center justify-center text-white text-3xl font-bold">
                  I
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl mt-8 md:mt-0 md:text-3xl font-bold text-foreground text-wrap break-words">
                  {userData?.username}&apos;s Profile
                </h1>
                <p className="mt-1 flex items-center gap-2">
                  <Handshake className="w-4 h-4" /> {userData?.role}
                </p>
                {userData?.id == partyData?.leader_id && (
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-yellow-500">
                    <Crown className="w-4 h-4" />
                    Party Leader
                  </div>
                )}
              </div>
              {userData?.id === thisUser.id && (
                <div className="mt-4 md:mt-0">
                  <Button asChild>
                    <Link href="/user-settings">Edit Profile</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>
      <div className="">
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-2xl font-semibold text-foreground">
              About This User
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <p className="text-muted-foreground leading-relaxed">
                Political Leaning:
              </p>
              <p className="text-card-foreground leading-relaxed">
                {userData?.political_leaning || "Not specified"}
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-muted-foreground leading-relaxed">Bio:</p>
              <p className="text-card-foreground leading-relaxed">
                {userData?.bio}
              </p>
            </div>
          </CardContent>
          <CardHeader>
            <h2 className="text-2xl font-semibold leading-relaxed">
              Party Information
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <p className="text-muted-foreground leading-relaxed">Party:</p>
              <p className="text-card-foreground leading-relaxed">
                {partyData?.name || "Independent"}
              </p>
            </div>
            {userData?.party_id != null && (
              <>
                <div className="flex justify-between">
                  <p className="text-muted-foreground leading-relaxed">
                    Party Leaning:
                  </p>
                  <p className="text-card-foreground leading-relaxed">
                    {partyData.leaning}
                  </p>
                </div>
                <div className="flex justify-between">
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
                  <p className="text-card-foreground font-semibold leading-relaxed my-2">
                    Party Description:
                  </p>
                  <p className="text-card-foreground leading-relaxed">
                    {partyData.bio}
                  </p>
                  <Button asChild className="mt-4 float-right">
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
          <h2 className="text-2xl font-semibold text-foreground">
            Voting history
          </h2>
        </CardHeader>
        <CardContent>
          {votesData && votesData.length > 0 ? (
            <div className="space-y-3">
              {[...votesData].reverse().map((vote: any, index: number) => (
                <div
                  key={`${vote.id}-${vote.bill_id}-${vote.stage}-${index}`}
                  className="border p-4 rounded-md bg-sidebar"
                >
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Bill #{vote.bill_id}: {vote.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Stage: {vote.stage} | Status: {vote.status || "N/A"}
                      </p>
                      <Button asChild>
                        <Link href={`/bills#${vote.bill_id}`}>View Bill</Link>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-md text-xl ${
                          vote.vote_yes
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                        }`}
                      >
                        {vote.vote_yes ? "For" : "Against"}
                      </span>
                    </div>
                  </div>
                </div>
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
