import { describe, expect, it } from "vitest";
import { featuredOffice, officeArtwork, pageArtwork } from "./masthead-artwork";

describe("masthead artwork", () => {
  it("uses current offices for dashboard and player profiles", () => {
    expect(officeArtwork("President")).toBe("president");
    expect(officeArtwork("Senator")).toBe("senate");
    expect(officeArtwork("Representative")).toBe("house");
    expect(officeArtwork(null)).toBe("nation");
    expect(featuredOffice("President")).toBe("President");
    expect(featuredOffice("Citizen")).toBeUndefined();
  });

  it("keeps nested game pages in their own visual family", () => {
    expect(pageArtwork("/dashboard/parties/coalitions/123")).toBe("parties");
    expect(pageArtwork("/dashboard/bills/42")).toBe("bills");
    expect(pageArtwork("/dashboard/players/6")).toBe("players");
    expect(pageArtwork("/dashboard/social")).toBe("social");
  });
});
