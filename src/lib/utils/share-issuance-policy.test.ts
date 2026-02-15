import { describe, expect, it } from "vitest";
import {
  calculateDividendPerShareMilli,
  calculateHourlyDividendPool,
  calculateOneShareOwnershipDriftBps,
  shouldTriggerBuyPressureMint,
} from "@/lib/utils/share-issuance-policy";

describe("share issuance policy helpers", () => {
  it("triggers buy-pressure mint only for event-conditional policy", () => {
    expect(
      shouldTriggerBuyPressureMint({
        policy: "legacy-hourly",
        buyPressureTriggerEnabled: true,
        netDemand: 50,
        buyPressureThreshold: 25,
      }),
    ).toBe(false);

    expect(
      shouldTriggerBuyPressureMint({
        policy: "event-conditional",
        buyPressureTriggerEnabled: true,
        netDemand: 25,
        buyPressureThreshold: 25,
      }),
    ).toBe(true);
  });

  it("computes one-share ownership drift in basis points", () => {
    const drift = calculateOneShareOwnershipDriftBps({
      issuedSharesBefore: 100,
      mintedShares: 1,
    });

    expect(drift).toBe(1);
  });

  it("computes hourly dividend pool from market cap", () => {
    expect(calculateHourlyDividendPool(12_345)).toBe(1_234);
  });

  it("computes per-share dividend in milli-units", () => {
    expect(
      calculateDividendPerShareMilli({
        hourlyDividendPool: 1_000,
        issuedShares: 250,
      }),
    ).toBe(4_000);
  });
});
