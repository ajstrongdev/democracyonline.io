import { describe, expect, it } from "vitest";
import { playerArchiveCutoff } from "./player-archive";

describe("player archiving", () => {
  it("uses 14 real-life days, regardless of game speed", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const cutoff = playerArchiveCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-09-12T12:00:00.000Z");
    expect(new Date("2026-09-12T11:59:59Z") < cutoff).toBe(true);
    expect(new Date("2026-09-12T12:00:01Z") < cutoff).toBe(false);
  });
});
