import type { CurrentElectionDashboard } from "@/lib/server/elections/elections";

type Race = CurrentElectionDashboard["races"][number];
type RaceForAction = { election: string; status: string;
  player: Pick<Race["player"], "isCandidate" | "isPrimaryCandidate">;
};
type CurrentUser = {
  id: number;
  role: string | null;
  partyId: number | null;
  partyName: string | null;
  active?: boolean | null;
} | null;

export function canDeclareNationalCandidacy(race: RaceForAction, races: Array<RaceForAction>, currentUser: CurrentUser) {
  if (!currentUser || currentUser.active === false || currentUser.active === null || race.status !== "CANDIDACY" || race.player.isCandidate) return false;
  if (race.election === "President" && currentUser.partyId) return false;
  if (races.some((other) => other.election !== race.election && other.player.isCandidate)) return false;
  if (race.election === "Senate" && (race.player.isPrimaryCandidate || currentUser.role === "President")) return false;
  if (race.election === "President" && currentUser.role === "Senator") return false;
  return true;
}
