import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { elections, gameTracker } from "@/db/schema";

const GAME_ADVANCE_HOUR_UTC = 20;
const GAME_ADVANCE_MINUTE_UTC = 0;

function getNextAdvanceTime(daysLeft: number): Date {
  const now = new Date();
  const today = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const todayAdvance = new Date(today);
  todayAdvance.setUTCHours(
    GAME_ADVANCE_HOUR_UTC,
    GAME_ADVANCE_MINUTE_UTC,
    0,
    0,
  );

  let daysToAdd = daysLeft;
  if (now >= todayAdvance) {
    daysToAdd = daysLeft - 1;
  }

  const nextAdvance = new Date(today);
  nextAdvance.setUTCDate(nextAdvance.getUTCDate() + daysToAdd);
  nextAdvance.setUTCHours(GAME_ADVANCE_HOUR_UTC, GAME_ADVANCE_MINUTE_UTC, 0, 0);

  return nextAdvance;
}

function getNextBillAdvanceTime(): Date {
  const now = new Date();
  const today = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const todayAdvance = new Date(today);
  todayAdvance.setUTCHours(
    GAME_ADVANCE_HOUR_UTC,
    GAME_ADVANCE_MINUTE_UTC,
    0,
    0,
  );

  if (now >= todayAdvance) {
    const nextAdvance = new Date(today);
    nextAdvance.setUTCDate(nextAdvance.getUTCDate() + 1);
    nextAdvance.setUTCHours(
      GAME_ADVANCE_HOUR_UTC,
      GAME_ADVANCE_MINUTE_UTC,
      0,
      0,
    );
    return nextAdvance;
  } else {
    return todayAdvance;
  }
}

export type CalendarEvent = {
  date: Date;
  title: string;
  description: string;
  type: "senate" | "president" | "bill" | "results";
};

export type CalendarData = {
  senateElection: {
    status: string;
    daysLeft: number;
    nextStageTime: Date;
    nextStageName: string;
  } | null;
  presidentialElection: {
    status: string;
    daysLeft: number;
    nextStageTime: Date;
    nextStageName: string;
  } | null;
  billAdvance: {
    currentPool: number;
    nextAdvanceTime: Date;
  };
  upcomingEvents: CalendarEvent[];
};

function getNextStageName(status: string, electionType: string): string {
  if (status === "Candidate" || status === "Candidacy") {
    return `${electionType} Elections - Time until Voting`;
  } else if (status === "Voting") {
    return `${electionType} Elections - Time until Results`;
  } else if (status === "Concluded") {
    return `${electionType} Elections - Time until Campaigning`;
  }
  return "Unknown Stage";
}

