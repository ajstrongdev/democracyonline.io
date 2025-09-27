"use client";

import withAuth from "@/lib/withAuth";
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import type { Party } from "@/app/utils/partyHelper";
import type { UserInfo } from "@/app/utils/userHelper";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { fetchUserInfo } from "@/app/utils/userHelper";
import { Handshake } from "lucide-react";

function Home() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [thisUser, setThisUser] = useState<UserInfo | null>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    const fetchParties = async () => {
      try {
        const response = await axios.get(
          '/api/party-list'
        );
        setParties(response.data);
      } catch (error) {
        console.error("Error fetching parties:", error);
      } finally {
        setLoading(false);
      }
    };
    const userData = async () => {
      if (user && user.email) {
        const userDetails = await fetchUserInfo(user.email);
        setThisUser(userDetails || null);
      }
    }
    fetchParties();
    userData();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Political Parties
        </h1>
        <p className="text-muted-foreground">
          Discover the parties and their platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? // Loading skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="border-l-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>

                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                </CardContent>
              </Card>
            ))
          : parties.map((party) => (
              <Card
                key={party.id}
                className="hover:shadow-lg transition-shadow duration-200 border-l-4"
                style={{ borderLeftColor: party.color }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: party.color }}
                    ></div>
                    <div>
                      <Label className="text-xl font-semibold text-foreground">
                        {party.name}
                      </Label>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-card-foreground mb-4 line-clamp-3">
                    {party.bio}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                    <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                        <a href={`/parties/${party.id}`}>View Details</a>
                    </Button>
                      {party.manifesto_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
                          onClick={() =>
                            window.open(party.manifesto_url, "_blank")
                          }
                        >
                          View Manifesto →
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {thisUser?.party_id === null && !loading && (
        <div className="text-center mt-12 border-t">
          <p className="mt-8 my-4 text-lg text-foreground">
            Not a fan of any of these choices? Create your party!
          </p>
          <Button asChild variant="default" size="lg">
            <a href="/parties/create">
              <Handshake className="mr-2" />
              Create a Party
            </a>
          </Button>
        </div>
      )}

      {parties.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No parties found. Check back later!
          </p>
        </div>
      )}
    </div>
  );
}

export default withAuth(Home);
