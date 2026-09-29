import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
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

  it("covers every voting stage until that party has issued guidance", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      pendingBillGuidanceCondition(chiefWhip.partyId)!,
    );
    expect(sql).toContain('"bills"."status" =');
    expect(sql).not.toContain('"bills"."stage" =');
    expect(sql).not.toContain('"bills"."stage_ends_at"');
    expect(sql).toContain('not exists (select 1 from "bill_party_whips"');
    expect(sql).toContain('"bill_party_whips"."bill_id" = "bills"."id"');
    expect(sql).toContain('"bill_party_whips"."party_id" =');
    expect(params).toEqual(["Voting", chiefWhip.partyId]);
  });
});
