import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationTokenPrefix,
} from "./token";

describe("invitation tokens", () => {
  it("stores a stable hash and a non-secret display prefix", () => {
    const token = "doi_example-secret-token";
    expect(hashInvitationToken(` ${token} `)).toHaveLength(64);
    expect(hashInvitationToken(` ${token} `)).toBe(hashInvitationToken(token));
    expect(invitationTokenPrefix(token)).toBe("doi_exampl");
    expect(hashInvitationToken(token)).not.toContain(token);
  });

  it("generates distinct opaque tokens", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first).toMatch(/^doi_[A-Za-z0-9_-]{32}$/);
    expect(first).not.toBe(second);
  });
});
