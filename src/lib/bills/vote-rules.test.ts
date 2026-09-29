import { describe, expect, it } from "vitest";
import { breaksEnforcedWhip, canIndicateVote } from "./vote-rules";

describe("advance vote indications", () => {
  it("allows future chambers but never the open or completed stage", () => {
    expect(canIndicateVote("Committee", "House", "House")).toBe(true);
    expect(canIndicateVote("Committee", "House", "Presidential")).toBe(true);
    expect(canIndicateVote("Voting", "House", "Senate")).toBe(true);
    expect(canIndicateVote("Voting", "Senate", "Senate")).toBe(false);
    expect(canIndicateVote("Voting", "Presidential", "House")).toBe(false);
    expect(canIndicateVote("Defeated", "House", "Senate")).toBe(false);
  });
});

describe("enforced party whips", () => {
  it("ejects only for a contrary vote, not for non-binding guidance", () => {
    expect(breaksEnforcedWhip(null, false)).toBe(false);
    expect(breaksEnforcedWhip("For", true)).toBe(false);
    expect(breaksEnforcedWhip("For", false)).toBe(true);
    expect(breaksEnforcedWhip("Against", true)).toBe(true);
    expect(breaksEnforcedWhip("Against", false)).toBe(false);
  });
});
