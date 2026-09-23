const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Base pace (regular / 1x). Mirrors DEFAULT_ELECTION_TIMING plus the 8h bill
// stages and the daily game-advance tick.
const BASE_PRES_CYCLE_MS =
  10 * DAY_MS + 10 * DAY_MS + 12 * HOUR_MS + 8 * DAY_MS;
const BASE_SENATE_CYCLE_MS =
  4 * DAY_MS + 4 * DAY_MS + 12 * HOUR_MS + 6 * DAY_MS;
const BASE_NIGHT_MS = 12 * HOUR_MS;
const BASE_BILL_STAGE_MS = 8 * HOUR_MS;
const BASE_GAME_TICK_MS = 24 * HOUR_MS;

export type GameSpeedMode = {
  mode: string;
  multiplier: number;
  label: string;
  blurb: string;
};

export const GAME_SPEED_MODES: Array<GameSpeedMode> = [
  {
    mode: "super-slow",
    multiplier: 0.25,
    label: "Super slow",
    blurb: "Quarter pace. Long deliberative; pres cycle ≈112 days.",
  },
  {
    mode: "slow",
    multiplier: 0.5,
    label: "Slow",
    blurb: "Half pace. Pres cycle ≈56 days, senate ≈28 days.",
  },
  {
    mode: "regular",
    multiplier: 1,
    label: "Regular",
    blurb: "Intended pace. Pres cycle 28 days, senate 14 days.",
  },
  {
    mode: "fast",
    multiplier: 2,
    label: "Fast",
    blurb: "Double pace. Pres cycle 14 days, senate 7 days.",
  },
  {
    mode: "super-fast",
    multiplier: 72,
    label: "Super fast",
    blurb: "72x. Pres cycle ≈9.5h, bill stages ≈7min.",
  },
  {
    mode: "dev",
    multiplier: 720,
    label: "Dev",
    blurb: "720x for beta testing. Pres cycle ≈57min, bill stages ≈40s.",
  },
  {
    mode: "dev-relaxed",
    multiplier: 2,
    label: "Dev relaxed",
    blurb: "Fast pace (2x) for beta environments that still want real debate.",
  },
];

export function getGameSpeedMode(mode: string): GameSpeedMode | null {
  return GAME_SPEED_MODES.find((preset) => preset.mode === mode) ?? null;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

export type GameSpeedPace = {
  presCycle: string;
  senateCycle: string;
  electionNight: string;
  billStage: string;
  gameTick: string;
};
/** Human-readable pace summary for a multiplier. Client-safe. */
export function describeGameSpeed(multiplier: number): GameSpeedPace {
  const m = multiplier > 0 ? multiplier : 1;
  return {
    presCycle: `≈${formatDuration(BASE_PRES_CYCLE_MS / m)}`,
    senateCycle: `≈${formatDuration(BASE_SENATE_CYCLE_MS / m)}`,
    electionNight: formatDuration(BASE_NIGHT_MS / m),
    billStage: formatDuration(BASE_BILL_STAGE_MS / m),
    gameTick: formatDuration(BASE_GAME_TICK_MS / m),
  };
}

/** Bill stage length at a multiplier (8h at regular). Floored at 1s. */
export function getBillStageDurationMs(multiplier: number): number {
  const m = multiplier > 0 ? multiplier : 1;
  return Math.max(1_000, Math.round(BASE_BILL_STAGE_MS / m));
}

/** Game-advance tick at a multiplier (24h at regular). Floored at 60s. */
export function getGameAdvanceIntervalMs(multiplier: number): number {
  const m = multiplier > 0 ? multiplier : 1;
  return Math.max(60_000, Math.round(BASE_GAME_TICK_MS / m));
}
