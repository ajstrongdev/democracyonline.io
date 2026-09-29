/** Eligible members are snapshotted at launch; departed members no longer contribute. */
export function leadershipBidThreshold(memberCount: number) {
  return Math.ceil(memberCount / 2);
}

export function leadershipBidHasPassed(
  threshold: number,
  eligibleMemberIds: ReadonlyArray<number>,
  currentMemberIds: ReadonlyArray<number>,
  supporterIds: ReadonlyArray<number>,
) {
  const eligible = new Set(eligibleMemberIds);
  const current = new Set(currentMemberIds);
  return (
    supporterIds.filter((id) => eligible.has(id) && current.has(id)).length >=
    threshold
  );
}
