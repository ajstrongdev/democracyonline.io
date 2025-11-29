"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface Voter {
  id: number;
  username: string;
  party_id: number | null;
  party_name: string | null;
  party_color: string | null;
  vote_yes: boolean;
}

interface BillVotersData {
  house: Voter[];
  senate: Voter[];
  presidential: Voter[];
}

function VoterCard({
  voter,
  showParty = true,
}: {
  voter: Voter;
  showParty?: boolean;
}) {
  return (
    <div className="p-3 sm:p-4 border rounded-lg hover:shadow transition">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div
            className={`flex-shrink-0 ${
              voter.vote_yes
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {voter.vote_yes ? (
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-sm sm:text-base break-words">
              {voter.username}
            </p>
            {showParty && voter.party_name && (
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                <span
                  className="font-medium"
                  style={{ color: voter.party_color || undefined }}
                >
                  {voter.party_name}
                </span>
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="text-xs sm:text-sm w-full sm:w-auto whitespace-nowrap"
          onClick={() => (window.location.href = `/profile/${voter.id}`)}
        >
          View Profile
        </Button>
      </div>
    </div>
  );
}

function VotersSection({
  title,
  voters,
  stage,
}: {
  title: string;
  voters: Voter[];
  stage: string;
}) {
  const forVotes = voters.filter((v) => v.vote_yes);
  const againstVotes = voters.filter((v) => !v.vote_yes);

  if (voters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>No votes recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4 md:p-6">
        <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground break-words">
          {title}
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="flex items-center gap-1 text-foreground">
            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
            {forVotes.length}
          </span>
          <span className="flex items-center gap-1 text-foreground">
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
            {againstVotes.length}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-medium text-foreground mb-2 sm:mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              Votes For ({forVotes.length})
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {forVotes.length > 0 ? (
                forVotes.map((voter) => (
                  <VoterCard key={voter.id} voter={voter} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg">
                  No votes for
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-medium text-foreground mb-2 sm:mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
              Votes Against ({againstVotes.length})
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {againstVotes.length > 0 ? (
                againstVotes.map((voter) => (
                  <VoterCard key={voter.id} voter={voter} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg">
                  No votes against
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillVotersList({ billId }: { billId: string }) {
  const [voters, setVoters] = useState<BillVotersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVoters() {
      try {
        const response = await fetch(`/api/bill-voters?billId=${billId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch voters");
        }
        const data = await response.json();
        setVoters(data);
      } catch (err) {
        console.error("Error fetching voters:", err);
        setError("Failed to load voter information");
      } finally {
        setLoading(false);
      }
    }

    fetchVoters();
  }, [billId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Voting Records</CardTitle>
          <CardDescription>Loading voter information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !voters) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Voting Records</CardTitle>
          <CardDescription className="text-red-600">
            {error || "Failed to load voters"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasAnyVotes =
    voters.house.length > 0 ||
    voters.senate.length > 0 ||
    voters.presidential.length > 0;

  if (!hasAnyVotes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Voting Records</CardTitle>
          <CardDescription>
            No votes have been cast on this bill yet
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {voters.house.length > 0 && (
        <VotersSection
          title="House of Representatives"
          voters={voters.house}
          stage="house"
        />
      )}
      {voters.senate.length > 0 && (
        <VotersSection title="Senate" voters={voters.senate} stage="senate" />
      )}
      {voters.presidential.length > 0 && (
        <VotersSection
          title="Oval Office"
          voters={voters.presidential}
          stage="presidential"
        />
      )}
    </div>
  );
}
