import { describe, expect, it } from "vitest";
import { inQuietHours, isTrustedPushEndpoint, isValidTimeZone } from "./push-policy";

describe("Web Push safety and quiet hours", () => {
  it("rejects local, alternate-port and credentialed delivery URLs", () => {
    expect(isTrustedPushEndpoint("https://fcm.googleapis.com/fcm/send/example")).toBe(true);
    expect(isTrustedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/example")).toBe(true);
    expect(isTrustedPushEndpoint("http://127.0.0.1:9099/steal")).toBe(false);
    expect(isTrustedPushEndpoint("https://fcm.googleapis.com:444/steal")).toBe(false);
    expect(isTrustedPushEndpoint("https://fcm.googleapis.com.evil.test/steal")).toBe(false);
    expect(isTrustedPushEndpoint("https://user:password@fcm.googleapis.com/steal")).toBe(false);
  });

  it("evaluates overnight quiet hours in the player's time zone", () => {
    const quiet = { quietStart: 22 * 60, quietEnd: 7 * 60, timeZone: "America/New_York" };
    expect(inQuietHours(new Date("2026-07-01T03:00:00Z"), quiet)).toBe(true);
    expect(inQuietHours(new Date("2026-07-01T14:00:00Z"), quiet)).toBe(false);
    expect(inQuietHours(new Date("2026-07-01T11:00:00Z"), quiet)).toBe(false);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});
