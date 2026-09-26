import { Link, createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { ChartConfig } from "@/components/ui/chart";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiPage,
  WikiSearch,
  WikiSection,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getWikiParties } from "@/lib/server/history";
import { getCurrentUserInfo } from "@/lib/server/users";
import { NewPartyDialog } from "@/components/wiki/new-party-dialog";

export const Route = createFileRoute("/dashboard/parties/")({
  validateSearch: (search: Record<string, unknown>) =>
    search.create === true || search.create === "true"
      ? { create: true as const }
      : {},
  loader: async () => {
    const [parties, currentUser] = await Promise.all([
      getWikiParties(),
      getCurrentUserInfo(),
    ]);
    return { parties, currentUser };
  },
  component: PartyIndex,
});

function PartyIndex() {
  const { parties, currentUser } = Route.useLoaderData();
  const { create } = Route.useSearch();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = parties.filter((party) =>
    `${party.name} ${party.leaning ?? ""}`
      .toLowerCase()
      .includes(deferredQuery),
  );
  const current = filtered.filter((party) => party.current);
  const archived = filtered.filter((party) => !party.current);
  return (
    <WikiPage>
      <WikiHeader
        eyebrow={`${parties.length} articles`}
        title="Political parties"
        description="Current and historical parties, their electoral records, representation, membership, and community-written histories."
      />
      <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
        <NewPartyDialog user={currentUser} autoOpen={create} />
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/parties/primaries">Presidential primaries</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/parties/coalitions">Coalitions</Link>
        </Button>
      </nav>
      <WikiSearch
        value={query}
        onChange={setQuery}
        placeholder="Search the party archive"
        resultCount={filtered.length}
      />
      <PartyComparison parties={parties.filter((party) => party.current)} />
      <PartySection title="Active parties" parties={current} />
      <PartySection title="Archived parties" parties={archived} />
    </WikiPage>
  );
}

const comparisonConfig = {
  memberCount: { label: "Members", color: "var(--chart-1)" },
} satisfies ChartConfig;

function PartyComparison({ parties }: { parties: Array<PartySummary> }) {
  if (!parties.length) return null;
  const height = Math.max(300, parties.length * 48);

  return (
    <WikiSection
      title="Party comparison"
      description="Current membership across active parties."
      icon={BarChart3}
    >
      <div className="overflow-x-auto">
        <ChartContainer
          config={comparisonConfig}
          className="min-w-[42rem] w-full"
          style={{ height }}
        >
          <BarChart
            accessibilityLayer
            data={parties}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={132}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="memberCount" radius={[0, 3, 3, 0]}>
              {parties.map((party) => (
                <Cell key={party.id} fill={party.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </WikiSection>
  );
}

type PartySummary = ReturnType<typeof Route.useLoaderData>["parties"][number];

function PartySection({
  title,
  parties,
}: {
  title: string;
  parties: Array<PartySummary>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between border-b pb-2">
        <h2 className="font-serif text-2xl font-semibold">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {parties.length}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {parties.map((party) => (
          <Link
            key={party.id}
            to="/dashboard/parties/$partyId"
            params={{ partyId: String(party.id) }}
          >
            <Card className="h-full overflow-hidden rounded-sm shadow-none transition-colors hover:border-primary">
              <div className="h-1.5" style={{ backgroundColor: party.color }} />
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-xl font-bold">{party.name}</h2>
                  <Badge variant={party.current ? "default" : "secondary"}>
                    {party.current ? "Current" : "Archived"}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {party.bio || party.leaning || "No summary has been written."}
                </p>
                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center font-mono text-xs">
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.memberCount}
                    </strong>
                    members
                  </span>
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.appearances}
                    </strong>
                    candidacies
                  </span>
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.victories}
                    </strong>
                    elected
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!parties.length && (
          <p className="col-span-full py-6 text-sm text-muted-foreground">
            No matching parties.
          </p>
        )}
      </div>
    </section>
  );
}
