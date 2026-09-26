import { describe, expect, it } from "vitest";
import {
  aggregatePolicyValues,
  aggregateStatEffects,
  applyDiminishingEffect,
  calculateHeadlineIndices,
  validatePolicyValue,
  validateStatAssessment,
} from "./simulation";
import type { PolicyDefinition, StatDefinition } from "./catalog";

describe("nation simulation", () => {
  it("aggregates one and two participants", () => {
    expect(aggregateStatEffects([2])).toBe(2);
    expect(aggregateStatEffects([2, -1])).toBe(0.5);
  });

  it("trims outliers from larger groups", () => {
    expect(aggregateStatEffects([-2, 1, 1, 1, 2])).toBe(1);
  });

  it("aggregates large groups deterministically", () => {
    expect(aggregateStatEffects([2, 2, 1, 1, 1, 1, 1, 1, -2, -2])).toBe(0.75);
    expect(aggregateStatEffects([])).toBe(0);
  });

  it("selects policy plurality and preserves current value on a tie", () => {
    expect(aggregatePolicyValues([true, true, false], false)).toBe(true);
    expect(aggregatePolicyValues([true, false], false)).toBe(false);
  });

  it("validates enum and numeric policy values", () => {
    const enumPolicy: PolicyDefinition = {
      key: "x",
      name: "X",
      category: "x",
      type: "enum",
      options: ["a", "b"],
      min: null,
      max: null,
      defaultValue: "a",
    };
    expect(validatePolicyValue(enumPolicy, "b")).toBe(true);
    expect(validatePolicyValue(enumPolicy, "c")).toBe(false);
  });

  it("enforces count, scale, duplicates, and impact budget", () => {
    expect(() =>
      validateStatAssessment([{ statKey: "a", effect: 2 }]),
    ).not.toThrow();
    expect(() =>
      validateStatAssessment([
        { statKey: "a", effect: 2 },
        { statKey: "a", effect: 1 },
      ]),
    ).toThrow();
    expect(() =>
      validateStatAssessment([{ statKey: "a", effect: 3 }]),
    ).toThrow();
    expect(() =>
      validateStatAssessment(
        ["a", "b", "c", "d"].map((statKey) => ({ statKey, effect: 2 })),
      ),
    ).toThrow();
  });

  it("clamps effects and diminishes them near an extreme", () => {
    expect(applyDiminishingEffect(50, 2, 0, 100)).toBe(55);
    expect(applyDiminishingEffect(99, 2, 0, 100)).toBeLessThan(102);
    expect(applyDiminishingEffect(99, 2, 0, 100)).toBeLessThanOrEqual(100);
    expect(applyDiminishingEffect(100, 2, 0, 100)).toBe(100);
  });

  it("calculates positive and negative headline contributors", () => {
    const definitions: Array<StatDefinition> = [
      {
        key: "liberty",
        name: "Liberty",
        category: "x",
        defaultValue: 50,
        min: 0,
        max: 100,
        headline: "civil_rights",
        headlineWeight: 1,
        headlineDirection: "positive",
        flavour: false,
      },
      {
        key: "surveillance",
        name: "Surveillance",
        category: "x",
        defaultValue: 50,
        min: 0,
        max: 100,
        headline: "political_freedoms",
        headlineWeight: 1,
        headlineDirection: "negative",
        flavour: false,
      },
    ];
    const result = calculateHeadlineIndices(
      definitions,
      new Map([
        ["liberty", 80],
        ["surveillance", 80],
      ]),
    );
    expect(result.civil_rights).toBe(80);
    expect(result.political_freedoms).toBe(20);
    expect(result.economy).toBe(50);
  });
});
