import { describe, expect, it } from "vitest";
import { getFeedDestination } from "@/lib/feed-destination";

describe("getFeedDestination", () => {
  it.each([
    ["Commented on bill #42: Budget", 1, "/dashboard/bills/42"],
    ["edited the election current-President article", 1, "/dashboard/elections/current-President"],
    ["edited the election 7 article", 1, "/dashboard/elections/7"],
    ["Senate Election #9 concluded", null, "/dashboard/elections/9"],
    ["edited the party #3 article", 1, "/dashboard/parties/3"],
    ["voted in the presidential primary", 1, "/dashboard/parties/primaries"],
    ["formed a new coalition", 1, "/dashboard/parties/coalitions"],
    ["@someone posted on Z.com: bill #42", 1, "/social"],
    ["updated their player profile", 1, "/dashboard/players/1"],
    ["joined the public policy discussion.", 1, "/dashboard/players/1"],
    ["an old free-form activity", null, "/dashboard"],
  ] as const)("routes %s", (content, userId, destination) => {
    expect(getFeedDestination(content, userId)).toBe(destination);
  });
});
