import { loadEnvFile } from "node:process";
import pg from "pg";
import {
  FIXED_POLICY_VALUES,
  POLICY_DEFINITIONS,
  STAT_DEFINITIONS,
} from "../src/lib/nation/catalog";
import { calculateHeadlineIndices } from "../src/lib/nation/simulation";
import type { PolicyValue } from "../src/lib/nation/catalog";

loadEnvFile();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (
  process.env.NODE_ENV === "production" &&
  process.env.NATION_RANDOMIZE_ALLOW_PRODUCTION !== "true"
) {
  throw new Error(
    "Refusing to randomize production without NATION_RANDOMIZE_ALLOW_PRODUCTION=true",
  );
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

function randomPolicyValue(
  definition: (typeof POLICY_DEFINITIONS)[number],
): PolicyValue {
  const fixedValue = FIXED_POLICY_VALUES[definition.key];
  if (fixedValue !== undefined) return fixedValue;
  if (definition.type === "boolean") return Math.random() < 0.4;
  if (definition.type === "enum") {
    const options = definition.options ?? [];
    return options[Math.floor(Math.random() * options.length)];
  }
  const min = definition.min ?? 0;
  const max = definition.max ?? min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

try {
  await client.connect();
  await client.query("begin");
  const nationResult = await client.query<{ id: number; name: string }>(
    "select id, name from nations order by id limit 1",
  );
  if (nationResult.rows.length === 0)
    throw new Error("No nation has been configured");
  const nation = nationResult.rows[0];

  const statValues = new Map<string, number>();
  for (const definition of STAT_DEFINITIONS) {
    const value = Number(
      (
        definition.min +
        Math.random() * (definition.max - definition.min)
      ).toFixed(1),
    );
    statValues.set(definition.key, value);
    await client.query(
      `insert into nation_stat_values (nation_id, stat_key, value, updated_at)
       values ($1, $2, $3, now())
       on conflict (nation_id, stat_key)
       do update set value = excluded.value, updated_at = now()`,
      [nation.id, definition.key, value],
    );
  }

  for (const definition of POLICY_DEFINITIONS) {
    const value = randomPolicyValue(definition);
    await client.query(
      `insert into nation_policy_values (nation_id, policy_key, value, updated_at)
       values ($1, $2, $3::jsonb, now())
       on conflict (nation_id, policy_key)
       do update set value = excluded.value, updated_at = now()`,
      [nation.id, definition.key, JSON.stringify(value)],
    );
  }

  const headlines = calculateHeadlineIndices(STAT_DEFINITIONS, statValues);
  await client.query(
    `update nations
     set civil_rights = $2, economy = $3, political_freedoms = $4, updated_at = now()
     where id = $1`,
    [
      nation.id,
      headlines.civil_rights,
      headlines.economy,
      headlines.political_freedoms,
    ],
  );
  await client.query("commit");
  console.log(
    `Randomized ${STAT_DEFINITIONS.length} stats and ${POLICY_DEFINITIONS.length} policies for ${nation.name}.`,
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
