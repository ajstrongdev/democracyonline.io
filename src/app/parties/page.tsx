import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Users, Crown, TrendingUp } from "lucide-react";
import Link from "next/link";
import PartyLogo from "@/components/parties/PartyLogo";
import { getServerSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { PartyCharts } from "@/components/parties/PartyCharts";
import { getPartyMembers, getParties, type Party } from "@/actions/parties";
import { getCurrentUser } from "@/actions/users";

interface PartyStats {
  party: Party;
  memberCount: number;
}

export default async function PartiesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Fetch all data in parallel
  const [parties, thisUser] = await Promise.all([
    getParties(),
    getCurrentUser(session.email),
  ]);

  // Fetch member counts for all parties in parallel
  const partyStatsPromises = parties.map(async (party) => {
    const members = await getPartyMembers(party.id);
    return {
      party,
      memberCount: members.length,
    };
  });

  const partyStats: PartyStats[] = await Promise.all(partyStatsPromises);

  // Sort parties by member count
  const sortedParties = [...partyStats].sort(
    (a, b) => b.memberCount - a.memberCount
  );

  const totalMembers = sortedParties.reduce(
    (sum, stats) => sum + stats.memberCount,
    0
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Political Parties
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Discover the parties and their platforms
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parties.length}</div>
            <p className="text-xs text-muted-foreground">
              Active political parties
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">Across all parties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Largest Party</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-xl font-bold truncate">
              {sortedParties[0]?.party.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {sortedParties[0]?.memberCount || 0} members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Party Membership Distribution
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Compare party sizes.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <PartyCharts partyStats={partyStats} />
        </CardContent>
      </Card>

      {/* Detailed Leaderboard */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base md:text-lg">All Parties</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Parties ranked by membership size.
            </CardDescription>
          </div>
          {thisUser?.party_id === null && (
            <Button asChild variant="default" size="sm" className="shrink-0">
              <Link href="/parties/create">
                <Handshake className="mr-2 h-4 w-4" />
                Create Party
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="space-y-3 md:space-y-4">
            {sortedParties.map((stats, index) => (
              <div
                key={stats.party.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border bg-card transition-colors"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: stats.party.color,
                }}
              >
                {/* Rank and Logo - Always together on mobile */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted font-bold text-base md:text-lg shrink-0">
                    #{index + 1}
                  </div>

                  <div className="shrink-0 sm:hidden md:block">
                    <PartyLogo party_id={stats.party.id} size={40} />
                  </div>
                  <div className="hidden sm:block md:hidden">
                    <PartyLogo party_id={stats.party.id} size={48} />
                  </div>

                  {/* Party info - shows next to rank on mobile */}
                  <div className="flex-1 min-w-0 sm:hidden">
                    <h3 className="font-semibold text-base truncate">
                      {stats.party.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {stats.party.bio}
                    </p>
                  </div>
                </div>

                {/* Party info - separate on desktop */}
                <div className="hidden sm:block sm:flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg truncate">
                    {stats.party.name}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                    {stats.party.bio}
                  </p>
                </div>

                {/* Stats and Button - Full width on mobile */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4">
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                      <span className="text-xl md:text-2xl font-bold">
                        {stats.memberCount}
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs text-muted-foreground">
                      {totalMembers > 0
                        ? `${((stats.memberCount / totalMembers) * 100).toFixed(
                            1
                          )}% of total`
                        : "0% of total"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Link href={`/parties/${stats.party.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
