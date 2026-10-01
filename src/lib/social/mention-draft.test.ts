import { describe, expect, it } from "bun:test";
import { mentionDraft } from "./mention-draft";

describe("mentionDraft", () => {
  it("starts an empty reply with the recipient", () => {
    expect(mentionDraft("", "Ada")).toBe("@Ada ");
  });

  it("keeps the existing draft and avoids repeating the leading recipient", () => {
    expect(mentionDraft("I agree", "Ada")).toBe("@Ada I agree");
    expect(mentionDraft("@Ada I agree", "Ada")).toBe("@Ada I agree");
    expect(mentionDraft("@Ada\nI agree", "Ada")).toBe("@Ada\nI agree");
    expect(mentionDraft("@Adam disagrees", "Ada")).toBe("@Ada @Adam disagrees");
  });
});
