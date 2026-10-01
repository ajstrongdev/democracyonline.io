import { describe, expect, it } from "bun:test";
import { coalitionCompositionFor } from "./coalition-composition";

const seats = [
  {
    key: "party-1",
    name: "A",
    color: "#111111",
    house: 2,
    senate: 1,
    president: 0,
  },
  {
    key: "party-2",
    name: "B",
    color: "#222222",
    house: 1,
    senate: 0,
    president: 1,
  },
  {
    key: "party-3",
    name: "C",
    color: "#333333",
    house: 1,
    senate: 0,
    president: 0,
  },
  {
    key: "independent",
    name: "Independent",
    color: "#64748b",
    house: 0,
    senate: 1,
    president: 0,
  },
];

const memberships = [1, 2].map((partyId) => ({
  partyId,
  coalitionId: 4,
  name: "Alliance",
  color: "#abcdef",
  joinedAt: new Date("2026-09-01"),
  leftAt: partyId === 2 ? new Date("2026-09-20") : null,
}));

describe("coalitionCompositionFor", () => {
  it("groups seats while parties are members without hiding unaligned parties", () => {
    expect(
      coalitionCompositionFor(seats, new Date("2026-09-10"), memberships),
    ).toEqual([
      {
        key: "coalition-4",
        name: "Alliance",
        color: "#abcdef",
        house: 3,
        senate: 1,
        president: 1,
      },
      seats[2],
      seats[3],
    ]);
  });

  it("uses membership at the snapshot date rather than today's membership", () => {
    expect(
      coalitionCompositionFor(seats, new Date("2026-08-31"), memberships),
    ).toEqual(seats);
    expect(
      coalitionCompositionFor(seats, new Date("2026-09-20"), memberships),
    ).toEqual([
      {
        key: "coalition-4",
        name: "Alliance",
        color: "#abcdef",
        house: 2,
        senate: 1,
        president: 0,
      },
      seats[1],
      seats[2],
      seats[3],
    ]);
  });
});
