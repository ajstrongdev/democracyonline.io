const DAY_MS = 24 * 60 * 60 * 1000;

export type ElectionTiming = {
  candidacyDurationMs: Record<"President" | "Senate", number>;
  votingDurationMs: Record<"President" | "Senate", number>;
  electionNightDurationMs: number;
  concludedDurationMs: Record<"President" | "Senate", number>;
  revealUpdates: number;
};

export const DEFAULT_ELECTION_TIMING: ElectionTiming = {
  candidacyDurationMs: { President: 10 * DAY_MS, Senate: 4 * DAY_MS },
  votingDurationMs: { President: 10 * DAY_MS, Senate: 4 * DAY_MS },
  electionNightDurationMs: 12 * 60 * 60 * 1000,
  concludedDurationMs: { President: 8 * DAY_MS, Senate: 6 * DAY_MS },
  revealUpdates: 144,
};

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function londonWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour);
  let candidate = wallClockUtc;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = londonParts(new Date(candidate));
    const representedAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    candidate += wallClockUtc - representedAsUtc;
  }
  return new Date(candidate);
}

export function getNextLondonElectionNightWindow(now: Date): {
  startsAt: Date;
  endsAt: Date;
} {
  const local = londonParts(now);
  const localDate = new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day + (local.hour >= 20 ? 1 : 0),
    ),
  );
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth() + 1;
  const day = localDate.getUTCDate();
  return {
    startsAt: londonWallTimeToUtc(year, month, day, 20),
    endsAt: londonWallTimeToUtc(year, month, day + 1, 8),
  };
}

export function getLondonElectionNightWindowForDate(date: Date): {
  startsAt: Date;
  endsAt: Date;
} {
  const local = londonParts(date);
  return {
    startsAt: londonWallTimeToUtc(local.year, local.month, local.day, 20),
    endsAt: londonWallTimeToUtc(local.year, local.month, local.day + 1, 8),
  };
}
