import { describe, expect, it } from "bun:test";
import { normalizeEmail } from "@/lib/server/auth/user-email";

describe("normalizeEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  User.Name+Tag@Example.COM ")).toBe(
      "user.name+tag@example.com",
    );
  });
});
