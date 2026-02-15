interface Candidate {
  votes: number | null;
  partyName: string | null;
}

/**
 * Sorts candidates by votes (descending) whilst keeping party members
 * grouped together where possible without breaking vote order.
 * Candidates with null partyName are treated as independents (not grouped).
 */
export function sortCandidatesByParty<T extends Candidate>(
  candidates: Array<T>,
): Array<T> {
  if (candidates.length === 0) return [];

  // Pre-group and pre-sort candidates by party
  const partyGroups = new Map<string, Array<{ candidate: T; votes: number }>>();
  const partyMaxVotes = new Map<string, number>();

  // Track independent candidates (null partyName) separately
  let independentCounter = 0;

  for (const candidate of candidates) {
    const votes = candidate.votes ?? 0;

    // Treat null partyName as independent (unique party per candidate)
    const partyName =
      candidate.partyName ?? `__independent_${independentCounter++}`;

    if (!partyGroups.has(partyName)) {
      partyGroups.set(partyName, []);
      partyMaxVotes.set(partyName, votes);
    } else if (votes > partyMaxVotes.get(partyName)!) {
      partyMaxVotes.set(partyName, votes);
    }

    partyGroups.get(partyName)!.push({ candidate, votes });
  }

  // Sort each party group once (descending by votes)
  for (const group of partyGroups.values()) {
    group.sort((a, b) => b.votes - a.votes);
  }

  // Track current index position in each party group
  const partyIndices = new Map<string, number>();
  for (const partyName of partyGroups.keys()) {
    partyIndices.set(partyName, 0);
  }

  const sortedCandidates: Array<T> = [];
  let remaining = candidates.length;

  while (remaining > 0) {
    // Find party with highest remaining candidate
    let topParty: string | null = null;
    let topVotes = -1;

    for (const [partyName, index] of partyIndices) {
      const group = partyGroups.get(partyName)!;
      if (index < group.length) {
        const votes = group[index].votes;
        if (votes > topVotes) {
          topVotes = votes;
          topParty = partyName;
        }
      }
    }

    // Find highest votes amongst OTHER parties, excluding those at the same
    // vote level as our top candidate (since they'll be processed next anyway)
    let highestOtherVotes = 0;
    for (const [partyName, index] of partyIndices) {
      if (partyName !== topParty) {
        const group = partyGroups.get(partyName)!;
        if (index < group.length) {
          const votes = group[index].votes;
          // Only consider votes strictly less than our top candidate's votes
          if (votes < topVotes && votes > highestOtherVotes) {
            highestOtherVotes = votes;
          }
        }
      }
    }

    // Add all qualifying members from top party
    const topGroup = partyGroups.get(topParty!)!;
    let startIndex = partyIndices.get(topParty!)!;

    while (
      startIndex < topGroup.length &&
      topGroup[startIndex].votes >= highestOtherVotes
    ) {
      sortedCandidates.push(topGroup[startIndex].candidate);
      startIndex++;
      remaining--;
    }

    partyIndices.set(topParty!, startIndex);
  }

  return sortedCandidates;
}
