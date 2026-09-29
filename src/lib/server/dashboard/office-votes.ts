import { billVotesHouse, billVotesPresidential, billVotesSenate } from "@/db/schema";

export const officeVotingConfig = {
  Representative: {
    stage: "House",
    chamber: "House of Representatives",
    route: "/dashboard/bills",
    votes: billVotesHouse,
  },
  Senator: {
    stage: "Senate",
    chamber: "Senate",
    route: "/dashboard/bills",
    votes: billVotesSenate,
  },
  President: {
    stage: "Presidential",
    chamber: "Oval Office",
    route: "/dashboard/bills",
    votes: billVotesPresidential,
  },
} as const;
