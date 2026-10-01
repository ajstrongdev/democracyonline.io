import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "bun:test";
import {
  canGuideBill,
  canIssuePartyGuidance,
  pendingBillGuidanceCondition,
} from "./pending-guidance";

const chiefWhip = {
  id: 10,
  partyId: 3,
  partyLeaderId: 10,
  partyChiefWhipId: 10,
  partyArchivedAt: null,
  active: true,
};

describe("pending bill voting guidance", () => {
  it("is only available to active chief whips of non-archived parties", () => {
    expect(canIssuePartyGuidance(chiefWhip)).toBe(true);
    expect(canIssuePartyGuidance({ ...chiefWhip, active: false })).toBe(false);
    expect(canIssuePartyGuidance({ ...chiefWhip, partyChiefWhipId: 11 })).toBe(
      false,
    );
    expect(canIssuePartyGuidance({ ...chiefWhip, partyId: null })).toBe(false);
    expect(
      canIssuePartyGuidance({ ...chiefWhip, partyArchivedAt: new Date() }),
    ).toBe(false);
  });

  it("covers committee, its queue, and every voting stage until guidance is issued", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      pendingBillGuidanceCondition(chiefWhip.partyId)!,
    );
    expect(sql).toContain('"bills"."status" =');
    expect(sql).toContain('"bills"."stage" =');
    expect(sql).toContain('"bills"."stage_ends_at"');
    expect(sql).toContain('not exists (select 1 from "bill_party_whips"');
    expect(sql).toContain('"bill_party_whips"."bill_id" = "bills"."id"');
    expect(sql).toContain('"bill_party_whips"."party_id" =');
    expect(params[0]).toBe("Voting");
    expect(params[2]).toBe("Committee");
    expect(params.slice(4, 6)).toEqual(["Queued", "Committee"]);
    expect(params.at(-1)).toBe(chiefWhip.partyId);
  });

  it("permits committee queue and live stages, not completed or other queued stages", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const future = new Date("2026-09-30T13:00:00Z");
    const past = new Date("2026-09-30T11:00:00Z");
    expect(
      canGuideBill(
        { status: "Queued", stage: "Committee", stageEndsAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      canGuideBill(
        { status: "Committee", stage: "Committee", stageEndsAt: future },
        now,
      ),
    ).toBe(true);
    expect(
      canGuideBill(
        { status: "Voting", stage: "House", stageEndsAt: future },
        now,
      ),
    ).toBe(true);
    expect(
      canGuideBill(
        { status: "Queued", stage: "House", stageEndsAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      canGuideBill(
        { status: "Committee", stage: "Committee", stageEndsAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      canGuideBill(
        { status: "Voting", stage: "House", stageEndsAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      canGuideBill(
        { status: "Defeated", stage: "House", stageEndsAt: null },
        now,
      ),
    ).toBe(false);
  });
});
