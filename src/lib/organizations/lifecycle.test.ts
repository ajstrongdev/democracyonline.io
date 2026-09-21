import { describe, expect, it } from "vitest";
import { canReviveCoalition, canReviveParty } from "./lifecycle";

describe("party revival eligibility", () => {
  it("allows an independent former leader", () => {
    expect(
      canReviveParty({
        actorUserId: 4,
        actorPartyId: null,
        formerLeaderId: 4,
        isAdmin: false,
      }),
    ).toBe(true);
  });

  it("allows an independent admin but never defects an existing member", () => {
    expect(
      canReviveParty({
        actorUserId: 8,
        actorPartyId: null,
        formerLeaderId: 4,
        isAdmin: true,
      }),
    ).toBe(true);
    expect(
      canReviveParty({
        actorUserId: 8,
        actorPartyId: 12,
        formerLeaderId: 4,
        isAdmin: true,
      }),
    ).toBe(false);
  });

  it("rejects a non-admin who was not the former leader", () => {
    expect(
      canReviveParty({
        actorUserId: 8,
        actorPartyId: null,
        formerLeaderId: 4,
        isAdmin: false,
      }),
    ).toBe(false);
  });
});

describe("coalition revival eligibility", () => {
  const eligible = {
    actorPartyId: 3,
    actorIsPartyLeader: true,
    actorPartyCoalitionId: null,
    actorPartyWasMember: true,
    actorPartyIsArchived: false,
    isAdmin: false,
  };

  it("allows the current leader of a former member party", () => {
    expect(canReviveCoalition(eligible)).toBe(true);
  });

  it("rejects non-leaders and parties without former membership", () => {
    expect(canReviveCoalition({ ...eligible, actorIsPartyLeader: false })).toBe(
      false,
    );
    expect(
      canReviveCoalition({ ...eligible, actorPartyWasMember: false }),
    ).toBe(false);
  });

  it("allows an admin sponsor but rejects archived or already allied parties", () => {
    expect(
      canReviveCoalition({
        ...eligible,
        actorIsPartyLeader: false,
        actorPartyWasMember: false,
        isAdmin: true,
      }),
    ).toBe(true);
    expect(
      canReviveCoalition({
        ...eligible,
        actorPartyCoalitionId: 9,
        isAdmin: true,
      }),
    ).toBe(false);
    expect(
      canReviveCoalition({
        ...eligible,
        actorPartyIsArchived: true,
        isAdmin: true,
      }),
    ).toBe(false);
  });
});
