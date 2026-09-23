import { createServerFn } from "@tanstack/react-start";
import { asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { bills, elections, gameTracker } from "@/db/schema";
import { env } from "@/env";
import { ensureElectionSchedule } from "@/lib/server/election-schedule";
import {
  DEFAULT_GAME_ADVANCE_SCHEDULE_UTC,
  getSingleDailyUtcAnchor,
  resolveUtcCronSchedule,
} from "@/lib/utils/utc-schedule";

const GAME_ADVANCE_SCHEDULE_UTC = resolveUtcCronSchedule(
  env.GAME_ADVANCE_SCHEDULE_UTC,
  DEFAULT_GAME_ADVANCE_SCHEDULE_UTC,
);
const gameAdvanceDailyAnchor = getSingleDailyUtcAnchor(
  GAME_ADVANCE_SCHEDULE_UTC,
);
const GAME_ADVANCE_HOUR_UTC = gameAdvanceDailyAnchor?.hour ?? 20;
const GAME_ADVANCE_MINUTE_UTC = gameAdvanceDailyAnchor?.minute ?? 0;

export type CalendarEvent = {
  date: Date;
  title: string;
  description: string;
  type: "senate" | "president" | "bill" | "results";
};

export type CalendarData = {
  serverNow: Date;
  timerSchedules: {
    billAdvance: string;
    gameAdvance: string;
  };
  senateElection: {
    status: string;
    daysRemaining: number;
    nextStageTime: Date;
    nextStageName: string;
  } | null;
  presidentialElection: {
    status: string;
    daysRemaining: number;
    nextStageTime: Date;
    nextStageName: string;
  } | null;
  billAdvance: {
    currentPool: number;
    nextAdvanceTime: Date;
  };
  upcomingEvents: Array<CalendarEvent>;
};

function getNextStageName(status: string, electionType: string): string {
  if (status === "CANDIDACY") {
    return `${electionType} Elections - Time until Voting`;
  } else if (status === "VOTING") {
    return `${electionType} Elections - Time until Election Night`;
  } else if (status === "ELECTION_NIGHT") {
    return `${electionType} Elections - Time until Declaration`;
  } else if (status === "CONCLUDED") {
    return `${electionType} Elections - Time until Campaigning`;
  }
  return "Unknown Stage";
}

export const getCalendarData = createServerFn().handler(
  async (): Promise<CalendarData> => {
    const now = new Date();
    await ensureElectionSchedule({ now });

    const [senateData] = await db
      .select()
      .from(elections)
      .where(eq(elections.election, "Senate"))
      .limit(1);

    const [presidentData] = await db
      .select()
      .from(elections)
      .where(eq(elections.election, "President"))
      .limit(1);

    const [gameData] = await db.select().from(gameTracker).limit(1);
    const [nextBill] = await db
      .select({ stageEndsAt: bills.stageEndsAt })
      .from(bills)
      .where(isNotNull(bills.stageEndsAt))
      .orderBy(asc(bills.stageEndsAt))
      .limit(1);
    const currentPool = gameData?.billPool || 1;
    const billAdvanceTime = nextBill?.stageEndsAt ?? new Date(now.getTime() + 60_000);
    const currentStageTiming = (
      election: NonNullable<typeof senateData>,
      concludedDays: number,
    ) => {
      let deadline: Date | null = null;
      if (election.status === "CANDIDACY") {
        deadline = election.candidacyEndsAt;
      } else if (election.status === "VOTING") {
        deadline = election.votingEndsAt;
      } else if (election.status === "ELECTION_NIGHT") {
        deadline = election.electionNightEndsAt;
      } else if (election.status === "CONCLUDED" && election.concludedAt) {
        deadline = new Date(
          election.concludedAt.getTime() + concludedDays * 24 * 60 * 60 * 1000,
        );
      }
      if (!deadline) {
        throw new Error(`Missing timestamp for ${election.election} ${election.status}`);
      }
      const nextStageTime = deadline;
      return {
        nextStageTime,
        daysRemaining: Math.max(
          0,
          Math.ceil(
            (nextStageTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          ),
        ),
      };
    };

    let senateElection = null;
    if (senateData) {
      const timing = currentStageTiming(senateData, 6);
      senateElection = {
        status: senateData.status || "Unknown",
        ...timing,
        nextStageName: getNextStageName(senateData.status || "", "Senate"),
      };
    }

    // Process presidential election
    let presidentialElection = null;
    if (presidentData) {
      const timing = currentStageTiming(presidentData, 8);
      presidentialElection = {
        status: presidentData.status || "Unknown",
        ...timing,
        nextStageName: getNextStageName(
          presidentData.status || "",
          "Presidential",
        ),
      };
    }

    const upcomingEvents: Array<CalendarEvent> = [];

    const getEventDate = (daysFromNow: number): Date => {
      return new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + daysFromNow,
          GAME_ADVANCE_HOUR_UTC,
          GAME_ADVANCE_MINUTE_UTC,
          0,
          0,
        ),
      );
    };

    if (senateElection) {
      let pastStatus = senateElection.status;
      let daysSinceLast = 0;
      let totalDaysBack = 0;

      while (totalDaysBack < 28) {
        let prevStatus = "";
        let prevDuration = 0;

        if (pastStatus === "CANDIDACY") {
          prevStatus = "CONCLUDED";
          prevDuration = 6;
        } else if (pastStatus === "VOTING") {
          prevStatus = "CANDIDACY";
          prevDuration = 4;
        } else if (pastStatus === "ELECTION_NIGHT") {
          prevStatus = "VOTING";
          prevDuration = 1;
        } else if (pastStatus === "CONCLUDED") {
          prevStatus = "ELECTION_NIGHT";
          prevDuration = 1;
        }

        totalDaysBack += prevDuration;

        if (totalDaysBack <= 28) {
          const eventDate = getEventDate(-totalDaysBack);
          if (prevStatus === "CONCLUDED") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Candidacy Opens",
              description: "New senate election candidacy period starts",
              type: "senate",
            });
          } else if (prevStatus === "CANDIDACY") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "senate",
            });
          } else if (prevStatus === "VOTING") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Election Night",
              description: "Polls close and progressive reporting begins",
              type: "results",
            });
          } else if (prevStatus === "ELECTION_NIGHT") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Result Declared",
              description: "The final Senate result is certified",
              type: "results",
            });
          }
        }

        pastStatus = prevStatus;
        daysSinceLast += prevDuration;
      }

      let status = senateElection.status;
      let daysUntilNextEvent = senateElection.daysRemaining;
      let totalDaysFromNow = 0;

      while (totalDaysFromNow < 365) {
        if (status === "CANDIDACY") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "senate",
            });
          }
          status = "VOTING";
          daysUntilNextEvent = 4;
        } else if (status === "VOTING") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Election Night",
              description: "Polls close and progressive reporting begins",
              type: "results",
            });
          }
          status = "ELECTION_NIGHT";
          daysUntilNextEvent = 1;
        } else if (status === "ELECTION_NIGHT") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Result Declared",
              description: "The final Senate result is certified",
              type: "results",
            });
          }
          status = "CONCLUDED";
          daysUntilNextEvent = 6;
        } else if (status === "CONCLUDED") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Candidacy Opens",
              description: "New senate election candidacy period starts",
              type: "senate",
            });
          }
          status = "CANDIDACY";
          daysUntilNextEvent = 4;
        }
      }
    }

    if (presidentialElection) {
      let pastStatus = presidentialElection.status;
      let daysSinceLast = 0;
      let totalDaysBack = 0;

      while (totalDaysBack < 28) {
        let prevStatus = "";
        let prevDuration = 0;

        if (pastStatus === "CANDIDACY") {
          prevStatus = "CONCLUDED";
          prevDuration = 8;
        } else if (pastStatus === "VOTING") {
          prevStatus = "CANDIDACY";
          prevDuration = 10;
        } else if (pastStatus === "ELECTION_NIGHT") {
          prevStatus = "VOTING";
          prevDuration = 1;
        } else if (pastStatus === "CONCLUDED") {
          prevStatus = "ELECTION_NIGHT";
          prevDuration = 1;
        }

        totalDaysBack += prevDuration;

        if (totalDaysBack <= 28) {
          const eventDate = getEventDate(-totalDaysBack);
          if (prevStatus === "CONCLUDED") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Candidacy Opens",
              description: "New presidential election candidacy period starts",
              type: "president",
            });
          } else if (prevStatus === "CANDIDACY") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "president",
            });
          } else if (prevStatus === "VOTING") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Election Night",
              description: "Polls close and progressive reporting begins",
              type: "results",
            });
          } else if (prevStatus === "ELECTION_NIGHT") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Result Declared",
              description: "The final presidential result is certified",
              type: "results",
            });
          }
        }

        pastStatus = prevStatus;
        daysSinceLast += prevDuration;
      }

      let status = presidentialElection.status;
      let daysUntilNextEvent = presidentialElection.daysRemaining;
      let totalDaysFromNow = 0;

      while (totalDaysFromNow < 365) {
        if (status === "CANDIDACY") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "president",
            });
          }
          status = "VOTING";
          daysUntilNextEvent = 10;
        } else if (status === "VOTING") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Election Night",
              description: "Polls close and progressive reporting begins",
              type: "results",
            });
          }
          status = "ELECTION_NIGHT";
          daysUntilNextEvent = 1;
        } else if (status === "ELECTION_NIGHT") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Result Declared",
              description: "The final presidential result is certified",
              type: "results",
            });
          }
          status = "CONCLUDED";
          daysUntilNextEvent = 8;
        } else if (status === "CONCLUDED") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Candidacy Opens",
              description: "New presidential election candidacy period starts",
              type: "president",
            });
          }
          status = "CANDIDACY";
          daysUntilNextEvent = 10;
        }
      }
    }

    // Sort events by date
    upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      serverNow: now,
      timerSchedules: {
        billAdvance: "every minute",
        gameAdvance: GAME_ADVANCE_SCHEDULE_UTC,
      },
      senateElection,
      presidentialElection,
      billAdvance: {
        currentPool,
        nextAdvanceTime: billAdvanceTime,
      },
      upcomingEvents, // Return all events (past and future, no limit)
    };
  },
);
