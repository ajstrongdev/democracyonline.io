import { describe, expect, it } from "vitest";
import { formatPlayerLastSeen, isPlayerOnline } from "./player-presence";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("player presence", () => {
  it("shows online only for a recent active, unarchived player", () => {
    const player = {
      lastSeenAt: "2026-09-27T11:55:01.000Z",
      isActive: true,
      archivedAt: null,
      now,
    };
    expect(isPlayerOnline(player)).toBe(true);
    expect(
      isPlayerOnline({ ...player, lastSeenAt: "2026-09-27T11:55:00.000Z" }),
    ).toBe(false);
    expect(isPlayerOnline({ ...player, isActive: false })).toBe(false);
    expect(isPlayerOnline({ ...player, archivedAt: now })).toBe(false);
    expect(isPlayerOnline({ ...player, lastSeenAt: "not a date" })).toBe(false);
  });

  it("formats elapsed time in the viewer's locale", () => {
    expect(formatPlayerLastSeen("2026-09-27T11:00:00Z", now, "en-GB")).toBe(
      "1 hour ago",
    );
    expect(formatPlayerLastSeen("2026-09-26T12:00:00Z", now, "en-GB")).toBe(
      "1 day ago",
    );
    expect(formatPlayerLastSeen("2026-09-27T11:58:00Z", now, "en-GB")).toBe(
      "2 minutes ago",
    );
    expect(formatPlayerLastSeen(null, now, "en-GB")).toBe("Unknown");
  });
});
