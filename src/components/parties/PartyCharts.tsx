"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  YAxis,
  Pie,
  PieChart,
  Cell,
  Label,
} from "recharts";
import { Party } from "@/app/parties/page";

interface PartyStats {
  party: Party;
  memberCount: number;
}

interface PartyChartsProps {
  partyStats: PartyStats[];
}

export function PartyCharts({ partyStats }: PartyChartsProps) {
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

  return (
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
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
  );
}
