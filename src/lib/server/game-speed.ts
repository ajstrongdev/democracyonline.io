import { createServerFn } from "@tanstack/react-start";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  electionNightUpdates,
  elections,
  gameSettings,
} from "@/db/schema";
import { env } from "@/env";
import {
  GAME_SPEED_MODES,
  describeGameSpeed,
  getBillStageDurationMs,
  getGameAdvanceIntervalMs,
  getGameSpeedMode,
} from "@/lib/game-speed";
import { getElectionTiming, type ElectionTiming } from "@/lib/elections/timing";
import { authMiddleware } from "@/middleware/auth";

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  // Inline (not imported from admin.ts) to avoid a module cycle:
  // admin.ts imports resolveElectionTiming from this file.
  return env.ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase(),
  );
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SPEED_MODE_KEY = "speed_mode";
const SPEED_MULTIPLIER_KEY = "speed_multiplier";
const LAST_GAME_ADVANCE_KEY = "last_game_advance_at";

export { getBillStageDurationMs, getGameAdvanceIntervalMs };

async function readSetting(
  txOrDb: Pick<typeof db, "select"> | Transaction,
  key: string,
): Promise<string | null> {
  const rows = await (txOrDb as typeof db)
    .select({ value: gameSettings.value })
    .from(gameSettings)
    .where(eq(gameSettings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

async function writeSetting(
  tx: Transaction | typeof db,
  key: string,
  value: string,
): Promise<void> {
  await tx
    .insert(gameSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: gameSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Persist the last game-advance run (owns the daily throttle server-side). */
export async function markGameAdvanceRun(now: Date): Promise<void> {
  await writeSetting(db, LAST_GAME_ADVANCE_KEY, now.toISOString());
}

export type GameSpeed = {
  mode: string;
  multiplier: number;
  pace: ReturnType<typeof describeGameSpeed>;
};

/** Current game speed. DB row wins; otherwise the env multiplier (legacy). */
export async function getGameSpeed(): Promise<GameSpeed> {
  const [storedMode, storedMultiplier] = await Promise.all([
    readSetting(db, SPEED_MODE_KEY),
    readSetting(db, SPEED_MULTIPLIER_KEY),
  ]);
  const parsed = storedMultiplier ? Number(storedMultiplier) : Number.NaN;
  const multiplier =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : env.ELECTION_TIME_MULTIPLIER > 0
        ? env.ELECTION_TIME_MULTIPLIER
        : 1;
  const preset = storedMode ? getGameSpeedMode(storedMode) : null;
  const mode =
    preset && preset.multiplier === multiplier
      ? preset.mode
      : (storedMode ?? (multiplier === 1 ? "regular" : "custom"));
  return { mode, multiplier, pace: describeGameSpeed(multiplier) };
}

/** Election timing for the active speed. Drop-in for env-based callers. */
export async function resolveElectionTiming(): Promise<ElectionTiming> {
  const { multiplier } = await getGameSpeed();
  return getElectionTiming(multiplier);
}

export async function getLastGameAdvanceAt(): Promise<Date | null> {
  const raw = await readSetting(db, LAST_GAME_ADVANCE_KEY);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const getGameSpeedFn = createServerFn().handler(async () => {
  const speed = await getGameSpeed();
  return { ...speed, modes: GAME_SPEED_MODES };
});

export const setGameSpeedFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { mode: string }) => data)
  .handler(async ({ context, data }) => {
    const email = context.user?.email;
    if (!isAdmin(email)) throw new Error("Unauthorized");
    const preset = getGameSpeedMode(data.mode);
    if (!preset) throw new Error(`Unknown game speed: ${data.mode}`);

    const now = new Date();
    return db.transaction(async (tx) => {
      const [storedMultiplier] = await Promise.all([
        readSetting(tx, SPEED_MULTIPLIER_KEY),
      ]);
      const parsed = storedMultiplier ? Number(storedMultiplier) : Number.NaN;
      const oldMultiplier = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      const ratio = oldMultiplier / preset.multiplier;

      // Rescale remaining time on every live deadline so in-flight
      // bills/elections keep their proportional progress at the new pace.
      // Scaling is monotonic, so ordering is preserved and overdue items
      // stay overdue (reconciled on the next scheduler tick).
      // NOTE on the SQL shape: bare `${now}` params have unknown type, so
      // Postgres misinfers the expression as interval. And node-pg sends
      // Dates as client-local wall time, which a direct ::timestamp cast
      // would take literally (silently shifting by the UTC offset outside
      // winter). So all arithmetic runs in timestamptz with explicit
      // AT TIME ZONE 'UTC' on both ends: immune to client and session TZ.
      const rescaledBills = await tx
        .update(bills)
        .set({
          stageEndsAt: sql`(((${now}::timestamptz + (((${bills.stageEndsAt} AT TIME ZONE 'UTC') - (${now}::timestamptz)) * ${ratio})) AT TIME ZONE 'UTC'))`,
        })
        .where(isNotNull(bills.stageEndsAt))
        .returning({ id: bills.id });

      const rescaledCandidacy = await tx
        .update(elections)
        .set({
          candidacyEndsAt: sql`(((${now}::timestamptz + (((${elections.candidacyEndsAt} AT TIME ZONE 'UTC') - (${now}::timestamptz)) * ${ratio})) AT TIME ZONE 'UTC'))`,
        })
        .where(
          and(
            eq(elections.status, "CANDIDACY"),
            isNotNull(elections.candidacyEndsAt),
          ),
        )
        .returning({ election: elections.election });

      const rescaledVoting = await tx
        .update(elections)
        .set({
          votingEndsAt: sql`(((${now}::timestamptz + (((${elections.votingEndsAt} AT TIME ZONE 'UTC') - (${now}::timestamptz)) * ${ratio})) AT TIME ZONE 'UTC'))`,
        })
        .where(
          and(
            eq(elections.status, "VOTING"),
            isNotNull(elections.votingEndsAt),
          ),
        )
        .returning({ election: elections.election });

      const rescaledNight = await tx
        .update(elections)
        .set({
          electionNightEndsAt: sql`(((${now}::timestamptz + (((${elections.electionNightEndsAt} AT TIME ZONE 'UTC') - (${now}::timestamptz)) * ${ratio})) AT TIME ZONE 'UTC'))`,
        })
        .where(
          and(
            eq(elections.status, "ELECTION_NIGHT"),
            isNotNull(elections.electionNightEndsAt),
          ),
        )
        .returning({ election: elections.election });

      // CONCLUDED elections store concludedAt; re-anchor so the remaining
      // quiet period scales too.
      const concludedRows = await tx
        .select({
          election: elections.election,
          status: elections.status,
          concludedAt: elections.concludedAt,
        })
        .from(elections)
        .where(eq(elections.status, "CONCLUDED"));
      const newTiming = getElectionTiming(preset.multiplier);
      const oldTiming = getElectionTiming(oldMultiplier);
      let rescaledConcluded = 0;
      for (const row of concludedRows) {
        if (!row.concludedAt) continue;
        const remainingMs =
          row.concludedAt.getTime() +
          oldTiming.concludedDurationMs[
            row.election as "President" | "Senate"
          ] -
          now.getTime();
        const nextConcludedAt = new Date(
          now.getTime() +
            remainingMs * ratio -
            newTiming.concludedDurationMs[
              row.election as "President" | "Senate"
            ],
        );
        await tx
          .update(elections)
          .set({ concludedAt: nextConcludedAt })
          .where(eq(elections.election, row.election));
        rescaledConcluded += 1;
      }

      const rescaledReveals = await tx
        .update(electionNightUpdates)
        .set({
          revealAt: sql`(((${now}::timestamptz + (((${electionNightUpdates.revealAt} AT TIME ZONE 'UTC') - (${now}::timestamptz)) * ${ratio})) AT TIME ZONE 'UTC'))`,
        })
        .where(gt(electionNightUpdates.revealAt, now))
        .returning({ sequence: electionNightUpdates.sequence });

      await writeSetting(tx, SPEED_MODE_KEY, preset.mode);
      await writeSetting(tx, SPEED_MULTIPLIER_KEY, String(preset.multiplier));
      await writeSetting(tx, LAST_GAME_ADVANCE_KEY, now.toISOString());

      return {
        success: true,
        mode: preset.mode,
        multiplier: preset.multiplier,
        pace: describeGameSpeed(preset.multiplier),
        rescaled: {
          bills: rescaledBills.length,
          candidacy: rescaledCandidacy.length,
          voting: rescaledVoting.length,
          electionNight: rescaledNight.length,
          concluded: rescaledConcluded,
          reveals: rescaledReveals.length,
        },
      };
    });
  });
