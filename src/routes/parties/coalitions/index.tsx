import { Link, createFileRoute } from "@tanstack/react-router";
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
import { Crown, Handshake, Users } from "lucide-react";
import type { ChartConfig } from "@/components/ui/chart";
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
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import GenericSkeleton from "@/components/generic-skeleton";
import CoalitionLogo from "@/components/coalition-logo";
import { getCoalitions } from "@/lib/server/coalitions";
import { getCurrentUserInfo } from "@/lib/server/users";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";

export const Route = createFileRoute("/parties/coalitions/")({
  loader: async () => {
    const [coalitionsList, userInfo] = await Promise.all([
      getCoalitions(),
      getCurrentUserInfo(),
    ]);
    return { coalitions: coalitionsList, userInfo };
  },
  component: CoalitionsPage,
});

function CoalitionsPage() {
  return (
    <Suspense fallback={<GenericSkeleton />}>
      <ProtectedRoute>
        <CoalitionsContent />
      </ProtectedRoute>
    </Suspense>
  );
}

function CoalitionsContent() {
  const { coalitions, userInfo } = Route.useLoaderData();
  const userData = useUserData(userInfo);
  const isInParty = userData?.partyId != null;

  const totalCoalitionParties = coalitions.reduce(
    (sum, c) => sum + Number(c.memberCount || 0),
    0,
  );

  // Chart configs
  const coalitionBarConfig: ChartConfig = {
    memberCount: {
      label: "Member Parties",
      color: "hsl(var(--chart-1))",
    },
  };

  const coalitionPieConfig: ChartConfig = coalitions.reduce(
    (config, c, idx) => {
      config[c.id.toString()] = {
        label: c.name,
        color: c.color || `hsl(var(--chart-${(idx % 5) + 1}))`,
      };
      return config;
    },
    {} as ChartConfig,
  );

  const cBarData = coalitions.map((c) => ({
    name: c.name,
    memberCount: Number(c.memberCount || 0),
    fill: c.color || "hsl(var(--chart-1))",
  }));

  const cPieData = coalitions
    .filter((c) => Number(c.memberCount || 0) > 0)
    .map((c) => ({
      name: c.name,
      value: Number(c.memberCount || 0),
      fill: c.color || "hsl(var(--chart-1))",
    }));

  return (
    <ProtectedRoute>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Coalitions</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Browse coalitions and their member parties
          </p>
        </div>

        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Coalitions
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coalitions.length}</div>
              <p className="text-xs text-muted-foreground">Active coalitions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Member Parties
              </CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCoalitionParties}</div>
              <p className="text-xs text-muted-foreground">
                Parties in coalitions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Largest Coalition
              </CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold truncate">
                {coalitions[0]?.name || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {coalitions[0]?.memberCount || 0} parties
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Coalition Membership Distribution Chart */}
        {coalitions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Coalition Membership Distribution
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Number of member parties per coalition.
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
                    config={coalitionBarConfig}
                    className="h-[300px] md:h-[400px] w-full"
                  >
                    <BarChart
                      data={cBarData}
                      margin={{
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 0,
                      }}
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
                      <Bar dataKey="memberCount" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </TabsContent>
                <TabsContent value="pie">
                  <div className="flex items-center justify-center">
                    <ChartContainer
                      config={coalitionPieConfig}
                      className="h-[300px] md:h-[400px] w-full"
                    >
                      <PieChart>
                        <Pie
                          data={cPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="40%"
                          outerRadius="70%"
                          paddingAngle={2}
                        >
                          {cPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                          <Label
                            content={({ viewBox }) => {
                              if (
                                viewBox &&
                                "cx" in viewBox &&
                                "cy" in viewBox
                              ) {
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
                                      {totalCoalitionParties}
                                    </tspan>
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) + 20}
                                      className="fill-muted-foreground text-xs md:text-sm"
                                    >
                                      Total Parties
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
        )}

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base md:text-lg">
                All Coalitions
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Coalitions ranked by number of member parties.
              </CardDescription>
            </div>
            {isInParty && (
              <Button asChild variant="default" size="sm" className="shrink-0">
                <Link to="/parties/coalitions/create">
                  <Users className="mr-2 h-4 w-4" />
                  Create Coalition
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <div className="space-y-3 md:space-y-4">
              {coalitions.map((coalition) => (
                <div
                  key={coalition.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border bg-card transition-colors"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: coalition.color,
                  }}
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="shrink-0">
                      <CoalitionLogo
                        coalition_id={coalition.id}
                        size={48}
                        color={coalition.color}
                        logo={coalition.logo}
                        name={coalition.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                      <h3 className="font-semibold text-base truncate">
                        {coalition.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {coalition.bio || "No description"}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:block sm:flex-1 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg truncate">
                      {coalition.name}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                      {coalition.bio || "No description"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-6">
                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <div className="flex items-center gap-2">
                        <Handshake className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                        <span className="text-xl md:text-2xl font-bold">
                          {coalition.memberCount}
                        </span>
                      </div>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        member parties
                      </span>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                        <span className="text-xl md:text-2xl font-bold">
                          {coalition.totalMembers}
                        </span>
                      </div>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        total members
                      </span>
                    </div>
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Link
                        to="/parties/coalitions/$id"
                        params={{
                          id: coalition.id.toString(),
                        }}
                      >
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {coalitions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  No coalitions yet. Be the first to create one!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
