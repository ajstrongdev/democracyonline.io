import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { electionNightUpdates } from "@/db/schema";

export async function getElectionCoverage(
  election: "President" | "Senate",
  cycle: number,
  now = new Date(),
) {
  const [revealed, finalUpdate] = await Promise.all([
    db
      .select()
      .from(electionNightUpdates)
      .where(
        and(
          eq(electionNightUpdates.election, election),
          eq(electionNightUpdates.cycle, cycle),
          lte(electionNightUpdates.revealAt, now),
        ),
      )
      .orderBy(asc(electionNightUpdates.sequence)),
    db
      .select({
        cumulativeTotals: electionNightUpdates.cumulativeTotals,
        totalPoints: electionNightUpdates.totalPoints,
      })
      .from(electionNightUpdates)
      .where(
        and(
          eq(electionNightUpdates.election, election),
          eq(electionNightUpdates.cycle, cycle),
        ),
      )
      .orderBy(asc(electionNightUpdates.sequence))
      .then((rows) => rows.at(-1)),
  ]);
  const latest = revealed.at(-1);
  const reportedPoints = Object.values(latest?.cumulativeTotals ?? {}).reduce(
    (sum, points) => sum + points,
    0,
  );
  const totalPoints =
    finalUpdate?.totalPoints ??
    Object.values(finalUpdate?.cumulativeTotals ?? {}).reduce(
      (sum, points) => sum + points,
      0,
    );

  return {
    updates: revealed,
    cumulativeTotals: latest?.cumulativeTotals ?? {},
    reportedPoints,
    totalPoints,
    reportingPercent:
      totalPoints === 0 && latest
        ? 100
        : (reportedPoints / totalPoints) * 100 || 0,
  };
}
