export type PartyRevivalCandidate = {
  actorUserId: number;
  actorPartyId: number | null;
  formerLeaderId: number | null;
  isAdmin: boolean;
};

export function canReviveParty(candidate: PartyRevivalCandidate) {
  if (candidate.actorPartyId !== null) return false;
  return (
    candidate.isAdmin || candidate.actorUserId === candidate.formerLeaderId
  );
}

export type CoalitionRevivalCandidate = {
  actorPartyId: number | null;
  actorIsPartyLeader: boolean;
  actorPartyCoalitionId: number | null;
  actorPartyWasMember: boolean;
  actorPartyIsArchived: boolean;
  isAdmin: boolean;
};

export function canReviveCoalition(candidate: CoalitionRevivalCandidate) {
  if (candidate.actorPartyId === null || candidate.actorPartyIsArchived) {
    return false;
  }
  if (candidate.actorPartyCoalitionId !== null) return false;
  return (
    candidate.isAdmin ||
    (candidate.actorIsPartyLeader && candidate.actorPartyWasMember)
  );
}
