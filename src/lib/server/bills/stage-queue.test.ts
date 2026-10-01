import { describe, expect, it } from "bun:test";
import { BILL_QUEUE_STAGES, availableBillStageSlots } from "./stage-queue";

describe("bill stage queues", () => {
  it("provides three independent slots for each legislative stage", () => {
    expect(BILL_QUEUE_STAGES).toEqual([
      "Committee",
      "House",
      "Senate",
      "Presidential",
    ]);
    expect(availableBillStageSlots(0)).toBe(3);
    expect(availableBillStageSlots(1)).toBe(2);
    expect(availableBillStageSlots(2)).toBe(1);
    expect(availableBillStageSlots(3)).toBe(0);
    expect(availableBillStageSlots(4)).toBe(0);
  });
});
