import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "@/components/ui/chart"
import { Pie, PieChart, Cell, ResponsiveContainer, Label } from "recharts"
import { Card, CardContent } from "@/components/ui/card";

const chartConfig: ChartConfig = {
    a: { label: "Candidate A", color: "var(--chart-1)" },
    b: { label: "Candidate B", color: "var(--chart-2)" },
    c: { label: "Candidate C", color: "var(--chart-3)" },
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CandidatesChart({ candidates }: { candidates: any[] }) {
    candidates.sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))

    return (
        <Card className="row-span-2 h-[24rem] flex items-center justify-center">
            <CardContent className="w-full h-full flex flex-col items-center justify-center pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="w-48 h-48 flex items-center justify-center"
                >
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={candidates.map((c: any) => ({
                                    name: `${c.username}⠀`,
                                    value: c.votes ?? 0,
                                }))}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={75}
                                outerRadius={95}
                                paddingAngle={3}
                                labelLine={false}
                            >
                                {candidates.map((c: any, idx: number) => (
                                    <Cell
                                        key={idx}
                                        fill={c.color || `grey`}
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
                                                        className="fill-foreground text-3xl font-bold"
                                                    >
                                                        {candidates.reduce((sum: number, c: any) => sum + (c.votes ?? 0), 0)}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 24}
                                                        className="fill-muted-foreground"
                                                    >
                                                        Votes Cast
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                    {candidates.map((c: any, idx: number) => (
                        <div key={idx} className="flex flex-col items-center text-sm">
                            <div
                                className="w-3 h-3 rounded-sm mb-1"
                                style={{ backgroundColor: c.color || `grey` }}
                            />
                            <span className="text-muted-foreground">{c.votes ?? 0}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}