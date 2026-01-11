import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  YAxis,
} from "recharts";
import { Suspense } from "react";
import { Crown, Handshake, TrendingUp, Users } from "lucide-react";
import type {User} from "firebase/auth";
import type {ChartConfig} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";
import GenericSkeleton from "@/components/generic-skeleton";
import { partyPageData } from "@/lib/server/party";
import ProtectedRoute from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import PartyLogo from "@/components/party-logo";

export const Route = createFileRoute("/parties/")({
  beforeLoad: ({ context }) => {
    if (context.auth.loading) {
      return;
    }
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    return partyPageData({
      data: { email: (context.auth.user as User).email! },
    });
  },
  component: PartyDetailsPage,
});

function PartyDetailsPage() {
  return (
    <Suspense fallback={<GenericSkeleton />}>
      <ProtectedRoute>
        <PartyContent />
      </ProtectedRoute>
    </Suspense>
  );
}

function PartyContent() {
  const data = Route.useLoaderData();
  const partyStats = data.partyInfo;

  // Debug logging
  console.log("Party Stats:", partyStats);
  console.log("First party:", partyStats[0]);

  // Get total numnber of party members.
  const totalMembers = partyStats.reduce(
    (sum, stats) => sum + Number(stats.memberCount || 0),
    0,
  );

  // Sort parties by member count
  const sortedParties = [...partyStats].sort(
    (a, b) => Number(b.memberCount || 0) - Number(a.memberCount || 0),
  );

  // Chart config
  const barChartConfig: ChartConfig = {
    members: {
      label: "Members",
      color: "hsl(var(--chart-1))",
    },
  };

  const pieChartConfig: ChartConfig = sortedParties.reduce(
    (config, stats, index) => {
      config[stats.id.toString()] = {
        label: stats.name,
        color: stats.color || `hsl(var(--chart-${(index % 5) + 1}))`,
      };
      return config;
    },
    {} as ChartConfig,
  );

  // Chart data
  const barChartData = sortedParties.map((stats) => ({
    name: stats.name,
    members: Number(stats.memberCount || 0),
    fill: stats.color || "hsl(var(--chart-1))",
  }));

  const pieChartData = sortedParties
    .filter((stats) => Number(stats.memberCount || 0) > 0)
    .map((stats) => ({
      name: stats.name,
      value: Number(stats.memberCount || 0),
      fill: stats.color || "hsl(var(--chart-1))",
    }));

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
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partyStats.length}</div>
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
              {partyStats[0]?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {partyStats[0]?.memberCount || 0} members
            </p>
          </CardContent>
        </Card>
      </div>
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
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base md:text-lg">All Parties</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Parties ranked by membership size.
            </CardDescription>
          </div>
          {!data.isInParty && (
            <Button asChild variant="default" size="sm" className="shrink-0">
              <Link to="/parties/create">
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
                key={stats.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border bg-card transition-colors"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: stats.color,
                }}
              >
                {/* Rank and Logo - Always together on mobile */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted font-bold text-base md:text-lg shrink-0">
                    #{index + 1}
                  </div>

                  <div className="shrink-0 sm:hidden md:block">
                    <PartyLogo party_id={stats.id} size={40} />
                  </div>
                  <div className="hidden sm:block md:hidden">
                    <PartyLogo party_id={stats.id} size={48} />
                  </div>

                  {/* Party info - shows next to rank on mobile */}
                  <div className="flex-1 min-w-0 sm:hidden">
                    <h3 className="font-semibold text-base truncate">
                      {stats.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {stats.bio}
                    </p>
                  </div>
                </div>

                {/* Party info - separate on desktop */}
                <div className="hidden sm:block sm:flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg truncate">
                    {stats.name}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                    {stats.bio}
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
                            1,
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
                      <Link to="/parties/$id" params={{ id: stats.id }}>
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

      {partyStats.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No parties found. Check back later!
          </p>
        </div>
      )}
    </div>
  );
}
