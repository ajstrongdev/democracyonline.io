import { describe, expect, it } from "bun:test";
import oscana from "../../instances/oscana.json";
import { parseInstanceConfig } from "./instance-config";

describe("instance configuration", () => {
  it("reproduces Oscana's branding and nation", () => {
    const config = parseInstanceConfig(oscana);
    expect(config.name).toBe("Oscana");
    expect(config.nationName).toBe("The Republic of Oscana");
    expect(config.branding.icon).toBe("/favicon.ico");
  });

  it("provides optional defaults", () => {
    const config = parseInstanceConfig({
      id: oscana.id,
      name: oscana.name,
      nationName: oscana.nationName,
      description: oscana.description,
      domain: oscana.domain,
      locale: oscana.locale,
      timeZone: oscana.timeZone,
      branding: { logo: "/logo.png", icon: "/icon.png" },
    });
    expect(config.terminology.president).toBe("President");
    expect(config.features.social).toBe(true);
    expect(config.branding.socialName).toBe("Social");
  });

  it("rejects missing identity and invalid locale, timezone, or paths", () => {
    for (const value of [
      { ...oscana, name: "" },
      { ...oscana, timeZone: "not/a-zone" },
      { ...oscana, locale: "!" },
      { ...oscana, domain: "ftp://example.org" },
      { ...oscana, game: { ...oscana.game, gameAdvanceScheduleUtc: "not a schedule" } },
      { ...oscana, branding: { ...oscana.branding, icon: "https://elsewhere/icon.ico" } },
    ]) {
      expect(() => parseInstanceConfig(value)).toThrow("Invalid instance configuration");
    }
  });
});
