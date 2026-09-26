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
import { BarChart3, Handshake, Users } from "lucide-react";
import type { ChartConfig } from "@/components/ui/chart";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import GenericSkeleton from "@/components/generic-skeleton";
import CoalitionLogo from "@/components/coalition-logo";
import {
  getCoalitionManagementState,
  getCoalitions,
} from "@/lib/server/coalitions";
import { getCurrentUserInfo } from "@/lib/server/users";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";

export const Route = createFileRoute("/dashboard/parties/coalitions/")({
  loader: async () => {
    const [coalitionsList, userInfo, management] = await Promise.all([
      getCoalitions(),
      getCurrentUserInfo(),
      getCoalitionManagementState(),
    ]);
    return { coalitions: coalitionsList, userInfo, management };
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
  const { coalitions, userInfo, management } = Route.useLoaderData();
  const activeCoalitions = coalitions.filter(
    (coalition) => !coalition.archivedAt,
  );
  const archivedCoalitions = coalitions.filter(
    (coalition) => coalition.archivedAt,
  );
  const userData = useUserData(userInfo);
  const canCreate =
    userData?.partyId === management.partyId &&
    management.isPartyLeader &&
    management.coalitionId == null;

  const totalCoalitionParties = activeCoalitions.reduce(
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

  const coalitionPieConfig: ChartConfig = activeCoalitions.reduce(
    (config, c, idx) => {
      config[c.id.toString()] = {
        label: c.name,
        color: c.color || `hsl(var(--chart-${(idx % 5) + 1}))`,
      };
      return config;
    },
    {} as ChartConfig,
  );

  const cBarData = activeCoalitions.map((c) => ({
    name: c.name,
    memberCount: Number(c.memberCount || 0),
    fill: c.color || "hsl(var(--chart-1))",
  }));

  const cPieData = activeCoalitions
    .filter((c) => Number(c.memberCount || 0) > 0)
    .map((c) => ({
      name: c.name,
      value: Number(c.memberCount || 0),
      fill: c.color || "hsl(var(--chart-1))",
    }));

  return (
    <ProtectedRoute>
      <WikiPage>
        <WikiHeader
          eyebrow={`${coalitions.length} organizations`}
          title="Political coalitions"
          description="Alliances of political parties, their membership, and their place in the Oscana political record."
          status={
            canCreate ? (
              <Button asChild size="sm">
                <Link to="/dashboard/parties/coalitions/create">
                  <Users className="h-4 w-4" />
                  Create coalition
                </Link>
              </Button>
            ) : undefined
          }
        />

        <WikiStatGrid>
          <WikiStat
            label="Coalitions"
            value={activeCoalitions.length}
            detail="Active organizations"
          />
          <WikiStat
            label="Member parties"
            value={totalCoalitionParties}
            detail="Across all coalitions"
          />
          <WikiStat
            label="Largest coalition"
            value={activeCoalitions[0]?.name || "Not recorded"}
            detail={`${activeCoalitions[0]?.memberCount || 0} parties`}
          />
        </WikiStatGrid>

        {activeCoalitions.length > 0 && (
          <WikiSection
            title="Membership distribution"
            description="Number of member parties represented in each coalition."
            icon={BarChart3}
          >
            <Card className="rounded-sm shadow-none">
              <CardContent className="px-2 py-4 sm:px-6">
                <Tabs defaultValue="bar" className="w-full">
                  <TabsList className="mb-4 grid w-full grid-cols-2 rounded-sm sm:ml-auto sm:w-72">
                    <TabsTrigger value="bar">Bar chart</TabsTrigger>
                    <TabsTrigger value="pie">Pie chart</TabsTrigger>
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
                                        className="fill-foreground font-serif text-2xl font-bold md:text-3xl"
                                      >
                                        {totalCoalitionParties}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 20}
                                        className="fill-muted-foreground text-xs md:text-sm"
                                      >
                                        Total parties
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
          </WikiSection>
        )}

        <WikiSection
          title="Coalition directory"
          description="Coalitions ranked by number of member parties."
          icon={Handshake}
        >
          {activeCoalitions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activeCoalitions.map((coalition) => (
                <Link
                  key={coalition.id}
                  to="/dashboard/parties/coalitions/$id"
                  params={{ id: coalition.id.toString() }}
                  className="group flex min-w-0 flex-col rounded-sm border bg-card shadow-none transition-colors hover:border-primary"
                  style={{
                    borderTopWidth: "4px",
                    borderTopColor: coalition.color,
                  }}
                >
                  <div className="flex min-w-0 items-start gap-4 p-4 sm:p-5">
                    <div className="shrink-0 rounded-sm border bg-background p-1">
                      <CoalitionLogo
                        coalition_id={coalition.id}
                        size={48}
                        color={coalition.color}
                        logo={coalition.logo}
                        name={coalition.name}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-xl font-bold group-hover:text-primary">
                        {coalition.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {coalition.bio || "No summary has been written."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-2 divide-x border-t text-center font-mono text-xs text-muted-foreground">
                    <div className="px-3 py-3">
                      <strong className="block text-lg text-foreground">
                        {coalition.memberCount}
                      </strong>
                      member parties
                    </div>
                    <div className="px-3 py-3">
                      <strong className="block text-lg text-foreground">
                        {coalition.totalMembers}
                      </strong>
                      total members
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <WikiEmpty>No coalitions have been formed yet.</WikiEmpty>
          )}
        </WikiSection>
        <WikiSection
          title="Archived coalitions"
          description="Coalitions retained after their final member party departed."
          icon={Handshake}
        >
          {archivedCoalitions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {archivedCoalitions.map((coalition) => (
                <Link
                  key={coalition.id}
                  to="/dashboard/parties/coalitions/$id"
                  params={{ id: coalition.id.toString() }}
                  className="group flex min-w-0 flex-col rounded-sm border bg-card opacity-90 shadow-none transition-colors hover:border-primary"
                  style={{
                    borderTopWidth: "4px",
                    borderTopColor: coalition.color,
                  }}
                >
                  <div className="flex min-w-0 items-start gap-4 p-4 sm:p-5">
                    <CoalitionLogo
                      coalition_id={coalition.id}
                      size={48}
                      color={coalition.color}
                      logo={coalition.logo}
                      name={coalition.name}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-xl font-bold group-hover:text-primary">
                        {coalition.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {coalition.bio || "No summary has been written."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto border-t px-4 py-3 font-mono text-xs text-muted-foreground">
                    Archived organization
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <WikiEmpty>No coalitions have been archived.</WikiEmpty>
          )}
        </WikiSection>
      </WikiPage>
    </ProtectedRoute>
  );
}
