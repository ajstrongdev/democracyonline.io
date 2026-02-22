import { describe, expect, it } from "vitest";
import {
  getNextUtcTimeFromCron,
  getSingleDailyUtcAnchor,
  parseUtcCronSchedule,
} from "./utc-schedule";

describe("parseUtcCronSchedule", () => {
  it("parses minute and hour lists", () => {
    const parsed = parseUtcCronSchedule("0 4,12,20 * * *");
    expect(parsed.minuteValues).toEqual([0]);
    expect(parsed.hourValues).toEqual([4, 12, 20]);
  });

  it("rejects unsupported day/month/week fields", () => {
    expect(() => parseUtcCronSchedule("0 20 * * 1")).toThrow();
  });
});

describe("getNextUtcTimeFromCron", () => {
  it("handles top-of-hour schedules for half-hour offsets", () => {
    const now = new Date("2026-02-22T10:20:00+05:30");
    const next = getNextUtcTimeFromCron("0 * * * *", now);

    expect(next.toISOString()).toBe("2026-02-22T05:00:00.000Z");
    expect(next.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("handles step schedules", () => {
    const now = new Date("2026-02-22T10:22:40.000Z");
    const next = getNextUtcTimeFromCron("*/5 * * * *", now);

    expect(next.toISOString()).toBe("2026-02-22T10:25:00.000Z");
  });

  it("returns now when exactly on a tick boundary", () => {
    const now = new Date("2026-02-22T20:00:00.000Z");
    const next = getNextUtcTimeFromCron("0 4,12,20 * * *", now);

    expect(next.toISOString()).toBe("2026-02-22T20:00:00.000Z");
  });

  it("rolls over after a boundary has passed", () => {
    const now = new Date("2026-02-22T20:00:01.000Z");
    const next = getNextUtcTimeFromCron("0 20 * * *", now);

    expect(next.toISOString()).toBe("2026-02-23T20:00:00.000Z");
  });
});

describe("getSingleDailyUtcAnchor", () => {
  it("returns hour and minute for a single daily schedule", () => {
    expect(getSingleDailyUtcAnchor("0 20 * * *")).toEqual({
      hour: 20,
      minute: 0,
    });
  });

  it("returns null for multi-hour schedules", () => {
    expect(getSingleDailyUtcAnchor("0 4,12,20 * * *")).toBeNull();
  });
});
