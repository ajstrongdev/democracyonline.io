import { describe, expect, it } from "vitest";
import { createInviteLink } from "./link";

describe("invite links", () => {
  it("points to registration with the invite in the query string", () => {
    const link = createInviteLink("https://democracyonline.io", "doi_abc-123_foo");
    const url = new URL(link);

    expect(url.origin).toBe("https://democracyonline.io");
    expect(url.pathname).toBe("/register");
    expect(url.searchParams.get("invite")).toBe("doi_abc-123_foo");
  });

  it("encodes special characters rather than changing the link", () => {
    const link = createInviteLink("http://localhost:3001", "value&next=/login");
    expect(new URL(link).searchParams.get("invite")).toBe("value&next=/login");
    expect(new URL(link).searchParams.has("next")).toBe(false);
  });
});
