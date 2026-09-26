import { describe, expect, it } from "vitest";
import {
  FIXED_POLICY_VALUES,
  POLICY_BY_KEY,
  isBillMutablePolicy,
} from "./catalog";

describe("fixed constitutional policies", () => {
  it("defines a presidential republic led by the President", () => {
    expect(FIXED_POLICY_VALUES).toEqual({
      government_system: "presidential",
      head_of_state_type: "executive_president",
    });
    expect(POLICY_BY_KEY.get("government_system")?.defaultValue).toBe(
      "presidential",
    );
    expect(POLICY_BY_KEY.get("head_of_state_type")?.defaultValue).toBe(
      "executive_president",
    );
  });

  it("keeps fixed policies out of legislation", () => {
    expect(isBillMutablePolicy("government_system")).toBe(false);
    expect(isBillMutablePolicy("head_of_state_type")).toBe(false);
    expect(isBillMutablePolicy("universal_healthcare")).toBe(true);
  });
});