export const getCalendarData = createServerFn().handler(
  async (): Promise<CalendarData> => {
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
    const currentPool = gameData?.billPool || 1;
    const billAdvanceTime = getNextBillAdvanceTime();

    let senateElection = null;
    if (senateData) {
      senateElection = {
        status: senateData.status || "Unknown",
        daysLeft: senateData.daysLeft,
        nextStageTime: getNextAdvanceTime(senateData.daysLeft),
        nextStageName: getNextStageName(senateData.status || "", "Senate"),
      };
    }

    // Process presidential election
    let presidentialElection = null;
    if (presidentData) {
      presidentialElection = {
        status: presidentData.status || "Unknown",
        daysLeft: presidentData.daysLeft,
        nextStageTime: getNextAdvanceTime(presidentData.daysLeft),
        nextStageName: getNextStageName(
          presidentData.status || "",
          "Presidential",
        ),
      };
    }

    const upcomingEvents: CalendarEvent[] = [];

    const getEventDate = (daysFromNow: number): Date => {
      const now = new Date();

      const todayAdvance = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          GAME_ADVANCE_HOUR_UTC,
          GAME_ADVANCE_MINUTE_UTC,
          0,
          0,
        ),
      );

      const baseDaysOffset = now >= todayAdvance ? daysFromNow : daysFromNow;

      const eventDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + baseDaysOffset,
          GAME_ADVANCE_HOUR_UTC,
          GAME_ADVANCE_MINUTE_UTC,
          0,
          0,
        ),
      );

      return eventDate;
    };

    if (senateElection) {
      let pastStatus = senateElection.status;
      let daysSinceLast = 0;
      let totalDaysBack = 0;

      while (totalDaysBack < 28) {
        let prevStatus = "";
        let prevDuration = 0;

        if (pastStatus === "Candidate" || pastStatus === "Candidacy") {
          prevStatus = "Concluded";
          prevDuration = 6;
        } else if (pastStatus === "Voting") {
          prevStatus = "Candidate";
          prevDuration = 4;
        } else if (pastStatus === "Concluded") {
          prevStatus = "Voting";
          prevDuration = 4;
        }

        totalDaysBack += prevDuration;

        if (totalDaysBack <= 28) {
          const eventDate = getEventDate(-totalDaysBack);
          if (prevStatus === "Concluded") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Candidacy Opens",
              description: "New senate election candidacy period starts",
              type: "senate",
            });
          } else if (prevStatus === "Candidate") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "senate",
            });
          } else if (prevStatus === "Voting") {
            upcomingEvents.push({
              date: eventDate,
              title: "Senate Election Results",
              description: "Winners announced, new senators elected",
              type: "results",
            });
          }
        }

        pastStatus = prevStatus;
        daysSinceLast += prevDuration;
      }

      let status = senateElection.status;
      let daysUntilNextEvent = senateElection.daysLeft;
      let totalDaysFromNow = 0;

      while (totalDaysFromNow < 365) {
        if (status === "Candidate" || status === "Candidacy") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "senate",
            });
          }
          status = "Voting";
          daysUntilNextEvent = 4;
        } else if (status === "Voting") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Election Results",
              description: "Winners announced, new senators elected",
              type: "results",
            });
          }
          status = "Concluded";
          daysUntilNextEvent = 6;
        } else if (status === "Concluded") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Senate Candidacy Opens",
              description: "New senate election candidacy period starts",
              type: "senate",
            });
          }
          status = "Candidate";
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

        if (pastStatus === "Candidate" || pastStatus === "Candidacy") {
          prevStatus = "Concluded";
          prevDuration = 8;
        } else if (pastStatus === "Voting") {
          prevStatus = "Candidate";
          prevDuration = 10;
        } else if (pastStatus === "Concluded") {
          prevStatus = "Voting";
          prevDuration = 10;
        }

        totalDaysBack += prevDuration;

        if (totalDaysBack <= 28) {
          const eventDate = getEventDate(-totalDaysBack);
          if (prevStatus === "Concluded") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Candidacy Opens",
              description: "New presidential election candidacy period starts",
              type: "president",
            });
          } else if (prevStatus === "Candidate") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "president",
            });
          } else if (prevStatus === "Voting") {
            upcomingEvents.push({
              date: eventDate,
              title: "Presidential Election Results",
              description: "Winner announced, new president elected",
              type: "results",
            });
          }
        }

        pastStatus = prevStatus;
        daysSinceLast += prevDuration;
      }

      let status = presidentialElection.status;
      let daysUntilNextEvent = presidentialElection.daysLeft;
      let totalDaysFromNow = 0;

      while (totalDaysFromNow < 365) {
        if (status === "Candidate" || status === "Candidacy") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Voting Begins",
              description: "Candidacy period ends and voting opens",
              type: "president",
            });
          }
          status = "Voting";
          daysUntilNextEvent = 10;
        } else if (status === "Voting") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Election Results",
              description: "Winner announced, new president elected",
              type: "results",
            });
          }
          status = "Concluded";
          daysUntilNextEvent = 8;
        } else if (status === "Concluded") {
          totalDaysFromNow += daysUntilNextEvent;
          if (totalDaysFromNow <= 365) {
            upcomingEvents.push({
              date: getEventDate(totalDaysFromNow),
              title: "Presidential Candidacy Opens",
              description: "New presidential election candidacy period starts",
              type: "president",
            });
          }
          status = "Candidate";
          daysUntilNextEvent = 10;
        }
      }
    }

    // Sort events by date
    upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
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
