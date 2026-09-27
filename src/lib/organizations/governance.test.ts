import { describe, expect, it } from "vitest";
import { decideCoalitionVote } from "./governance";

describe("coalition majority decisions", () => {
  it("does not reject a proposal before enough parties have voted", () => {
    expect(decideCoalitionVote(3, 1, 0)).toBe("pending");
    expect(decideCoalitionVote(4, 2, 1)).toBe("pending");
  });

  it("resolves only after a majority or a completed tie", () => {
    expect(decideCoalitionVote(3, 2, 0)).toBe("approved");
    expect(decideCoalitionVote(3, 0, 2)).toBe("rejected");
    expect(decideCoalitionVote(4, 2, 2)).toBe("rejected");
    expect(decideCoalitionVote(1, 1, 0)).toBe("approved");
  });
});
