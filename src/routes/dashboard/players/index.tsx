import { Link, createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { PartyMark, WikiHeader } from "@/components/wiki/wiki-header";
import { WikiEmpty, WikiPage, WikiSearch } from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getWikiPlayers } from "@/lib/server/history/history";
import { PlayerAvatar } from "@/components/players/player-avatar";
import {
  PlayerLastSeen,
  usePlayerPresenceData,
  usePresenceClock,
} from "@/components/players/player-last-seen";
import { isPlayerOnline } from "@/lib/player-presence";

export const Route = createFileRoute("/dashboard/players/")({
  loader: () => getWikiPlayers(),
  component: PlayersIndex,
});

function PlayersIndex() {
  const players = Route.useLoaderData();
  const now = usePresenceClock();
  const presence = usePlayerPresenceData();
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = players.filter((player) => {
    const matchesSearch =
      `${player.username} ${player.partyName ?? ""} ${player.role ?? ""}`
        .toLowerCase()
        .includes(deferredQuery);
    if (!matchesSearch) return false;
    if (!onlineOnly) return true;
    const playerPresence = presence[player.id] ?? player;
    return now !== null && isPlayerOnline({ ...playerPresence, now });
  });
  const sortedPlayers = [...filtered].sort((a, b) => {
    const aPresence = presence[a.id] ?? a;
    const bPresence = presence[b.id] ?? b;
    const aOnline = now !== null && isPlayerOnline({ ...aPresence, now });
    const bOnline = now !== null && isPlayerOnline({ ...bPresence, now });
    if (aOnline !== bOnline) return aOnline ? -1 : 1;

    const aLastSeen = aPresence.lastSeenAt
      ? new Date(aPresence.lastSeenAt).getTime()
      : Number.NEGATIVE_INFINITY;
    const bLastSeen = bPresence.lastSeenAt
      ? new Date(bPresence.lastSeenAt).getTime()
      : Number.NEGATIVE_INFINITY;
    return bLastSeen - aLastSeen;
  });

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
        filterControl={
          <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border bg-muted/50 px-2 text-xs text-foreground transition-colors hover:bg-muted sm:gap-2 sm:px-3 sm:text-sm">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(event) => setOnlineOnly(event.target.checked)}
              className="size-4 accent-primary"
            />
            <span
              className="size-2 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            Online now
          </label>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPlayers.map((player) => (
          <Link
            key={player.id}
            to="/dashboard/players/$playerId"
            params={{ playerId: String(player.id) }}
          >
            <Card className="h-full rounded-sm shadow-none transition-colors hover:border-primary">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar
                      username={player.username}
                      photoUrl={player.photoUrl}
                    />
                    <h2 className="break-words font-serif text-xl font-bold">
                      {player.username}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase"
                  >
                    {player.role ?? "Representative"}
                  </Badge>
                  {player.archivedAt && (
                    <Badge variant="secondary">Archived</Badge>
                  )}
                </div>
                <div className="min-w-0 overflow-hidden">
                  <PartyMark
                    name={player.partyName}
                    color={player.partyColor}
                  />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {player.bio || "No biography provided."}
                </p>
                <p className="text-xs text-muted-foreground">
                  <PlayerLastSeen
                    presence={presence[player.id] ?? player}
                    now={now}
                    prefix="Last seen: "
                  />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!filtered.length && (
          <div className="col-span-full">
            <WikiEmpty>
              {onlineOnly
                ? "No online players match this search."
                : "No players match this search."}
            </WikiEmpty>
          </div>
        )}
      </section>
    </WikiPage>
  );
}
