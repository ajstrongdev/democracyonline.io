import { describe, expect, it } from "vitest";
import {
  getMentionAccounts,
  isSameMentionAccount,
} from "@/lib/social-notification-accounts";

describe("Z.com mention accounts", () => {
  it("keeps the player, presidency, and led parties separate", () => {
    const accounts = getMentionAccounts(
      { username: "a.b", role: "President", isActive: true },
      [{ id: 7, name: "The Green Party" }],
    );
    expect(accounts.map((account) => account.key)).toEqual([
      "player",
      "potro",
      "party:7",
    ]);
    expect(accounts[0].pattern).toContain("@(a\\.b)");
    expect(accounts[1].pattern).toContain("POTRO|POTUS");
    expect(accounts[2].pattern).toContain("the-green-party");
  });

  it("does not claim POTRO mentions for an inactive former president", () => {
    expect(
      getMentionAccounts(
        { username: "Alex", role: "President", isActive: false },
        [],
      ).map((account) => account.key),
    ).toEqual(["player"]);
  });

  it("allows a party post to mention its publisher's player identity", () => {
    expect(
      isSameMentionAccount(
        { userId: 5, accountKey: "party", partyId: 7 },
        "player",
        5,
      ),
    ).toBe(false);
    expect(
      isSameMentionAccount(
        { userId: 5, accountKey: "party", partyId: 7 },
        "party:7",
        5,
      ),
    ).toBe(true);
    expect(
      isSameMentionAccount({ userId: 5, accountKey: null }, "player", 5),
    ).toBe(true);
    expect(
      isSameMentionAccount({ userId: 5, accountKey: "potro" }, "player", 5),
    ).toBe(false);
    expect(
      isSameMentionAccount(
        { userId: 5, accountKey: null, isComment: true },
        "party:7",
        5,
      ),
    ).toBe(false);
    expect(
      isSameMentionAccount({ userId: 6, accountKey: null }, "player", 5),
    ).toBe(false);
  });
});
