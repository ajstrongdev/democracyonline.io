import { describe, expect, it } from "vitest";
import {
  leadershipBidHasPassed,
  leadershipBidThreshold,
} from "./leadership-bid";

describe("leadership bids", () => {
  it("uses half the membership at launch, rounded up", () => {
    expect(leadershipBidThreshold(3)).toBe(2);
    expect(leadershipBidThreshold(4)).toBe(2);
    expect(leadershipBidThreshold(5)).toBe(3);
  });

  it("does not count departed supporters or players who joined afterward", () => {
    expect(leadershipBidHasPassed(2, [1, 2, 3], [1, 3, 4], [1, 2, 4])).toBe(
      false,
    );
    expect(leadershipBidHasPassed(2, [1, 2, 3], [1, 3, 4], [1, 3, 4])).toBe(
      true,
    );
  });
});
