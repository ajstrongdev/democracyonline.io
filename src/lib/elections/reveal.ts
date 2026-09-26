export type RevealCandidate = {
  id: number;
  name: string;
  total: number;
};

export type ElectionNightUpdate = {
  sequence: number;
  revealAt: Date;
  type: "OPENING" | "UPDATE" | "LEAD_CHANGE" | "MILESTONE" | "FINAL";
  headline: string;
  cumulativeTotals: Record<string, number>;
  totalPoints: number;
  reportingPercent: number;
};

export type RevealPlanOptions = {
  seed: string;
  startsAt: Date;
  durationMs: number;
  updateCount?: number;
};

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function leaderOf(
  candidates: Array<RevealCandidate>,
  totals: Record<string, number>,
): RevealCandidate | null {
  const ordered = [...candidates].sort(
    (a, b) =>
      (totals[String(b.id)] ?? 0) - (totals[String(a.id)] ?? 0) || a.id - b.id,
  );
  const leader = ordered[0];
  const leaderTotal = leader ? (totals[String(leader.id)] ?? 0) : 0;
  const runnerUpTotal = ordered[1] ? (totals[String(ordered[1].id)] ?? 0) : -1;
  return leader && leaderTotal > 0 && leaderTotal > runnerUpTotal
    ? leader
    : null;
}

