import { describe, expect, it } from "bun:test";
import { insertAtSelection, prefixSelectedLines } from "./insert-at-selection";

describe("insertAtSelection", () => {
  it("wraps selected text without moving the rest of the draft", () => {
    expect(insertAtSelection("Hello world!", 6, 11, "**", "**")).toEqual({
      value: "Hello **world**!",
      selectionStart: 8,
      selectionEnd: 13,
    });
  });

  it("inserts editable placeholder text at the cursor", () => {
    expect(
      insertAtSelection(
        "Hello ",
        6,
        6,
        "[",
        "](https://example.com)",
        "link text",
      ),
    ).toEqual({
      value: "Hello [link text](https://example.com)",
      selectionStart: 7,
      selectionEnd: 16,
    });
  });

  it("inserts headings at the start of the current line", () => {
    expect(prefixSelectedLines("Hello world", 6, 6, "## ", "Heading")).toEqual({
      value: "## Hello world",
      selectionStart: 9,
      selectionEnd: 9,
    });
  });

  it("formats each selected line as a list", () => {
    expect(prefixSelectedLines("One\nTwo", 0, 7, "- ", "Item").value).toBe(
      "- One\n- Two",
    );
  });
});
