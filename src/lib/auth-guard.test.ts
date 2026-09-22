import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "./auth-guard.ts";

describe("getAuthRedirect", () => {
    it("redirects guests away from protected routes", () => {
        expect(getAuthRedirect("/dashboard", false)).toBe("/login");
        expect(getAuthRedirect("/dashboard/players/42", false)).toBe("/login");
        expect(getAuthRedirect("/settings", false)).toBe("/login");
    });

    it("redirects authenticated users away from auth pages", () => {
        expect(getAuthRedirect("/login", true)).toBe("/dashboard");
        expect(getAuthRedirect("/register", true)).toBe("/dashboard");
    });

    it("waits for auth to finish loading before redirecting", () => {
        expect(getAuthRedirect("/dashboard", false, true)).toBeNull();
        expect(getAuthRedirect("/login", true, true)).toBeNull();
    });

    it("treats a persisted session cookie as authenticated during refresh", () => {
        expect(getAuthRedirect("/dashboard", false, false, true)).toBeNull();
        expect(getAuthRedirect("/login", false, false, true)).toBe("/dashboard");
    });

    it("allows public routes and authenticated access to protected routes", () => {
        expect(getAuthRedirect("/", true)).toBeNull();
        expect(getAuthRedirect("/dashboard", true)).toBeNull();
        expect(getAuthRedirect("/wiki", false)).toBeNull();
    });
});
