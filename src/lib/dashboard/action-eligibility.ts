import type { CurrentElectionDashboard } from "@/lib/server/elections/elections";
import { canDeclareNationalCandidacy } from "@/lib/elections/dashboard-actions";

type Player = {
  id: number;
  role: string | null;
  partyId: number | null;
  partyName: string | null;
  active: boolean | null;
} | null;

export function primaryNextMoves(
  primary: {
    electionStatus: string | null;
    isCandidate: boolean;
    candidates: Array<unknown>;
    hasVoted: boolean;
    candidacyEndsAt: Date | null;
  } | null,
  currentUser: Player,
  electionDashboard: { races: Array<{ player: { isCandidate: boolean } }> },
) {
  return {
    stand: primary?.electionStatus === "CANDIDACY" && !primary.isCandidate &&
      currentUser?.role !== "Senator" && !electionDashboard.races.some((race) => race.player.isCandidate),
    withdraw: primary?.electionStatus === "CANDIDACY" && primary.isCandidate,
    vote: primary?.electionStatus === "CANDIDACY" && primary.candidates.length > 0 && !primary.hasVoted,
    hasVoted: primary?.hasVoted ?? false,
    deadline: primary?.candidacyEndsAt ?? null,
  };
}

export function electionNextMoves(electionDashboard: CurrentElectionDashboard, currentUser: Player) {
  const races = electionDashboard.races;
  return {
    votes: currentUser?.active
      ? races.filter((race) => race.status === "VOTING" && !race.player.hasVoted && race.candidates.length > 0)
      : [],
    candidacies: currentUser?.active
      ? races.filter((race) => canDeclareNationalCandidacy(race, races, currentUser))
      : [],
  };
}
