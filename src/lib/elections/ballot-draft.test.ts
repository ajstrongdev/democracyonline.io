import { describe, expect, it } from "vitest";
import { reconcileBallotDraft } from "./ballot-draft";

describe("reconcileBallotDraft", () => {
  it("keeps a saved order and adds new candidates at the end", () => {
    expect(reconcileBallotDraft([1, 2, 3, 4], [3, 1, 2])).toEqual([3, 1, 2, 4]);
  });

  it("drops removed, duplicate and invalid candidates", () => {
    expect(reconcileBallotDraft([1, 2, 3], [3, 9, 3, "2", 1])).toEqual([3, 1, 2]);
  });

  it("uses the roster for a damaged draft", () => {
    expect(reconcileBallotDraft([1, 2], null)).toEqual([1, 2]);
  });
});
