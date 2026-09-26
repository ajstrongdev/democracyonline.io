import { describe, expect, it } from "vitest";
import { publicFirebaseUser } from "./firebase-user-public";
import type { UserRecord } from "firebase-admin/auth";

describe("Firebase user serialization", () => {
  it("does not expose credentials or password hashes", () => {
    const user = {
      uid: "one",
      email: "player@example.com",
      passwordHash: "secret-hash",
      passwordSalt: "secret-salt",
      tokensValidAfterTime: "secret-token",
      metadata: { creationTime: "yesterday", lastSignInTime: "today" },
    } as unknown as UserRecord;
    const serialized = JSON.stringify(publicFirebaseUser(user));
    expect(serialized).toContain("player@example.com");
    expect(serialized).not.toContain("secret-hash");
    expect(serialized).not.toContain("secret-salt");
    expect(serialized).not.toContain("secret-token");
  });
});
