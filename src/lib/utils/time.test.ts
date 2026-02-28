import { describe, expect, it } from "vitest";
import { getNextTopOfUtcHour } from "./time";

describe("getNextTopOfUtcHour", () => {
  it("uses UTC boundaries for +05:30 offsets", () => {
    const now = new Date("2026-02-22T10:20:00+05:30");
    const next = getNextTopOfUtcHour(now);

    expect(next.toISOString()).toBe("2026-02-22T05:00:00.000Z");
    expect(next.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("uses UTC boundaries for -03:30 offsets", () => {
    const now = new Date("2026-02-22T10:20:00-03:30");
    const next = getNextTopOfUtcHour(now);

    expect(next.toISOString()).toBe("2026-02-22T14:00:00.000Z");
    expect(next.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("supports 45-minute offsets", () => {
    const now = new Date("2026-02-22T10:20:00+05:45");
    const next = getNextTopOfUtcHour(now);

    expect(next.toISOString()).toBe("2026-02-22T05:00:00.000Z");
    expect(next.getTime() - now.getTime()).toBe(25 * 60 * 1000);
  });

  it("returns now when already exactly on the UTC hour boundary", () => {
    const now = new Date("2026-02-22T05:00:00.000Z");
    const next = getNextTopOfUtcHour(now);

    expect(next.toISOString()).toBe("2026-02-22T05:00:00.000Z");
  });
});
