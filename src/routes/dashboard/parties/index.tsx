import { Link, createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage, WikiSearch } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWikiParties } from "@/lib/server/history";
import { getCurrentUserInfo } from "@/lib/server/users";
import { getPoliticalStances } from "@/lib/server/party";
import { NewPartyDialog } from "@/components/wiki/new-party-dialog";

export const Route = createFileRoute("/dashboard/parties/")({
  validateSearch: (search: Record<string, unknown>) =>
    search.create === true || search.create === "true"
      ? { create: true as const }
      : {},
  loader: async () => {
    const [parties, currentUser, stances] = await Promise.all([
      getWikiParties(),
      getCurrentUserInfo(),
      getPoliticalStances(),
    ]);
    return { parties, currentUser, stances };
  },
  component: PartyIndex,
});

function PartyIndex() {
  const { parties, currentUser, stances } = Route.useLoaderData();
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
        <NewPartyDialog
          user={currentUser}
          stances={stances}
          autoOpen={create}
        />
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
      <PartySection title="Current parties" parties={current} />
      <PartySection title="Archived parties" parties={archived} />
    </WikiPage>
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
