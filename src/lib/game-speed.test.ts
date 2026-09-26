import { describe, expect, it } from "vitest";
import {
  GAME_SPEED_MODES,
  describeGameSpeed,
  getBillStageDurationMs,
  getGameAdvanceIntervalMs,
  getGameSpeedMode,
} from "@/lib/game-speed";
import {
  billStatusLabel,
  getNextBillStage,
} from "@/components/bill-stage-countdown";

describe("game speed presets", () => {
  it("defines the seven promised modes", () => {
    expect(GAME_SPEED_MODES.map((preset) => preset.mode)).toEqual([
      "super-slow",
      "slow",
      "regular",
      "fast",
      "super-fast",
      "dev",
      "dev-relaxed",
    ]);
  });

  it("uses the agreed multipliers", () => {
    const byMode = new Map(
      GAME_SPEED_MODES.map((preset) => [preset.mode, preset.multiplier]),
    );
    expect(byMode.get("super-slow")).toBe(0.25);
    expect(byMode.get("slow")).toBe(0.5);
    expect(byMode.get("regular")).toBe(1);
    expect(byMode.get("fast")).toBe(2);
    expect(byMode.get("super-fast")).toBe(72);
    expect(byMode.get("dev")).toBe(720);
    expect(byMode.get("dev-relaxed")).toBe(2);
  });

  it("looks modes up by name", () => {
    expect(getGameSpeedMode("fast")?.multiplier).toBe(2);
    expect(getGameSpeedMode("nope")).toBeNull();
  });
});

describe("describeGameSpeed", () => {
  it("reports the regular pace", () => {
    const pace = describeGameSpeed(1);
    expect(pace.billStage).toBe("8h");
    expect(pace.gameTick).toBe("1d");
    expect(pace.electionNight).toBe("12h");
    expect(pace.presCycle).toBe("≈28d 12h");
    expect(pace.senateCycle).toBe("≈14d 12h");
  });

  it("halves full cycles at fast (14/7)", () => {
    const pace = describeGameSpeed(2);
    expect(pace.billStage).toBe("4h");
    expect(pace.presCycle).toBe("≈14d 6h");
    expect(pace.senateCycle).toBe("≈7d 6h");
  });

  it("runs bill stages in minutes at super-fast and dev", () => {
    expect(describeGameSpeed(72).billStage).toBe("6m 40s");
    expect(describeGameSpeed(720).billStage).toBe("40s");
    expect(describeGameSpeed(720).gameTick).toBe("2m");
  });

  it("treats non-positive multipliers as regular", () => {
    expect(describeGameSpeed(0).billStage).toBe("8h");
  });
});

describe("scaled durations", () => {
  it("scales bill stages with a 1s floor", () => {
    expect(getBillStageDurationMs(1)).toBe(8 * 60 * 60 * 1000);
    expect(getBillStageDurationMs(720)).toBe(40_000);
    expect(getBillStageDurationMs(100_000)).toBe(1_000);
    expect(getBillStageDurationMs(0)).toBe(8 * 60 * 60 * 1000);
  });

  it("scales game ticks with a 60s floor", () => {
    expect(getGameAdvanceIntervalMs(1)).toBe(24 * 60 * 60 * 1000);
    expect(getGameAdvanceIntervalMs(720)).toBe(2 * 60 * 1000);
    expect(getGameAdvanceIntervalMs(100_000)).toBe(60_000);
  });
});

describe("bill display helpers", () => {
  it("labels the committee stage as Senate Committee", () => {
    expect(billStatusLabel("Committee")).toBe("Senate Committee");
    expect(billStatusLabel("Voting")).toBe("Voting");
  });

  it("names the next stage across the lifecycle", () => {
    expect(getNextBillStage({ status: "Committee", stage: "House" })).toBe(
      "House voting",
    );
    expect(getNextBillStage({ status: "Voting", stage: "House" })).toBe(
      "Senate voting",
    );
    expect(getNextBillStage({ status: "Voting", stage: "Senate" })).toBe(
      "Presidential decision",
    );
    expect(getNextBillStage({ status: "Voting", stage: "Presidential" })).toBe(
      "Final decision",
    );
    expect(
      getNextBillStage({ status: "Passed", stage: "Presidential" }),
    ).toBeNull();
    expect(getNextBillStage({ status: "Defeated", stage: "House" })).toBeNull();
  });
});
