export interface SuspicionSignals {
  redemptionMinutes: number | null;
  inviterRedemptionsIn24Hours: number;
  ancestryDepth: number;
  distinctPendingReporters: number;
}

export interface SuspicionContribution {
  signal: "invite_timing" | "inviter_burst" | "invite_tree" | "reports";
  points: number;
  explanation: string;
}

export interface SuspicionAssessment {
  score: number;
  threshold: number;
  shouldFlag: boolean;
  contributions: Array<SuspicionContribution>;
}

export const AUTOMATIC_FLAG_THRESHOLD = 40;

export function calculateSuspicion(
  signals: SuspicionSignals,
): SuspicionAssessment {
  const contributions: Array<SuspicionContribution> = [];

  if (signals.redemptionMinutes !== null && signals.redemptionMinutes <= 10) {
    contributions.push({
      signal: "invite_timing",
      points: 20,
      explanation: "Invitation was redeemed within 10 minutes",
    });
  } else if (
    signals.redemptionMinutes !== null &&
    signals.redemptionMinutes <= 60
  ) {
    contributions.push({
      signal: "invite_timing",
      points: 10,
      explanation: "Invitation was redeemed within one hour",
    });
  }

  const burstPoints = Math.min(
    Math.max(signals.inviterRedemptionsIn24Hours - 1, 0) * 5,
    25,
  );
  if (burstPoints > 0) {
    contributions.push({
      signal: "inviter_burst",
      points: burstPoints,
      explanation: `${signals.inviterRedemptionsIn24Hours} invitations from the inviter were redeemed in 24 hours`,
    });
  }

  const treePoints = Math.min(Math.max(signals.ancestryDepth - 3, 0) * 3, 15);
  if (treePoints > 0) {
    contributions.push({
      signal: "invite_tree",
      points: treePoints,
      explanation: `Invitation ancestry is ${signals.ancestryDepth} levels deep`,
    });
  }

  const reportPoints = Math.min(signals.distinctPendingReporters * 20, 60);
  if (reportPoints > 0) {
    contributions.push({
      signal: "reports",
      points: reportPoints,
      explanation: `${signals.distinctPendingReporters} distinct player report${signals.distinctPendingReporters === 1 ? "" : "s"} pending`,
    });
  }

  const score = Math.min(
    100,
    contributions.reduce((total, item) => total + item.points, 0),
  );
  return {
    score,
    threshold: AUTOMATIC_FLAG_THRESHOLD,
    shouldFlag: score >= AUTOMATIC_FLAG_THRESHOLD,
    contributions,
  };
}
