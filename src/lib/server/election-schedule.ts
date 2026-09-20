import type { ElectionTiming } from "@/lib/elections/timing";
import { db } from "@/db";
import { elections } from "@/db/schema";
import { DEFAULT_ELECTION_TIMING } from "@/lib/elections/timing";

function initialElection(
  election: "President" | "Senate",
  now: Date,
  timing: ElectionTiming,
) {
  const duration = timing.candidacyDurationMs[election];
  return {
    election,
    status: "CANDIDACY" as const,
    seats: election === "President" ? 1 : 9,
    cycle: 1,
    candidacyStartsAt: now,
    candidacyEndsAt: new Date(now.getTime() + duration),
  };
}

export async function ensureElectionSchedule(options?: {
  now?: Date;
  timing?: ElectionTiming;
}) {
  const now = options?.now ?? new Date();
  const timing = options?.timing ?? DEFAULT_ELECTION_TIMING;
  await db
    .insert(elections)
    .values([
      initialElection("President", now, timing),
      initialElection("Senate", now, timing),
    ])
    .onConflictDoNothing();

}
