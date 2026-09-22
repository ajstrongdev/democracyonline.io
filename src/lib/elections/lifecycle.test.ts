import { describe, expect, it } from "vitest";
import {
  canDeclareCandidacy,
  canSubmitBallot,
  getNextElectionStatus,
  isElectionStageOverdue,
  normalizeElectionStatus,
} from "./lifecycle";
import {
  DEFAULT_ELECTION_TIMING,
  getElectionTiming,
  getLondonElectionNightWindowForDate,
  getNextLondonElectionNightWindow,
} from "./timing";

describe("election lifecycle", () => {
  it("normalizes legacy statuses", () => {
    expect(normalizeElectionStatus("Candidate")).toBe("CANDIDACY");
    expect(normalizeElectionStatus("Candidacy")).toBe("CANDIDACY");
    expect(normalizeElectionStatus("Voting")).toBe("VOTING");
    expect(normalizeElectionStatus("Concluded")).toBe("CONCLUDED");
  });

  it("derives overdue stages from the relevant timestamp", () => {
    expect(
      isElectionStageOverdue(
        {
          status: "VOTING",
          candidacyEndsAt: null,
          votingEndsAt: new Date("2026-09-20T10:00:00Z"),
          electionNightEndsAt: null,
          concludedAt: null,
        },
        new Date("2026-09-20T10:00:00Z"),
      ),
    ).toBe(true);
  });

  it("enforces candidacy and voting stages at their deadlines", () => {
    const now = new Date("2026-09-20T10:00:00Z");
    const future = new Date("2026-09-20T10:00:01Z");
    expect(canDeclareCandidacy("CANDIDACY", future, now)).toBe(true);
    expect(canDeclareCandidacy("VOTING", future, now)).toBe(false);
    expect(canDeclareCandidacy("CANDIDACY", now, now)).toBe(false);
    expect(canSubmitBallot("VOTING", future, now)).toBe(true);
    expect(canSubmitBallot("ELECTION_NIGHT", future, now)).toBe(false);
    expect(canSubmitBallot("VOTING", null, now)).toBe(false);
  });

  it("uses the complete four-stage lifecycle", () => {
    expect(getNextElectionStatus("CANDIDACY")).toBe("VOTING");
    expect(getNextElectionStatus("VOTING")).toBe("ELECTION_NIGHT");
    expect(getNextElectionStatus("ELECTION_NIGHT")).toBe("CONCLUDED");
    expect(getNextElectionStatus("CONCLUDED")).toBe("CANDIDACY");
  });

  it("scales every election duration for the accelerated dev environment", () => {
    const devTiming = getElectionTiming(72);

    expect(devTiming.candidacyDurationMs.President).toBe(
      DEFAULT_ELECTION_TIMING.candidacyDurationMs.President / 72,
    );
    expect(devTiming.candidacyDurationMs.Senate).toBe(
      DEFAULT_ELECTION_TIMING.candidacyDurationMs.Senate / 72,
    );
    expect(devTiming.votingDurationMs.President).toBe(
      DEFAULT_ELECTION_TIMING.votingDurationMs.President / 72,
    );
    expect(devTiming.electionNightDurationMs).toBe(
      DEFAULT_ELECTION_TIMING.electionNightDurationMs / 72,
    );
    expect(devTiming.concludedDurationMs.Senate).toBe(
      DEFAULT_ELECTION_TIMING.concludedDurationMs.Senate / 72,
    );
  });

  it("builds London 20:00 to 08:00 windows across daylight saving", () => {
    expect(
      getNextLondonElectionNightWindow(new Date("2026-07-01T12:00:00Z")),
    ).toEqual({
      startsAt: new Date("2026-07-01T19:00:00Z"),
      endsAt: new Date("2026-07-02T07:00:00Z"),
    });
    expect(
      getNextLondonElectionNightWindow(new Date("2026-12-01T21:00:00Z")),
    ).toEqual({
      startsAt: new Date("2026-12-02T20:00:00Z"),
      endsAt: new Date("2026-12-03T08:00:00Z"),
    });
  });

  it("uses London wall-clock times on daylight-saving transition nights", () => {
    const spring = getLondonElectionNightWindowForDate(
      new Date("2026-03-28T12:00:00Z"),
    );
    expect(spring).toEqual({
      startsAt: new Date("2026-03-28T20:00:00Z"),
      endsAt: new Date("2026-03-29T07:00:00Z"),
    });
    expect(spring.endsAt.getTime() - spring.startsAt.getTime()).toBe(
      11 * 60 * 60 * 1000,
    );

    const autumn = getLondonElectionNightWindowForDate(
      new Date("2026-10-24T12:00:00Z"),
    );
    expect(autumn).toEqual({
      startsAt: new Date("2026-10-24T19:00:00Z"),
      endsAt: new Date("2026-10-25T08:00:00Z"),
    });
    expect(autumn.endsAt.getTime() - autumn.startsAt.getTime()).toBe(
      13 * 60 * 60 * 1000,
    );
  });
});
