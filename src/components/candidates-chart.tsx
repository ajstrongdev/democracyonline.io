import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy } from "lucide-react";
import type { Candidate } from "@/lib/server/elections";
import type { ChartConfig } from "@/components/ui/chart";
import { CandidateAffiliationBadges } from "@/components/candidate-affiliation-badges";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const chartConfig = {
  points: { label: "Points", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function CandidatesChart({
  election,
  candidates,
  seats = 1,
  status,
}: {
  election: "President" | "Senate";
  candidates: Array<Candidate>;
  seats?: number;
  status: string;
}) {
  const chartData = [...candidates]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.id - b.id)
    .map((candidate, index) => ({
      id: candidate.id,
      name: candidate.username,
      points: candidate.votes ?? 0,
      color: candidate.partyColor ?? "var(--muted-foreground)",
      projected: index < seats,
      candidate,
    }));
  const totalPoints = chartData.reduce(
    (total, candidate) => total + candidate.points,
    0,
  );
  const chartEntries = chartData.filter((entry) => entry.points > 0);
  const winners =
    status === "Concluded"
      ? chartData.filter((entry) => entry.candidate.haswon)
      : status === "Voting" && totalPoints > 0
        ? chartData.slice(0, seats)
        : [];
  const winnerLabel = status === "Concluded" ? "Elected" : "Projected";
  const chartHeight = Math.max(340, chartEntries.length * 24);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="font-serif text-2xl">Results dashboard</CardTitle>
        <CardDescription>
          Ranked-ballot vote share and point totals by candidate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        {winners.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-primary/25 bg-primary/5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-primary/15 bg-primary/8 px-4 py-3 sm:px-6">
              <span className="rounded-full bg-primary/10 p-2">
                <Trophy className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                  {winnerLabel}{" "}
                  {election === "President" ? "winner" : "winners"}
                </p>
                <p className="font-serif text-xl font-black sm:text-2xl">
                  {election === "President"
                    ? "Leading the race for President"
                    : `Currently holding the ${seats} Senate seats`}
                </p>
              </div>
            </div>
            <div className="grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
              {winners.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 bg-card px-4 py-4 sm:px-6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono font-black text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">{entry.name}</p>
                    <p className="font-mono text-sm text-muted-foreground">
                      {entry.points} points
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <CandidateAffiliationBadges candidate={entry.candidate} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {chartData.length === 0 || totalPoints === 0 ? (
          <div className="flex h-56 items-center justify-center border border-dashed text-sm text-muted-foreground">
            Results will appear when ballots have been counted.
          </div>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="overflow-hidden rounded-xl border bg-background/60 shadow-xs">
              <div className="border-b px-4 py-3">
                <h3 className="font-serif text-lg font-bold">Vote share</h3>
                <p className="text-xs text-muted-foreground">
                  Each slice represents a candidate's share of all points
                </p>
              </div>
              <ChartContainer
                config={chartConfig}
                className="mx-auto w-full max-w-xl"
                style={{ height: chartHeight }}
              >
                <PieChart accessibilityLayer>
                  <Pie
                    data={chartEntries}
                    dataKey="points"
                    nameKey="name"
                    innerRadius="50%"
                    outerRadius="78%"
                    paddingAngle={2}
                  >
                    {chartEntries.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={entry.color}
                        fillOpacity={entry.projected ? 1 : 0.68}
                        stroke={entry.projected ? entry.color : "none"}
                      />
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
                                className="fill-foreground text-2xl font-black"
                              >
                                {totalPoints}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 20}
                                className="fill-muted-foreground text-xs"
                              >
                                total points
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value, payload) =>
                          payload?.[0]?.payload?.name ?? value
                        }
                      />
                    }
                  />
                </PieChart>
              </ChartContainer>
            </section>

            <section className="overflow-hidden rounded-xl border bg-background/60 shadow-xs">
              <div className="border-b px-4 py-3">
                <h3 className="font-serif text-lg font-bold">Point totals</h3>
                <p className="text-xs text-muted-foreground">
                  Candidates are ordered by their current ranked-ballot score
                </p>
              </div>
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: chartHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={chartEntries}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 16, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="points" radius={[0, 6, 6, 0]}>
                    {chartEntries.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={entry.color}
                        fillOpacity={entry.projected ? 1 : 0.62}
                        stroke={entry.projected ? entry.color : "none"}
                        strokeWidth={entry.projected ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </section>

            <section className="overflow-hidden rounded-xl border bg-background/60 shadow-xs xl:col-span-2">
              <div className="border-b px-4 py-3">
                <h3 className="font-serif text-lg font-bold">Candidate key</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                {chartData.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex min-w-0 flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="min-w-0 truncate font-semibold">
                      {entry.name}
                    </span>
                    <CandidateAffiliationBadges candidate={entry.candidate} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
