import { describe, expect, it } from "vitest";
import { coalitionDesignation } from "@/lib/organizations/coalition-status";

describe("coalition designation", () => {
  it("remains an electoral pact until three parties join", () => {
    expect(coalitionDesignation(0)).toBe("Electoral Pact");
    expect(coalitionDesignation(1)).toBe("Electoral Pact");
    expect(coalitionDesignation(2)).toBe("Electoral Pact");
    expect(coalitionDesignation(3)).toBe("Coalition");
    expect(coalitionDesignation(4)).toBe("Coalition");
  });
});
