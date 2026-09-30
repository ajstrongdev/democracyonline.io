export const COALITION_VOTE_DURATION_MS = 24 * 60 * 60 * 1000;

export function coalitionVoteEndsAt(createdAt: Date | string): Date {
  return new Date(new Date(createdAt).getTime() + COALITION_VOTE_DURATION_MS);
}

export function decideTimedCoalitionVote(
  memberCount: number,
  votesFor: number,
  votesAgainst: number,
  createdAt: Date | string,
  now: Date,
  partiesVoted: number,
): "approved" | "rejected" | "open" {
  if (coalitionVoteEndsAt(createdAt) > now && partiesVoted < memberCount)
    return "open";
  return memberCount > 0 &&
    decideCoalitionVote(memberCount, votesFor, votesAgainst) === "approved"
    ? "approved"
    : "rejected";
}

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
