import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Pie, PieChart, Cell, ResponsiveContainer, Label } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { sortCandidatesByParty } from "@/lib/utils/sort-candidates-by-party";

const chartConfig: ChartConfig = {
  a: { label: "Candidate A", color: "var(--chart-1)" },
  b: { label: "Candidate B", color: "var(--chart-2)" },
  c: { label: "Candidate C", color: "var(--chart-3)" },
};

export type CandidateChartData = {
  id: number;
  username: string;
  votes: number | null;
  partyName: string | null;
  partyColor: string | null;
};

interface CandidatesChartProps {
  candidates: CandidateChartData[];
}

export function CandidatesChart({ candidates }: CandidatesChartProps) {
  const sortedCandidates = sortCandidatesByParty(candidates);
  const totalVotes = sortedCandidates.reduce(
    (sum, c) => sum + (c.votes ?? 0),
    0,
  );

  return (
    <Card className="row-span-2 flex items-center justify-center">
      <CardContent className="w-full h-full flex flex-col items-center justify-center pt-6">
        <ChartContainer
          config={chartConfig}
          className="w-48 h-48 flex items-center justify-center"
        >
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={sortedCandidates.map((c) => ({
                  name: `${c.username} `,
                  value: c.votes ?? 0,
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius={75}
                outerRadius={95}
                paddingAngle={3}
                labelLine={false}
              >
                {sortedCandidates.map((c, idx) => (
                  <Cell key={idx} fill={c.partyColor || "grey"} />
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
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalVotes}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Votes Cast
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {sortedCandidates.map((c, idx) => (
            <div key={idx} className="flex flex-col items-center text-sm">
              <div
                className="w-3 h-3 rounded-sm mb-1"
                style={{ backgroundColor: c.partyColor || "grey" }}
              />
              <span className="text-muted-foreground">{c.votes ?? 0}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
