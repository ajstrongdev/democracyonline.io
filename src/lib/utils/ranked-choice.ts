export type RankedScore = {
  candidateId: number;
  rank: number;
  points: number;
};

export function scoreRankedBallot(
  candidateIds: Array<number>,
  rankedCandidateIds: Array<number>,
): Array<RankedScore> {
  if (candidateIds.length === 0)
    throw new Error("The election has no candidates");
  if (rankedCandidateIds.length !== candidateIds.length) {
    throw new Error("Every candidate must be ranked exactly once");
  }

  const roster = new Set(candidateIds);
  const ranking = new Set(rankedCandidateIds);
  if (
    roster.size !== candidateIds.length ||
    ranking.size !== rankedCandidateIds.length
  ) {
    throw new Error("A ballot cannot contain duplicate candidates");
  }
  if (rankedCandidateIds.some((candidateId) => !roster.has(candidateId))) {
    throw new Error(
      "The ballot contains a candidate who is not in this election",
    );
  }

  return rankedCandidateIds.map((candidateId, index) => ({
    candidateId,
    rank: index + 1,
    points: candidateIds.length - index,
  }));
}
