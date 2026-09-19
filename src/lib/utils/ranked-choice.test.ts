import { describe, expect, it } from "vitest";
import { scoreRankedBallot } from "./ranked-choice";

describe("scoreRankedBallot", () => {
  it("awards N points to first place and one point to last place", () => {
    expect(scoreRankedBallot([10, 20, 30, 40], [30, 10, 40, 20])).toEqual([
      { candidateId: 30, rank: 1, points: 4 },
      { candidateId: 10, rank: 2, points: 3 },
      { candidateId: 40, rank: 3, points: 2 },
      { candidateId: 20, rank: 4, points: 1 },
    ]);
  });

  it("gives a twelve-candidate ballot scores from twelve to one", () => {
    const ids = Array.from({ length: 12 }, (_, index) => index + 1);
    const scores = scoreRankedBallot(ids, ids);
    expect(scores.map(({ points }) => points)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(scores.reduce((total, score) => total + score.points, 0)).toBe(78);
  });

  it("requires one unique ranking for every candidate", () => {
    expect(() => scoreRankedBallot([1, 2, 3], [1, 2])).toThrow(
      /Every candidate/,
    );
    expect(() => scoreRankedBallot([1, 2, 3], [1, 1, 3])).toThrow(/duplicate/);
    expect(() => scoreRankedBallot([1, 2, 3], [1, 2, 4])).toThrow(
      /not in this election/,
    );
  });
});
