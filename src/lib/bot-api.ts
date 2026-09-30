export const BOT_PAGE_SIZE = 50;
export const BOT_MAX_PAGE_SIZE = 100;

export type BotEndpoint =
  | "users"
  | "parties"
  | "bills"
  | "posts"
  | "candidates"
  | "game-state";
export type BotStage = "House" | "Senate" | "Presidential";
export type BotBillStatus = "Committee" | "Voting" | "Passed" | "Defeated";

export type BotQuery =
  | {
      endpoint: "users" | "parties";
      id: number | null;
      limit: number;
      offset: number;
    }
  | {
      endpoint: "bills";
      stage: BotStage | null;
      status: BotBillStatus | null;
      limit: number;
      offset: number;
    }
  | {
      endpoint: "posts";
      limit: number;
      offset: number;
    }
  | {
      endpoint: "candidates";
      election: "President" | "Senate" | null;
      limit: number;
      offset: number;
    }
  | { endpoint: "game-state" };

export type BotParseResult =
  | { ok: true; query: BotQuery }
  | { ok: false; error: string };

const endpoints: ReadonlyArray<BotEndpoint> = [
  "users",
  "parties",
  "bills",
  "posts",
  "candidates",
  "game-state",
];
const statuses: ReadonlyArray<BotBillStatus> = [
  "Committee",
  "Voting",
  "Passed",
  "Defeated",
];

function integerParam(value: string | null, min: number, max: number) {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

export function parseBotQuery(url: URL): BotParseResult {
  const params = url.searchParams;
  const endpoint = params.get("endpoint");
  if (
    !endpoints.includes(endpoint as BotEndpoint) ||
    params.getAll("endpoint").length !== 1
  )
    return { ok: false, error: "Invalid endpoint" };

  const allowed: Record<BotEndpoint, ReadonlyArray<string>> = {
    users: ["id", "limit", "offset"],
    parties: ["id", "limit", "offset"],
    bills: ["stage", "status", "limit", "offset"],
    posts: ["limit", "offset"],
    candidates: ["election", "limit", "offset"],
    "game-state": [],
  };
  const key = endpoint as BotEndpoint;
  for (const name of params.keys()) {
    if (
      (name !== "endpoint" && !allowed[key].includes(name)) ||
      params.getAll(name).length !== 1
    )
      return { ok: false, error: `Invalid or repeated parameter: ${name}` };
  }

  if (key === "game-state")
    return { ok: true, query: { endpoint: "game-state" } };

  const limit = params.has("limit")
    ? integerParam(params.get("limit"), 1, BOT_MAX_PAGE_SIZE)
    : BOT_PAGE_SIZE;
  const offset = params.has("offset")
    ? integerParam(params.get("offset"), 0, 10_000)
    : 0;
  if (limit === null || offset === null)
    return {
      ok: false,
      error: `limit must be 1-${BOT_MAX_PAGE_SIZE} and offset must be 0-10000`,
    };

  if (key === "users" || key === "parties") {
    // PostgreSQL serial IDs are signed 32-bit integers; larger values would
    // fail at query time and turn a bad request into a 500.
    const id = params.has("id")
      ? integerParam(params.get("id"), 1, 2_147_483_647)
      : null;
    if (
      (params.has("id") && id === null) ||
      (id !== null && (params.has("limit") || params.has("offset")))
    )
      return { ok: false, error: "Invalid ID or pagination on a single item" };
    return { ok: true, query: { endpoint: key, id, limit, offset } };
  }

  if (key === "bills") {
    const rawStage = params.get("stage");
    const stage = rawStage === "Presidency" ? "Presidential" : rawStage;
    if (
      stage !== null &&
      stage !== "House" &&
      stage !== "Senate" &&
      stage !== "Presidential"
    )
      return {
        ok: false,
        error: "Invalid stage; use House, Senate, or Presidential",
      };
    const rawStatus = params.get("status");
    if (rawStatus !== null && !statuses.includes(rawStatus as BotBillStatus))
      return {
        ok: false,
        error: "Invalid status; use Committee, Voting, Passed, or Defeated",
      };
    return {
      ok: true,
      query: {
        endpoint: "bills",
        stage,
        status: rawStatus as BotBillStatus | null,
        limit,
        offset,
      },
    };
  }

  if (key === "posts")
    return { ok: true, query: { endpoint: "posts", limit, offset } };

  const election = params.get("election");
  if (election !== null && election !== "President" && election !== "Senate")
    return { ok: false, error: "Invalid election; use President or Senate" };
  return {
    ok: true,
    query: { endpoint: "candidates", election, limit, offset },
  };
}

export function groupBotBills<T extends { stage: string }>(rows: Array<T>) {
  return {
    House: rows.filter((row) => row.stage === "House"),
    Senate: rows.filter((row) => row.stage === "Senate"),
    Presidential: rows.filter((row) => row.stage === "Presidential"),
  };
}
