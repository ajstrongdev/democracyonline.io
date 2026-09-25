import { describe, expect, it } from "vitest";
import { billCommentPostContent } from "./bill-comment-post";
import { getEntityReferenceHref } from "./entity-references";

describe("bill comments on Z.com", () => {
  it("preserves the entire comment and includes a linkable bill reference", () => {
    const body = `**Why this matters**\n\nSee Party #2. ${"A".repeat(300)}`;
    const post = billCommentPostContent(53, body);
    expect(post).toBe(`In relation to Bill #53:\n\n${body}`);
    expect(getEntityReferenceHref("Bill #53")).toBe("/dashboard/bills/53");
  });
});
