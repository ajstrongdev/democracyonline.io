"use client";

import withAuth from "@/lib/withAuth";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { fetchUserInfo } from "@/app/utils/userHelper";
import { getUserById } from "@/app/utils/userHelper";
import { UserInfo } from "@/app/utils/userHelper";

function PresidentElections() {
  const [user] = useAuthState(auth);
  const queryClient = useQueryClient();

  // Get user info
  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });
  // Get election info
  const {
    data: electionInfo,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["electionInfo", "President"],
    queryFn: () =>
      axios
        .get("/api/election-info", { params: { election: "President" } })
        .then((res) => res.data),
    enabled: !!thisUser,
    refetchOnWindowFocus: false,
    retry: false,
  });
  // Get candidates - always fetch when we have election info
  const {
    data: candidates,
    refetch: refetchCandidates,
    isLoading: candidatesLoading,
  } = useQuery({
    queryKey: ["candidates", "President"],
    queryFn: () =>
      axios
        .get("/api/election-get-candidates", {
          params: { election: "President" },
        })
        .then((res) => res.data),
    enabled: !!electionInfo,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const standAsCandidate = async () => {
    if (!thisUser) return;
    try {
      const response = await axios.post("/api/election-stand-candidate", {
        userId: thisUser.id,
        election: "President",
      });
      await refetch();
      await refetchCandidates();
    } catch (error) {
      console.error("Error standing as candidate:", error);
    }
  };

  const isAlreadyCandidate =
    candidates &&
    Array.isArray(candidates) &&
    candidates.some(
      (candidate: any) =>
        candidate.userId === thisUser?.id || candidate.user_id === thisUser?.id
    );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Presidential Elections</h1>
      <p className="text-muted-foreground mb-6">
        Step into the political arena. Declare your candidacy, campaign for
        votes, and compete with other players to become the next President.
      </p>
      {isLoading ? (
        <GenericSkeleton />
      ) : isError ? (
        <Alert className="mb-6">
          <AlertTitle className="font-bold">
            Error loading election info
          </AlertTitle>
          <AlertDescription>
            There was an error fetching the election information. Please try
            again later.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {electionInfo && electionInfo.status === "Candidate" && (
            <>
              {candidatesLoading ? (
                <GenericSkeleton />
              ) : (
                <Alert className="mb-6">
                  <AlertTitle className="font-bold">
                    {isAlreadyCandidate
                      ? "You are standing in this election"
                      : "Stand as a candidate!"}
                  </AlertTitle>
                  <AlertDescription
                    className={
                      !isAlreadyCandidate
                        ? "md:flex md:items-center md:justify-between"
                        : ""
                    }
                  >
                    <>
                      Stand as a candidate in the upcoming presidential
                      elections. Rally support amongst players and become the
                      next President!
                      {!isAlreadyCandidate && thisUser ? (
                        <Button
                          className="mt-4 md:mt-0"
                          onClick={standAsCandidate}
                        >
                          Declare Candidacy!
                        </Button>
                      ) : (
                        <h2 className="mt-2 text-green-500 font-semibold">
                          You are currently a candidate in the upcoming
                          presidential election. Good luck!
                        </h2>
                      )}
                    </>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default withAuth(PresidentElections);
