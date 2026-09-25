import { describe, expect, it } from "vitest";
import { avatarChoices, avatarForUsername, avatarSchema, defaultAvatar, renderAvatar } from "./avatar";

describe("player avatars", () => {
  it("renders local SVG data from preset choices", () => {
    expect(renderAvatar(defaultAvatar)).toMatch(/^data:image\/svg\+xml/);
  });

  it("rejects arbitrary URLs, SVG, and custom colors", () => {
    expect(avatarSchema.safeParse({ ...defaultAvatar, top: "https://example.com/picture.png" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...defaultAvatar, skinColor: "123456" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...defaultAvatar, svg: "<svg />" }).success).toBe(false);
  });

  it("accepts every offered skin tone and headwear option", () => {
    for (const skinColor of avatarChoices.skinColor) {
      expect(avatarSchema.safeParse({ ...defaultAvatar, skinColor }).success).toBe(true);
    }
    for (const top of avatarChoices.top) {
      expect(avatarSchema.safeParse({ ...defaultAvatar, top }).success).toBe(true);
      expect(renderAvatar({ ...defaultAvatar, top })).toMatch(/^data:image\/svg\+xml/);
    }
  });

  it("preserves existing saved avatars while defaulting new controls", () => {
    const previousConfig: Record<string, string> = { ...defaultAvatar };
    for (const key of ["backgroundAccent", "backgroundType", "backgroundRotation", "framing", "mirror", "scale"]) {
      delete previousConfig[key];
    }
    const parsed = avatarSchema.parse(previousConfig);
    expect(parsed).toEqual(defaultAvatar);
    const gradient = renderAvatar({ ...parsed, backgroundType: "gradientLinear", backgroundAccent: "ffafb9", backgroundRotation: "135", framing: "circle", mirror: "mirrored", scale: "110" });
    expect(gradient).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(gradient)).toContain("#ffafb9");
  });

  it("allows the expanded palettes but still rejects unlisted colors and settings", () => {
    expect(avatarChoices.skinColor.length).toBeGreaterThan(30);
    expect(avatarChoices.hairColor.length).toBeGreaterThan(30);
    expect(avatarChoices.clothesColor.length).toBeGreaterThan(50);
    expect(avatarChoices.backgroundColor.length).toBeGreaterThan(40);
    expect(avatarSchema.safeParse({ ...defaultAvatar, skinColor: "8ac0a8", hairColor: "c65494", clothesColor: "e11d48" }).success).toBe(true);
    expect(avatarSchema.safeParse({ ...defaultAvatar, backgroundType: "custom" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...defaultAvatar, backgroundColor: "ff00ff" }).success).toBe(false);
  });

  it("renders all three illustration styles and their extra hair choices", () => {
    expect(avatarChoices.top.length + avatarChoices.adventurerHair.length + avatarChoices.loreleiHair.length).toBeGreaterThan(120);
    for (const adventurerHair of avatarChoices.adventurerHair) {
      expect(renderAvatar({ ...defaultAvatar, avatarStyle: "adventurer", adventurerHair })).toMatch(/^data:image\/svg\+xml/);
    }
    for (const loreleiHair of avatarChoices.loreleiHair) {
      expect(renderAvatar({ ...defaultAvatar, avatarStyle: "lorelei", loreleiHair })).toMatch(/^data:image\/svg\+xml/);
    }
  });

  it("accepts older saved configs and rejects invented style parts", () => {
    const previousConfig: Record<string, string> = { ...defaultAvatar };
    for (const key of Object.keys(previousConfig)) {
      if (key === "avatarStyle" || key.startsWith("adventurer") || key.startsWith("lorelei")) delete previousConfig[key];
    }
    expect(avatarSchema.parse(previousConfig).avatarStyle).toBe("avataaars");
    expect(avatarSchema.safeParse({ ...defaultAvatar, avatarStyle: "custom" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...defaultAvatar, adventurerHair: "short99" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...defaultAvatar, loreleiHair: "variant99" }).success).toBe(false);
  });

  it("applies visible feature choices rather than just changing the label", () => {
    const adventurerBase = { ...defaultAvatar, avatarStyle: "adventurer" as const };
    expect(renderAvatar({ ...adventurerBase, adventurerGlasses: "none" }))
      .not.toBe(renderAvatar({ ...adventurerBase, adventurerGlasses: "variant01" }));
    const loreleiBase = { ...defaultAvatar, avatarStyle: "lorelei" as const };
    expect(renderAvatar({ ...loreleiBase, loreleiFreckles: "none" }))
      .not.toBe(renderAvatar({ ...loreleiBase, loreleiFreckles: "freckles" }));
  });

  it("generates stable, distinct defaults for players without a saved avatar", () => {
    expect(avatarForUsername("Alice")).toEqual(avatarForUsername("Alice"));
    expect(avatarForUsername("Alice")).not.toEqual(avatarForUsername("Bob"));
  });
});