function pickWeightedCandidate(
  candidates: Array<RevealCandidate>,
  remaining: Record<string, number>,
  arrivalWeights: Record<string, number>,
  random: () => number,
): RevealCandidate | null {
  const totalRemaining = candidates.reduce(
    (sum, candidate) =>
      sum +
      (remaining[String(candidate.id)] ?? 0) *
        (arrivalWeights[String(candidate.id)] ?? 1),
    0,
  );
  if (totalRemaining === 0) return null;
  let ticket = random() * totalRemaining;
  for (const candidate of candidates) {
    const key = String(candidate.id);
    ticket -= (remaining[key] ?? 0) * (arrivalWeights[key] ?? 1);
    if (ticket < 0) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function getRevealUpdateCount(durationMs: number): number {
  const fiveMinutes = 5 * 60 * 1000;
  return Math.max(18, Math.round(durationMs / fiveMinutes));
}

function choose<T>(items: ReadonlyArray<T>, random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

export function generateElectionNightPlan(
  inputCandidates: Array<RevealCandidate>,
  options: RevealPlanOptions,
): Array<ElectionNightUpdate> {
  const candidates = [...inputCandidates]
    .map((candidate) => ({
      ...candidate,
      total: Math.max(0, Math.trunc(candidate.total)),
    }))
    .sort((a, b) => a.id - b.id);
  const random = seededRandom(options.seed);
  const totalPoints = candidates.reduce(
    (sum, candidate) => sum + candidate.total,
    0,
  );
  const requestedUpdates = Math.max(
    2,
    Math.trunc(options.updateCount ?? getRevealUpdateCount(options.durationMs)),
  );
  const updateCount =
    totalPoints > 0
      ? Math.min(requestedUpdates, totalPoints)
      : requestedUpdates;
  const remaining = Object.fromEntries(
    candidates.map((candidate) => [String(candidate.id), candidate.total]),
  );
  const cumulative = Object.fromEntries(
    candidates.map((candidate) => [String(candidate.id), 0]),
  );

  const scheduleWeights = Array.from(
    { length: updateCount - 1 },
    () => 0.4 + random() * 1.6,
  );
  const scheduleTotal = scheduleWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  );
  let elapsedWeight = 0;
  let reported = 0;
  let previousLeader: RevealCandidate | null = null;
  let previousMilestone = 0;
  let previousMargin = Number.POSITIVE_INFINITY;
  const updates: Array<ElectionNightUpdate> = [];

  for (let sequence = 1; sequence <= updateCount; sequence++) {
    const final = sequence === updateCount;
    const updatesLeft = updateCount - sequence + 1;
    const pointsRemaining = totalPoints - reported;
    const averageBatch = pointsRemaining / updatesLeft;
    const batchSize = final
      ? pointsRemaining
      : Math.max(
          1,
          Math.min(
            pointsRemaining - (updatesLeft - 1),
            Math.round(averageBatch * (0.55 + random() * 0.9)),
          ),
        );

    // Different reporting areas favour different candidates. Varying this per
    // tranche creates plausible early surprises without inventing points.
    const arrivalWeights = Object.fromEntries(
      candidates.map((candidate) => [
        String(candidate.id),
        0.35 + random() * 1.9,
      ]),
    );

    for (let point = 0; point < batchSize; point++) {
      const candidate = pickWeightedCandidate(
        candidates,
        remaining,
        arrivalWeights,
        random,
      );
      if (!candidate) break;
      const key = String(candidate.id);
      cumulative[key] += 1;
      remaining[key] -= 1;
      reported += 1;
    }

    if (!final && sequence > 1) elapsedWeight += scheduleWeights[sequence - 2];
    const revealAt = new Date(
      options.startsAt.getTime() +
        (final
          ? options.durationMs
          : (elapsedWeight / scheduleTotal) * options.durationMs),
    );
    const reportingPercent =
      totalPoints === 0 ? 100 : (reported / totalPoints) * 100;
    const leader = leaderOf(candidates, cumulative);
    const ordered = [...candidates].sort(
      (a, b) =>
        (cumulative[String(b.id)] ?? 0) - (cumulative[String(a.id)] ?? 0) ||
        a.id - b.id,
    );
    const margin = ordered[1]
      ? (cumulative[String(ordered[0].id)] ?? 0) -
        (cumulative[String(ordered[1].id)] ?? 0)
      : reported;
    const marginShare = reported > 0 ? margin / reported : 1;
    const milestone = Math.min(100, Math.floor(reportingPercent / 10) * 10);
    let type: ElectionNightUpdate["type"] = "UPDATE";
    let headline = `${reportingPercent.toFixed(0)}% of points now reporting`;

    if (sequence === 1) {
      type = "OPENING";
      headline = leader
        ? `${leader.name} leads in the opening report`
        : "The opening report is in";
    } else if (final) {
      type = "FINAL";
      headline = leader
        ? `${leader.name} finishes first as all points are reported`
        : "All points have been reported";
    } else if (leader && previousLeader && leader.id !== previousLeader.id) {
      type = "LEAD_CHANGE";
      headline = `${leader.name} takes the lead`;
    } else if (milestone > previousMilestone) {
      type = "MILESTONE";
      headline = leader
        ? `${milestone}% reporting, with ${leader.name} ahead`
        : `${milestone}% of points now reporting`;
    } else if (
      leader &&
      marginShare < 0.03 &&
      margin < previousMargin &&
      reported > 20
    ) {
      headline = choose(
        [
          `The race tightens as ${leader.name}'s advantage narrows`,
          `${leader.name} holds on in a tightening count`,
          `The leaders are separated by just ${margin.toLocaleString()} points`,
        ],
        random,
      );
    } else if (reportingPercent >= 90) {
      headline = choose(
        [
          "Final reports are arriving",
          `${leader?.name ?? "The leader"} waits on the last reports`,
          `${batchSize.toLocaleString()} more points added as the count nears its end`,
        ],
        random,
      );
    } else if (leader) {
      headline = choose(
        [
          `${leader.name} remains ahead with ${reportingPercent.toFixed(0)}% reporting`,
          `A fresh report keeps ${leader.name} in front`,
          `${batchSize.toLocaleString()} more points reported; ${leader.name} leads`,
          `Counting continues with ${leader.name} ahead`,
        ],
        random,
      );
    } else {
      headline = choose(
        [
          `Another ${batchSize.toLocaleString()} points have been reported`,
          "The latest report leaves the race level",
          `${reportingPercent.toFixed(0)}% reporting as counting continues`,
        ],
        random,
      );
    }

    updates.push({
      sequence,
      revealAt,
      type,
      headline,
      cumulativeTotals: { ...cumulative },
      totalPoints: Object.values(cumulative).reduce(
        (sum, points) => sum + points,
        0,
      ),
      reportingPercent,
    });
    previousLeader = leader;
    previousMilestone = Math.max(previousMilestone, milestone);
    previousMargin = margin;
  }

  return updates;
}
