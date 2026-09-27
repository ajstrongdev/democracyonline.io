export function decideCoalitionVote(
  memberCount: number,
  votesFor: number,
  votesAgainst: number,
): "approved" | "rejected" | "pending" {
  const majority = Math.floor(memberCount / 2) + 1;
  if (votesFor >= majority) return "approved";
  if (votesAgainst >= majority || votesFor + votesAgainst >= memberCount)
    return "rejected";
  return "pending";
}
