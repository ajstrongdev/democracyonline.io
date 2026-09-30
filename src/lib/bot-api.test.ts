import { describe, expect, it } from "vitest";
import { groupBotBills, parseBotQuery } from "./bot-api";

const parse = (query: string) =>
  parseBotQuery(new URL(`https://oscana.nya.je/api/bot?${query}`));

describe("bot API query contract", () => {
  it("accepts a valid page and strict positive IDs", () => {
    expect(parse("endpoint=users&id=12")).toMatchObject({
      ok: true,
      query: { endpoint: "users", id: 12 },
    });
    expect(parse("endpoint=bills&limit=100&offset=30")).toMatchObject({
      ok: true,
      query: { limit: 100, offset: 30 },
    });
    expect(parse("endpoint=posts&limit=25&offset=10")).toMatchObject({
      ok: true,
      query: { endpoint: "posts", limit: 25, offset: 10 },
    });
    for (const id of [
      "",
      "0",
      "-1",
      "2junk",
      "1.1",
      "2147483648",
      "9007199254740993",
    ])
      expect(parse(`endpoint=users&id=${id}`).ok).toBe(false);
  });

  it("rejects invalid, duplicate or unbounded parameters", () => {
    for (const query of [
      "endpoint=bills&limit=999",
      "endpoint=bills&limit=0",
      "endpoint=bills&offset=-1",
      "endpoint=users&id=1&id=2",
      "endpoint=users&id=1&limit=2",
      "endpoint=game-state&offset=0",
      "endpoint=bills&status=Something",
      "endpoint=candidates&election=Other",
      "endpoint=unknown",
      "endpoint=bills&stage=",
      "endpoint=posts&stage=House",
    ])
      expect(parse(query).ok).toBe(false);
  });

  it("uses the persisted Presidential stage and accepts the legacy spelling", () => {
    expect(parse("endpoint=bills&stage=Presidency")).toMatchObject({
      ok: true,
      query: { stage: "Presidential" },
    });
    expect(groupBotBills([{ stage: "Presidential", id: 1 }])).toEqual({
      House: [],
      Senate: [],
      Presidential: [{ stage: "Presidential", id: 1 }],
    });
  });
});
