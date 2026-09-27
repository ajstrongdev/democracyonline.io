export const onlineWithinMs = 5 * 60 * 1_000;

export function isPlayerOnline({
  lastSeenAt,
  isActive,
  archivedAt,
  now,
}: {
  lastSeenAt: Date | string | null;
  isActive: boolean | null;
  archivedAt: Date | string | null;
  now: Date;
}): boolean {
  if (!isActive || archivedAt || !lastSeenAt) return false;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  return (
    Number.isFinite(lastSeenMs) &&
    lastSeenMs <= now.getTime() &&
    now.getTime() - lastSeenMs < onlineWithinMs
  );
}

export function formatPlayerLastSeen(
  lastSeenAt: Date | string | null,
  now: Date,
  locale: string | undefined,
): string {
  if (!lastSeenAt) return "Unknown";
  const elapsedMs = now.getTime() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(elapsedMs)) return "Unknown";
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  if (minutes < 1)
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      0,
      "second",
    );
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return format.format(-days, "day");
  if (days < 365) return format.format(-Math.floor(days / 30), "month");
  return format.format(-Math.floor(days / 365), "year");
}
