const allowedPushHosts = new Set([
  "fcm.googleapis.com",
  "fcm-xm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

/** Never let a client turn the delivery worker into an arbitrary HTTP client. */
export function isTrustedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (allowedPushHosts.has(url.hostname) || url.hostname.endsWith(".push.apple.com"));
  } catch {
    return false;
  }
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function inQuietHours(
  now: Date,
  { quietStart, quietEnd, timeZone }: { quietStart: number | null; quietEnd: number | null; timeZone: string },
) {
  if (quietStart === null || quietEnd === null) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const at = hour * 60 + minute;
  return quietStart < quietEnd
    ? at >= quietStart && at < quietEnd
    : at >= quietStart || at < quietEnd;
}
