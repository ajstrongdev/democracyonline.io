import { describe, expect, it } from "bun:test";
import { primaryNextMoves } from "./action-eligibility";

const player = {
  id: 1,
  role: "Citizen",
  partyId: 2,
  partyName: "A",
  active: true,
};
const election = { races: [{ player: { isCandidate: false } }] };

describe("primary next moves", () => {
  it("reminds eligible party and coalition members until they vote", () => {
    const primary = {
      electionStatus: "CANDIDACY",
      candidacyEndsAt: new Date(Date.now() + 60_000),
      isCandidate: false,
      candidates: [{ userId: 3 }],
      hasVoted: false,
    };
    expect(primaryNextMoves(primary, player, election).vote).toBe(true);
    expect(
      primaryNextMoves({ ...primary, hasVoted: true }, player, election).vote,
    ).toBe(false);
    expect(
      primaryNextMoves({ ...primary, candidates: [] }, player, election).vote,
    ).toBe(false);
  });

  it("stops reminders when the primary closes even before lifecycle advances", () => {
    const primary = {
      electionStatus: "CANDIDACY",
      candidacyEndsAt: new Date(Date.now() - 60_000),
      isCandidate: false,
      candidates: [{ userId: 3 }],
      hasVoted: false,
    };
    expect(primaryNextMoves(primary, player, election).vote).toBe(false);
    expect(primaryNextMoves(primary, player, election).stand).toBe(false);
  });
});
