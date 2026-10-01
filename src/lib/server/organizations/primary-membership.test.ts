import { describe, expect, it, mock } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { syncPartyPrimaryMembership } from "./primary-membership";
import type { SQL } from "drizzle-orm";

function transaction() {
  const statements: Array<string> = [];
  const dialect = new PgDialect();
  const tx = {
    update: mock(() => ({
      set: mock((values: { coalitionId: number | null }) => {
        statements.push(`coalition:${values.coalitionId}`);
        return { where: mock(async () => {}) };
      }),
    })),
    execute: mock(async (query: SQL) => {
      statements.push(dialect.sqlToQuery(query).sql);
    }),
  };
  return {
    tx: tx as unknown as Parameters<typeof syncPartyPrimaryMembership>[0],
    statements,
  };
}

describe("primary membership transitions", () => {
  it("merges candidates into the coalition without dropping ballots", async () => {
    const { tx, statements } = transaction();
    await syncPartyPrimaryMembership(tx, 7, 3);
    expect(statements[0]).toBe("coalition:3");
    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("count(*)::int");
  });

  it("splits candidates and clears only ballots crossing the departure", async () => {
    const { tx, statements } = transaction();
    await syncPartyPrimaryMembership(tx, 7, null);
    expect(statements[0]).toBe("coalition:null");
    expect(statements[1]).toContain(
      "voter.party_id = $1 AND nominee.party_id <> $2",
    );
    expect(statements[1]).toContain(
      "nominee.party_id = $3 AND voter.party_id <> $4",
    );
    expect(statements[2]).toContain("count(*)::int");
  });
});
