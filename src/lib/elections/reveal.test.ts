import { describe, expect, it } from "vitest";
import { generateElectionNightPlan, getRevealUpdateCount } from "./reveal";

const candidates = [
  { id: 3, name: "Ada", total: 41 },
  { id: 8, name: "Grace", total: 35 },
  { id: 12, name: "Alan", total: 24 },
];

describe("generateElectionNightPlan", () => {
  it("is deterministic for a persisted seed", () => {
    const options = {
      seed: "President:7:fixed",
      startsAt: new Date("2026-09-20T19:00:00.000Z"),
      durationMs: 12 * 60 * 60 * 1000,
    };
    expect(generateElectionNightPlan(candidates, options)).toEqual(
      generateElectionNightPlan(candidates, options),
    );
    expect(
      generateElectionNightPlan(candidates, { ...options, seed: "other" }),
    ).not.toEqual(generateElectionNightPlan(candidates, options));
  });

  it("is monotonic, bounded, irregular, and finishes at exact totals", () => {
    const plan = generateElectionNightPlan(candidates, {
      seed: "Senate:4",
      startsAt: new Date("2026-09-20T19:00:00.000Z"),
      durationMs: 12 * 60 * 60 * 1000,
      updateCount: 14,
    });
    const previous: Record<string, number> = {};
    for (const update of plan) {
      for (const candidate of candidates) {
        const value = update.cumulativeTotals[String(candidate.id)];
        expect(value).toBeGreaterThanOrEqual(
          previous[String(candidate.id)] ?? 0,
        );
        expect(value).toBeLessThanOrEqual(candidate.total);
        previous[String(candidate.id)] = value;
      }
    }
    const gaps = plan
      .slice(1)
      .map(
        (update, index) =>
          update.revealAt.getTime() - plan[index].revealAt.getTime(),
      );
    expect(new Set(gaps).size).toBeGreaterThan(2);
    expect(plan.at(-1)?.reportingPercent).toBe(100);
    expect(plan.at(-1)?.cumulativeTotals).toEqual({
      "3": 41,
      "8": 35,
      "12": 24,
    });
    expect(plan.at(-1)?.type).toBe("FINAL");
    expect(plan.at(-1)?.totalPoints).toBe(100);
    expect(plan.every((update) => update.totalPoints <= 100)).toBe(true);
    expect(plan.every((update) => update.totalPoints >= 0)).toBe(true);
  });

  it("compresses timing without waiting", () => {
    const startsAt = new Date("2026-09-20T19:00:00.000Z");
    const plan = generateElectionNightPlan(candidates, {
      seed: "compressed",
      startsAt,
      durationMs: 1_200,
      updateCount: 8,
    });
    const finalUpdate = plan.at(-1);
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate!.revealAt.getTime() - startsAt.getTime()).toBe(1_200);
    expect(plan.every((update) => update.revealAt >= startsAt)).toBe(true);
  });

  it("reports often throughout a twelve-hour election night", () => {
    const durationMs = 12 * 60 * 60 * 1000;
    const plan = generateElectionNightPlan(
      candidates.map((candidate) => ({
        ...candidate,
        total: candidate.total * 20,
      })),
      {
        seed: "frequent-production-count",
        startsAt: new Date("2026-09-20T19:00:00.000Z"),
        durationMs,
      },
    );
    const gaps = plan
      .slice(1)
      .map(
        (update, index) =>
          update.revealAt.getTime() - plan[index]!.revealAt.getTime(),
      );

    expect(getRevealUpdateCount(durationMs)).toBe(144);
    expect(plan).toHaveLength(144);
    expect(Math.max(...gaps)).toBeLessThan(15 * 60 * 1000);
    expect(new Set(plan.map((update) => update.headline)).size).toBeGreaterThan(
      12,
    );
    const totalPointsValues = plan.map((update) => update.totalPoints);
    expect(totalPointsValues.at(-1)).toBe(2000);
    expect(plan.every((update) => update.totalPoints <= 2000)).toBe(true);
  });
});
