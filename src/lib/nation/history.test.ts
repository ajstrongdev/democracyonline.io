import { describe, expect, it } from "vitest";
import { buildNationHistory } from "./history";
import type { StatDefinition } from "./catalog";

const definitions: Array<StatDefinition> = [
  {
    key: "rights",
    name: "Rights",
    category: "civil_rights",
    defaultValue: 40,
    min: 0,
    max: 100,
    headline: "civil_rights",
    headlineWeight: 1,
    headlineDirection: "positive",
    flavour: false,
  },
  {
    key: "press",
    name: "Press",
    category: "civil_rights",
    defaultValue: 60,
    min: 0,
    max: 100,
    headline: "civil_rights",
    headlineWeight: 1,
    headlineDirection: "positive",
    flavour: false,
  },
  {
    key: "culture",
    name: "Culture",
    category: "culture_lifestyle",
    defaultValue: 50,
    min: 0,
    max: 100,
    headline: null,
    headlineWeight: 0,
    headlineDirection: null,
    flavour: true,
  },
];

describe("buildNationHistory", () => {
  it("rewinds current values and creates one chronological snapshot per bill", () => {
    const history = buildNationHistory(
      definitions,
      new Map([
        ["rights", 70],
        ["press", 50],
        ["culture", 55],
      ]),
      [
        {
          id: 1,
          billId: 10,
          billTitle: "First law",
          key: "rights",
          previousValue: 40,
          newValue: 60,
          createdAt: new Date("2025-01-01"),
        },
        {
          id: 2,
          billId: 10,
          billTitle: "First law",
          key: "press",
          previousValue: 60,
          newValue: 50,
          createdAt: new Date("2025-01-01"),
        },
        {
          id: 3,
          billId: 11,
          billTitle: "Second law",
          key: "rights",
          previousValue: 60,
          newValue: 70,
          createdAt: new Date("2025-02-01"),
        },
      ],
    );

    expect(history).toHaveLength(3);
    expect(history[0].stats.rights).toBe(40);
    expect(history[0].civil_rights).toBe(50);
    expect(history[1].stats).toMatchObject({ rights: 60, press: 50 });
    expect(history[2].stats.rights).toBe(70);
  });
});
