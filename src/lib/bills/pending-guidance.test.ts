import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  canIssuePartyGuidance,
  pendingBillGuidanceCondition,
} from "./pending-guidance";

const leader = {
  id: 10,
  partyId: 3,
  partyLeaderId: 10,
  partyArchivedAt: null,
  active: true,
};

describe("pending bill voting guidance", () => {
  it("is only available to active leaders of non-archived parties", () => {
    expect(canIssuePartyGuidance(leader)).toBe(true);
    expect(canIssuePartyGuidance({ ...leader, active: false })).toBe(false);
    expect(canIssuePartyGuidance({ ...leader, partyLeaderId: 11 })).toBe(false);
    expect(canIssuePartyGuidance({ ...leader, partyId: null })).toBe(false);
    expect(
      canIssuePartyGuidance({ ...leader, partyArchivedAt: new Date() }),
    ).toBe(false);
  });

  it("covers every voting stage until that party has issued guidance", () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      pendingBillGuidanceCondition(leader.partyId)!,
    );
    expect(sql).toContain('"bills"."status" =');
    expect(sql).not.toContain('"bills"."stage" =');
    expect(sql).not.toContain('"bills"."stage_ends_at"');
    expect(sql).toContain('not exists (select 1 from "bill_party_whips"');
    expect(sql).toContain('"bill_party_whips"."bill_id" = "bills"."id"');
    expect(sql).toContain('"bill_party_whips"."party_id" =');
    expect(params).toEqual(["Voting", leader.partyId]);
  });
});
