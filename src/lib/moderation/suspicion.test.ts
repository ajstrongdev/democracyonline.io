import { describe, expect, it } from "vitest";
import { calculateSuspicion } from "./suspicion";

describe("calculateSuspicion", () => {
  it("returns an explainable score for each contributing signal", () => {
    const result = calculateSuspicion({
      redemptionMinutes: 4,
      inviterRedemptionsIn24Hours: 4,
      ancestryDepth: 6,
      distinctPendingReporters: 2,
    });

    expect(result.score).toBe(84);
    expect(result.shouldFlag).toBe(true);
    expect(result.contributions.map((item) => item.signal)).toEqual([
      "invite_timing",
      "inviter_burst",
      "invite_tree",
      "reports",
    ]);
  });

  it("is bounded at 100 even for extreme signals", () => {
    expect(
      calculateSuspicion({
        redemptionMinutes: 0,
        inviterRedemptionsIn24Hours: 100,
        ancestryDepth: 100,
        distinctPendingReporters: 100,
      }).score,
    ).toBe(100);
  });

  it("does not flag a normal invitation with no reports", () => {
    expect(
      calculateSuspicion({
        redemptionMinutes: 240,
        inviterRedemptionsIn24Hours: 1,
        ancestryDepth: 2,
        distinctPendingReporters: 0,
      }),
    ).toMatchObject({ score: 0, shouldFlag: false, contributions: [] });
  });
});
