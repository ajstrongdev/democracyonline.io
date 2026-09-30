import { describe, expect, it } from "vitest";
import { billListStage, billListStages } from "./list-stage";

describe("bill list stages", () => {
  it("offers every stage and outcome in legislative order", () => {
    expect(billListStages).toEqual([
      "All",
      "Committee",
      "House",
      "Senate",
      "President",
      "Enacted",
      "Defeated",
    ]);
  });

  it("separates committee review from the House stage stored on the bill", () => {
    expect(billListStage({ status: "Committee", stage: "House" })).toBe(
      "Committee",
    );
    expect(billListStage({ status: "Queued", stage: "Committee" })).toBe(
      "Committee",
    );
    expect(billListStage({ status: "Voting", stage: "House" })).toBe("House");
  });

  it("shows active chambers and terminal outcomes in distinct tabs", () => {
    expect(billListStage({ status: "Voting", stage: "Senate" })).toBe("Senate");
    expect(billListStage({ status: "Voting", stage: "Presidential" })).toBe(
      "President",
    );
    expect(billListStage({ status: "Passed", stage: "Presidential" })).toBe(
      "Enacted",
    );
    expect(billListStage({ status: "Defeated", stage: "House" })).toBe(
      "Defeated",
    );
  });
});
