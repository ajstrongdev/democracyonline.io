import { describe, expect, it } from "vitest";
import {
  coalitionVoteEndsAt,
  decideCoalitionVote,
  decideTimedCoalitionVote,
} from "./governance";

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

  it("closes coalition ballots 24 hours after creation", () => {
    expect(coalitionVoteEndsAt("2026-09-30T10:00:00Z").toISOString()).toBe(
      "2026-10-01T10:00:00.000Z",
    );
    expect(decideCoalitionVote(4, 2, 1)).toBe("pending");
    const opened = new Date("2026-09-30T10:00:00Z");
    const before = new Date("2026-10-01T09:59:59Z");
    const after = new Date("2026-10-01T10:00:00Z");
    expect(decideTimedCoalitionVote(3, 2, 0, opened, before, 2)).toBe("open");
    expect(decideTimedCoalitionVote(3, 2, 1, opened, before, 3)).toBe(
      "approved",
    );
    expect(decideTimedCoalitionVote(3, 1, 2, opened, before, 3)).toBe(
      "rejected",
    );
    expect(decideTimedCoalitionVote(3, 2, 0, opened, after, 2)).toBe(
      "approved",
    );
    expect(decideTimedCoalitionVote(3, 1, 0, opened, after, 1)).toBe(
      "rejected",
    );
    expect(decideTimedCoalitionVote(4, 2, 2, opened, after, 4)).toBe(
      "rejected",
    );
  });
});
