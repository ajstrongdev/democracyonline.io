export type VotingStage = "House" | "Senate" | "Presidential";

export function canIndicateVote(
  status: string,
  currentStage: string,
  targetStage: VotingStage,
) {
  if (status === "Committee") return true;
  if (status !== "Voting") return false;
  const stages: Array<VotingStage> = ["House", "Senate", "Presidential"];
  return (
    stages.indexOf(targetStage) > stages.indexOf(currentStage as VotingStage)
  );
}

export function breaksEnforcedWhip(position: string | null, voteYes: boolean) {
  return position !== null && (position === "For") !== voteYes;
}
