export const billListStages = [
  "All",
  "Committee",
  "House",
  "Senate",
  "President",
  "Enacted",
  "Defeated",
] as const;

export type BillListStage = (typeof billListStages)[number];

export function billListStage(bill: {
  status: string;
  stage: string;
}): Exclude<BillListStage, "All"> {
  if (bill.status === "Passed") return "Enacted";
  if (bill.status === "Defeated") return "Defeated";
  if (bill.status === "Committee") return "Committee";
  if (bill.stage === "Senate") return "Senate";
  if (bill.stage === "Presidential") return "President";
  return "House";
}
