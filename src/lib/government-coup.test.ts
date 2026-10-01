import { describe, expect, it } from "bun:test";
import { planCoup } from "./government-coup";

const target = { id: 2, username: "New leader", role: "Senator" };
const incumbent = { id: 1, username: "Old leader", role: "President" };

describe("admin coup role changes", () => {
  it("records the incoming president and displaced incumbent", () => {
    expect(planCoup(target, "President", [incumbent])).toEqual([
      {
        userId: 2,
        username: "New leader",
        fromOffice: "Senator",
        toOffice: "President",
      },
      {
        userId: 1,
        username: "Old leader",
        fromOffice: "President",
        toOffice: "Representative",
      },
    ]);
  });

  it("changes only the selected player for other offices", () => {
    expect(planCoup(target, "Representative", [incumbent])).toEqual([
      {
        userId: 2,
        username: "New leader",
        fromOffice: "Senator",
        toOffice: "Representative",
      },
    ]);
  });

  it("does not create an empty coup", () => {
    expect(() => planCoup(target, "Senator", [incumbent])).toThrow(
      "Player already has this role",
    );
  });
});
