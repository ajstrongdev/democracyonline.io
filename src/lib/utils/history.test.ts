import { describe, expect, it } from "vitest";
import {
  formatElectionTitle,
  formatOrdinal,
  formatWikiDate,
  getOfficeTerms,
  getOfficeholderSelection,
  getPartyTerms,
  getVoteShare,
} from "./history";

describe("historical election calculations", () => {
  it("calculates vote share and safely handles an empty result", () => {
    expect(getVoteShare(25, 100)).toBe(25);
    expect(getVoteShare(0, 0)).toBe(0);
  });

  it("distinguishes elected, appointed, and serving officeholders", () => {
    expect(getOfficeholderSelection("Senate", "Senator", true)).toBe("Elected");
    expect(getOfficeholderSelection("Senate", "Senator", false)).toBe(
      "Appointed",
    );
    expect(getOfficeholderSelection("President", "Senator", false)).toBe(
      "Serving",
    );
  });

  it("uses conventional election names instead of internal cycle labels", () => {
    expect(formatOrdinal(1)).toBe("First");
    expect(formatOrdinal(12)).toBe("Twelfth");
    expect(formatOrdinal(23)).toBe("23rd");
    expect(formatElectionTitle("President", 4)).toBe(
      "Fourth presidential election",
    );
    expect(formatElectionTitle("Senate", 7)).toBe("Seventh Senate election");
  });

  it("formats historical dates with numeric ordinals in UTC", () => {
    expect(formatWikiDate("2025-12-14T23:00:00.000Z")).toBe(
      "14th December 2025",
    );
    expect(formatWikiDate("2026-01-02T00:00:00.000Z")).toBe("2nd January 2026");
  });

  it("collapses repeated government snapshots into dated office terms", () => {
    const snapshot = (
      historyId: number,
      office: string,
      concludedAt: string,
    ) => ({
      historyId,
      office,
      concludedAt,
      election: "President",
      cycle: historyId,
      selection: "Elected",
    });
    const terms = getOfficeTerms(
      [
        snapshot(3, "Representative", "2026-01-02T00:00:00.000Z"),
        snapshot(1, "Representative", "2025-12-01T00:00:00.000Z"),
        snapshot(2, "President", "2025-12-14T00:00:00.000Z"),
      ],
      "Representative",
    );

    expect(terms).toMatchObject([
      {
        office: "Representative",
        startAt: "2026-01-02T00:00:00.000Z",
        endAt: null,
      },
      {
        office: "President",
        startAt: "2025-12-14T00:00:00.000Z",
        endAt: "2026-01-02T00:00:00.000Z",
      },
      {
        office: "Representative",
        startAt: "2025-12-01T00:00:00.000Z",
        endAt: "2025-12-14T00:00:00.000Z",
      },
    ]);
  });

  it("builds dated party and Independent affiliation terms", () => {
    const terms = getPartyTerms(
      [
        {
          at: "2025-12-01T00:00:00.000Z",
          partyId: 1,
          partyName: "Reform Party",
          partyColor: "#112233",
        },
        {
          at: "2025-12-14T00:00:00.000Z",
          partyId: null,
          partyName: null,
          partyColor: null,
        },
        {
          at: "2026-01-02T00:00:00.000Z",
          partyId: 2,
          partyName: "Civic Party",
          partyColor: "#445566",
        },
      ],
      { partyId: 2, partyName: "Civic Party", partyColor: "#445566" },
      "2025-11-01T00:00:00.000Z",
    );

    expect(terms).toMatchObject([
      { partyId: 2, startAt: "2026-01-02T00:00:00.000Z", endAt: null },
      {
        partyId: null,
        startAt: "2025-12-14T00:00:00.000Z",
        endAt: "2026-01-02T00:00:00.000Z",
      },
      {
        partyId: 1,
        startAt: "2025-12-01T00:00:00.000Z",
        endAt: "2025-12-14T00:00:00.000Z",
      },
    ]);
  });
});
