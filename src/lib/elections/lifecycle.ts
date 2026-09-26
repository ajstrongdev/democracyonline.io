export const ELECTION_STATUSES = [
  "CANDIDACY",
  "VOTING",
  "ELECTION_NIGHT",
  "CONCLUDED",
] as const;

export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

export type ElectionStageTimestamps = {
  status: string;
  candidacyEndsAt: Date | null;
  votingEndsAt: Date | null;
  electionNightEndsAt: Date | null;
  concludedAt: Date | null;
};

export function normalizeElectionStatus(status: string): ElectionStatus {
  switch (status.trim().toUpperCase().replaceAll(" ", "_")) {
    case "CANDIDATE":
    case "CANDIDACY":
      return "CANDIDACY";
    case "VOTING":
      return "VOTING";
    case "ELECTION_NIGHT":
      return "ELECTION_NIGHT";
    case "CONCLUDED":
      return "CONCLUDED";
    default:
      throw new Error(`Unknown election status: ${status}`);
  }
}

export function getStageDeadline(
  election: ElectionStageTimestamps,
): Date | null {
  switch (normalizeElectionStatus(election.status)) {
    case "CANDIDACY":
      return election.candidacyEndsAt;
    case "VOTING":
      return election.votingEndsAt;
    case "ELECTION_NIGHT":
      return election.electionNightEndsAt;
    case "CONCLUDED":
      return null;
  }
}

export function isElectionStageOverdue(
  election: ElectionStageTimestamps,
  now: Date,
): boolean {
  const deadline = getStageDeadline(election);
  return deadline !== null && deadline.getTime() <= now.getTime();
}

export function isBeforeDeadline(deadline: Date | null, now: Date): boolean {
  return deadline === null || now.getTime() < deadline.getTime();
}

export function canDeclareCandidacy(
  status: string,
  deadline: Date | null,
  now: Date,
): boolean {
  return normalizeElectionStatus(status) === "CANDIDACY" && deadline !== null
    ? isBeforeDeadline(deadline, now)
    : false;
}

export function canSubmitBallot(
  status: string,
  deadline: Date | null,
  now: Date,
): boolean {
  return normalizeElectionStatus(status) === "VOTING" && deadline !== null
    ? isBeforeDeadline(deadline, now)
    : false;
}

export function getNextElectionStatus(status: string): ElectionStatus {
  switch (normalizeElectionStatus(status)) {
    case "CANDIDACY":
      return "VOTING";
    case "VOTING":
      return "ELECTION_NIGHT";
    case "ELECTION_NIGHT":
      return "CONCLUDED";
    case "CONCLUDED":
      return "CANDIDACY";
  }
}
