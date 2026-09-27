import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { formatPlayerLastSeen, isPlayerOnline } from "@/lib/player-presence";
import { getPlayerPresence } from "@/lib/server/player-presence";

export type PlayerPresence = {
  lastSeenAt: Date | string | null;
  isActive: boolean | null;
  archivedAt: Date | string | null;
};

export function usePresenceClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function usePlayerPresenceData(playerId?: number) {
  const [snapshots, setSnapshots] = useState<Record<number, PlayerPresence>>(
    {},
  );

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void getPlayerPresence({ data: { playerId } })
        .then((rows) => {
          if (active)
            setSnapshots(Object.fromEntries(rows.map((row) => [row.id, row])));
        })
        .catch((error: unknown) =>
          console.error("Could not refresh player presence", error),
        );
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [playerId]);

  return snapshots;
}

export function PlayerLastSeen({
  presence,
  now,
  prefix,
}: {
  presence: PlayerPresence;
  now: Date | null;
  prefix?: ReactNode;
}) {
  // Render the same placeholder during SSR and the first client render so
  // browser-specific locale/time zone formatting cannot cause hydration drift.
  if (!now) return <span>{prefix}…</span>;

  const lastSeenAt = presence.lastSeenAt ? new Date(presence.lastSeenAt) : null;
  if (!lastSeenAt || !Number.isFinite(lastSeenAt.getTime()))
    return <span>{prefix}Unknown</span>;

  const online = isPlayerOnline({ ...presence, now });
  const locale = navigator.language;
  const exact = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(lastSeenAt);

  return (
    <span title={exact} className="inline-flex items-center gap-1.5">
      {!online && prefix}
      {online && (
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-emerald-500"
        />
      )}
      <time
        dateTime={lastSeenAt.toISOString()}
        className={
          online ? "text-emerald-700 dark:text-emerald-400" : undefined
        }
      >
        {online ? "Online" : formatPlayerLastSeen(lastSeenAt, now, locale)}
      </time>
    </span>
  );
}
