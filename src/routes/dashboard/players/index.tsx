import { Link, createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { PartyMark, WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage, WikiSearch } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getWikiPlayers } from "@/lib/server/history";
import { PlayerAvatar } from "@/components/players/player-avatar";

export const Route = createFileRoute("/dashboard/players/")({
  loader: () => getWikiPlayers(),
  component: PlayersIndex,
});

function PlayersIndex() {
  const players = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = players.filter((player) =>
    `${player.username} ${player.partyName ?? ""} ${player.role ?? ""}`
      .toLowerCase()
      .includes(deferredQuery),
  );

  return (
    <WikiPage>
      <WikiHeader
        eyebrow={`${players.length} articles`}
        title="Players"
        description="Political careers, election results, legislation, and voting records for every player."
      />
      <WikiSearch
        value={query}
        onChange={setQuery}
        placeholder="Search players, parties, or offices"
        resultCount={filtered.length}
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((player) => (
          <Link
            key={player.id}
            to="/dashboard/players/$playerId"
            params={{ playerId: String(player.id) }}
          >
            <Card className="h-full rounded-sm shadow-none transition-colors hover:border-primary">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                   <div className="flex min-w-0 items-center gap-3"><PlayerAvatar username={player.username} photoUrl={player.photoUrl} /><h2 className="break-words font-serif text-xl font-bold">{player.username}</h2></div>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {player.role ?? "Representative"}
                  </Badge>
                </div>
                <PartyMark name={player.partyName} color={player.partyColor} />
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {player.bio || "No biography provided."}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!filtered.length && (
          <div className="col-span-full">
            <WikiEmpty>No players match this search.</WikiEmpty>
          </div>
        )}
      </section>
    </WikiPage>
  );
}
