"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PartyLogo from "@/components/PartyLogo";
import { Party } from "@/app/utils/partyHelper";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Label,
} from "recharts";
import { Users, Crown, TrendingUp } from "lucide-react";
import GenericSkeleton from "@/components/genericskeleton";

interface PartyMember {
  id: number;
  username: string;
  party_id: number;
}

interface PartyStats {
  party: Party;
  memberCount: number;
  members: PartyMember[];
}

export default function PartiesLeaderboard() {
  const { data: parties = [] as Party[], isLoading: partiesLoading } = useQuery(
    {
      queryKey: ["parties"],
      queryFn: async () => {
        const response = await axios.get("/api/party-list");
        return response.data;
      },
    }
  );

  const { data: partyStats = [] as PartyStats[], isLoading: statsLoading } =
    useQuery({
      queryKey: ["party-stats", parties],
      queryFn: async () => {
        if (!parties || parties.length === 0) return [];

        const statsPromises = parties.map(async (party: Party) => {
          try {
            const membersResponse = await axios.get(
              `/api/party-members?partyId=${party.id}`
            );
            const members = membersResponse.data;
            return {
              party,
              memberCount: members.length,
              members,
            };
          } catch (error) {
            console.error(
              `Error fetching members for party ${party.id}:`,
              error
            );
            return {
              party,
              memberCount: 0,
              members: [],
            };
          }
        });

        return Promise.all(statsPromises);
      },
      enabled: parties.length > 0,
    });

  const isLoading = partiesLoading || statsLoading;

  // Sort parties by member count
  const sortedParties = [...partyStats].sort(
    (a, b) => b.memberCount - a.memberCount
  );

  // Chart configuration
  const barChartConfig: ChartConfig = {
    members: {
      label: "Members",
      color: "hsl(var(--chart-1))",
    },
  };

  const pieChartConfig: ChartConfig = sortedParties.reduce(
    (config, stats, index) => {
      config[stats.party.id.toString()] = {
        label: stats.party.name,
        color: stats.party.color || `hsl(var(--chart-${(index % 5) + 1}))`,
      };
      return config;
    },
    {} as ChartConfig
  );

  // Prepare data for charts
  const barChartData = sortedParties.map((stats) => ({
    name: stats.party.name,
    members: stats.memberCount,
    fill: stats.party.color || "hsl(var(--chart-1))",
  }));

  const pieChartData = sortedParties
    .filter((stats) => stats.memberCount > 0)
    .map((stats) => ({
      name: stats.party.name,
      value: stats.memberCount,
      fill: stats.party.color || "hsl(var(--chart-1))",
    }));

  const totalMembers = sortedParties.reduce(
    (sum, stats) => sum + stats.memberCount,
    0
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Party Leaderboard</h1>
          <p className="text-muted-foreground">Loading party statistics...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
        <GenericSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Party Leaderboard
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Compare party sizes, membership statistics, and political influence
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
          <Tabs defaultValue="bar" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="bar">Bar Chart</TabsTrigger>
              <TabsTrigger value="pie">Pie Chart</TabsTrigger>
            </TabsList>

            <TabsContent value="bar">
              <ChartContainer
                config={barChartConfig}
                className="h-[300px] md:h-[500px] w-full"
              >
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--foreground))" }}
                    className="text-[10px] md:text-xs"
                    width={30}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value, payload) => {
                          return payload?.[0]?.payload?.name || value;
                        }}
                      />
                    }
                  />
                  <Bar dataKey="members" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="pie">
              <div className="flex items-center justify-center">
                <ChartContainer
                  config={pieChartConfig}
                  className="h-[300px] md:h-[500px] w-full"
                >
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="40%"
                      outerRadius="70%"
                      paddingAngle={2}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-2xl md:text-3xl font-bold"
                                >
                                  {totalMembers}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 20}
                                  className="fill-muted-foreground text-xs md:text-sm"
                                >
                                  Total Members
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detailed Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Detailed Rankings
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Full party leaderboard with statistics
          </CardDescription>
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

                  <a
                    href={`/parties/${stats.party.id}`}
                    className="px-3 md:px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs md:text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
