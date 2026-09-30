export type Composition = {
  key: string;
  name: string;
  color: string;
  house: number;
  senate: number;
  president: number;
};

export type CoalitionMembership = {
  partyId: number;
  coalitionId: number;
  name: string;
  color: string;
  joinedAt: Date | null;
  leftAt: Date | null;
};

export function coalitionCompositionFor(
  composition: Array<Composition>,
  occurredAt: Date,
  memberships: Array<CoalitionMembership>,
): Array<Composition> {
  const groups = new Map<string, Composition>();
  for (const party of composition) {
    const partyId = /^party-(\d+)$/.exec(party.key)?.[1];
    const membership = partyId
      ? memberships.find(
          (member) =>
            member.partyId === Number(partyId) &&
            (!member.joinedAt || member.joinedAt <= occurredAt) &&
            (!member.leftAt || occurredAt < member.leftAt),
        )
      : null;
    const key = membership ? `coalition-${membership.coalitionId}` : party.key;
    const group = groups.get(key) ?? {
      key,
      name: membership?.name ?? party.name,
      color: membership?.color ?? party.color,
      house: 0,
      senate: 0,
      president: 0,
    };
    group.house += party.house;
    group.senate += party.senate;
    group.president += party.president;
    groups.set(key, group);
  }
  return [...groups.values()];
}
