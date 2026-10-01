import { describe, expect, it } from "bun:test";
import { colorSchemeInput, colorSchemeStyle, contrast } from "./color-schemes";

const scheme = {
  name: "Midnight purple",
  mode: "dark" as const,
  background: "#151525",
  foreground: "#f8f8fa",
  primary: "#9a80e9",
  accent: "#64d9bd",
  isPublished: false,
};

describe("custom colour schemes", () => {
  it("accepts readable palettes and derives safe theme variables", () => {
    expect(colorSchemeInput.safeParse(scheme).success).toBe(true);
    const css = colorSchemeStyle(scheme);
    expect(css["--primary"]).toBe(scheme.primary);
    expect(
      contrast(css["--primary"], css["--primary-foreground"]),
    ).toBeGreaterThanOrEqual(4.5);
    expect(css["--sidebar"]).toContain(scheme.background);
  });

  it("rejects unsafe CSS and unreadable text", () => {
    expect(
      colorSchemeInput.safeParse({
        ...scheme,
        primary: "url(https://example.com)",
      }).success,
    ).toBe(false);
    expect(
      colorSchemeInput.safeParse({ ...scheme, foreground: "#151526" }).success,
    ).toBe(false);
    expect(
      colorSchemeInput.safeParse({ ...scheme, primary: scheme.background })
        .success,
    ).toBe(false);
    expect(colorSchemeInput.safeParse({ ...scheme, name: "x" }).success).toBe(
      false,
    );
    expect(
      colorSchemeInput.safeParse({ ...scheme, name: "Hidden\u202e name" }).success,
    ).toBe(false);
  });
});
