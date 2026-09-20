import { loadEnvFile } from "node:process";
import pg from "pg";
import { generateElectionNightPlan } from "../src/lib/elections/reveal";

const PLAYER_COUNT = 50;
const BALLOT_COUNT = 48;
const DEFAULT_DURATION_MS = 12 * 60 * 60 * 1000;
const raceConfigs = {
  President: { candidateCount: 8, seats: 1 },
  Senate: { candidateCount: 18, seats: 9 },
} as const;

type ElectionType = keyof typeof raceConfigs;
type UserRow = {
  id: number;
  username: string;
  party_id: number | null;
  role: string | null;
};
type DemoCandidate = {
  id: number;
  name: string;
  partyId: number | null;
  userId: number;
};

function usage() {
  console.log(`Usage: pnpm election:dry-run [options]

Prepare deterministic President and Senate election-night simulations from
50 existing local players, with 48 complete ballots cast in each race.

Options:
  --duration <value>  Election-night duration: 90s, 5m, 2h, or 12h (default: 12h)
  --election <value>  President, Senate, or all (default: all)
  --player <value>    Player whose ballot is guaranteed and printed (default: ajstrongdev)
  --help              Show this help without connecting to the database

Examples:
  pnpm election:dry-run
  pnpm election:dry-run -- --duration 5m
  pnpm election:dry-run -- --duration 30m --election President

Safety:
  Refuses NODE_ENV=production. Non-local DATABASE_URL values also require
  ELECTION_DEMO_ALLOW_REMOTE=true.`);
}

function parseDuration(value: string) {
  const match = /^(\d+(?:\.\d+)?)(s|m|h)$/i.exec(value.trim());
  if (!match) throw new Error("Duration must use seconds, minutes, or hours");
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "s" ? 1_000 : unit === "m" ? 60_000 : 3_600_000;
  const durationMs = Math.round(amount * multiplier);
  if (durationMs < 30_000 || durationMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error("Duration must be between 30 seconds and 7 days");
  }
  return durationMs;
}

function parseArgs(args: Array<string>) {
  let durationMs = DEFAULT_DURATION_MS;
  let election: ElectionType | "all" = "all";
  let player = "ajstrongdev";
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      return { durationMs, election, help: true, player };
    }
    if (argument === "--duration") {
      const value = args[++index];
      if (!value) throw new Error("--duration requires a value such as 5m");
      durationMs = parseDuration(value);
      continue;
    }
    if (argument === "--election") {
      const value = args[++index]?.toLowerCase();
      if (value === "president") election = "President";
      else if (value === "senate") election = "Senate";
      else if (value === "all") election = "all";
      else throw new Error("--election must be President, Senate, or all");
      continue;
    }
    if (argument === "--player") {
      const value = args[++index];
      if (!value) throw new Error("--player requires an id or username");
      player = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { durationMs, election, help: false, player };
}

function isLocalDatabase(connectionString: string) {
  const hostname = new URL(connectionString).hostname.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function hash(value: string) {
  let state = 2166136261;
  for (let index = 0; index < value.length; index++) {
    state ^= value.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

function chooseCandidates(
  users: Array<UserRow>,
  count: number,
  excludedIds: Set<number>,
  eligible: (user: UserRow) => boolean,
) {
  const available = users.filter(
    (user) => !excludedIds.has(user.id) && eligible(user),
  );
  const selected: Array<UserRow> = [];
  const selectedIds = new Set<number>();
  const representedParties = new Set<number>();

  for (const user of available) {
    if (user.party_id === null || representedParties.has(user.party_id))
      continue;
    selected.push(user);
    selectedIds.add(user.id);
    representedParties.add(user.party_id);
    if (selected.length === count) return selected;
  }
  for (const user of available) {
    if (selectedIds.has(user.id)) continue;
    selected.push(user);
    if (selected.length === count) return selected;
  }
  return selected;
}

function rankedCandidates(
  candidates: Array<DemoCandidate>,
  voter: UserRow,
  seed: string,
) {
  return [...candidates].sort((left, right) => {
    const score = (candidate: DemoCandidate) => {
      const noise =
        hash(`${seed}:${voter.id}:${candidate.userId}`) / 0xffffffff;
      const nationalStrength =
        (hash(`${seed}:strength:${candidate.userId}`) % 10_000) / 10_000;
      const partyAffinity =
        voter.party_id !== null && voter.party_id === candidate.partyId
          ? 0.2
          : 0;
      return noise * 0.72 + nationalStrength * 0.28 + partyAffinity;
    };
    return score(right) - score(left) || left.id - right.id;
  });
}

function formatDuration(durationMs: number) {
  if (durationMs % 3_600_000 === 0) return `${durationMs / 3_600_000}h`;
  if (durationMs % 60_000 === 0) return `${durationMs / 60_000}m`;
  return `${durationMs / 1_000}s`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  loadEnvFile();
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run an election demo in production");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  if (
    !isLocalDatabase(connectionString) &&
    process.env.ELECTION_DEMO_ALLOW_REMOTE !== "true"
  ) {
    throw new Error(
      "Refusing a non-local database. Set ELECTION_DEMO_ALLOW_REMOTE=true to proceed explicitly.",
    );
  }

  const races: Array<ElectionType> =
    args.election === "all" ? ["President", "Senate"] : [args.election];
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const electionResult = await client.query<{
      cycle: number;
      election: ElectionType;
    }>(
      `SELECT election, cycle FROM elections WHERE election = ANY($1::text[]) ORDER BY election FOR UPDATE`,
      [races],
    );
    if (electionResult.rows.length !== races.length) {
      throw new Error("One or more requested election rows do not exist");
    }

    const allUsersResult = await client.query<UserRow>(`
      SELECT id, username, party_id, role
      FROM users
      WHERE is_active IS TRUE AND username NOT LIKE 'Banned User%'
      ORDER BY lower(username), id
    `);
    if (allUsersResult.rows.length < PLAYER_COUNT) {
      throw new Error(
        `Election demo requires ${PLAYER_COUNT} active players; found ${allUsersResult.rows.length}`,
      );
    }
    const playerResult = /^\d+$/.test(args.player)
      ? await client.query<UserRow>(
          `SELECT id, username, party_id, role FROM users WHERE id = $1 AND is_active IS TRUE`,
          [Number(args.player)],
        )
      : await client.query<UserRow>(
          `SELECT id, username, party_id, role FROM users WHERE lower(username) = lower($1) AND is_active IS TRUE`,
          [args.player],
        );
    if (playerResult.rowCount === 0) {
      throw new Error(`Active player not found: ${args.player}`);
    }
    const player = playerResult.rows[0];
    const simulationUsers = [
      player,
      ...allUsersResult.rows.filter((user) => user.id !== player.id),
    ].slice(0, PLAYER_COUNT);
    const ballotUsers = simulationUsers.slice(0, BALLOT_COUNT);

    const existingCandidateResult = await client.query<{ user_id: number }>(
      `SELECT user_id FROM candidates WHERE NOT (election = ANY($1::text[]))`,
      [races],
    );
    const selectedIds = new Set(
      existingCandidateResult.rows.map((candidate) => candidate.user_id),
    );
    const candidateUsers = new Map<ElectionType, Array<UserRow>>();
    if (races.includes("Senate")) {
      const senateCandidates = chooseCandidates(
        simulationUsers,
        raceConfigs.Senate.candidateCount,
        selectedIds,
        (user) => user.role !== "President",
      );
      if (senateCandidates.length !== raceConfigs.Senate.candidateCount) {
        throw new Error("Not enough eligible players for 18 Senate candidates");
      }
      candidateUsers.set("Senate", senateCandidates);
      senateCandidates.forEach((user) => selectedIds.add(user.id));
    }
    if (races.includes("President")) {
      const presidentialCandidates = chooseCandidates(
        simulationUsers,
        raceConfigs.President.candidateCount,
        selectedIds,
        (user) => user.role !== "Senator",
      );
      if (
        presidentialCandidates.length !== raceConfigs.President.candidateCount
      ) {
        throw new Error(
          "Not enough eligible players for presidential candidates",
        );
      }
      candidateUsers.set("President", presidentialCandidates);
      presidentialCandidates.forEach((user) => selectedIds.add(user.id));
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + args.durationMs);
    const summaries: Array<{
      ballots: number;
      candidates: number;
      cycle: number;
      election: ElectionType;
      events: number;
      playerRanking: Array<string>;
      seed: string;
    }> = [];

    if (races.includes("President")) {
      await client.query(`DELETE FROM primary_votes`);
      await client.query(`DELETE FROM primary_candidates`);
    }
    await client.query(`DELETE FROM votes WHERE vote_type = ANY($1::text[])`, [
      races,
    ]);
    await client.query(
      `DELETE FROM candidates WHERE election = ANY($1::text[])`,
      [races],
    );

    for (const election of races) {
      const currentCycle = electionResult.rows.find(
        (row) => row.election === election,
      )!.cycle;
      const historyResult = await client.query<{ cycle: number }>(
        `SELECT coalesce(max(cycle), 0)::int AS cycle FROM election_history WHERE election = $1`,
        [election],
      );
      const archivedCycle = historyResult.rows[0]?.cycle ?? 0;
      const cycle = Math.max(
        currentCycle,
        archivedCycle + (archivedCycle >= currentCycle ? 1 : 0),
      );
      await client.query(
        `DELETE FROM election_night_updates WHERE election = $1 AND cycle = $2`,
        [election, cycle],
      );

      const users = candidateUsers.get(election)!;
      const candidateValues: Array<boolean | number | string> = [];
      const candidateTuples = users.map((user, index) => {
        candidateValues.push(user.id, election, 0, false);
        const start = index * 4;
        return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
      });
      const inserted = await client.query<{ id: number; user_id: number }>(
        `INSERT INTO candidates (user_id, election, votes, haswon)
         VALUES ${candidateTuples.join(", ")} RETURNING id, user_id`,
        candidateValues,
      );
      const candidateIdByUser = new Map(
        inserted.rows.map((candidate) => [candidate.user_id, candidate.id]),
      );
      const candidates = users.map((user) => ({
        id: candidateIdByUser.get(user.id)!,
        name: user.username,
        partyId: user.party_id,
        userId: user.id,
      }));
      const seed = `${election.toLowerCase()}-demo:${cycle}:v2`;
      const totals = new Map(candidates.map((candidate) => [candidate.id, 0]));
      const ballotValues: Array<number | string> = [];
      let playerRanking: Array<string> = [];

      for (const voter of ballotUsers) {
        const ranking = rankedCandidates(candidates, voter, seed);
        if (voter.id === player.id) {
          playerRanking = ranking.map((candidate) => candidate.name);
        }
        for (const [index, candidate] of ranking.entries()) {
          const rank = index + 1;
          const points = ranking.length - index;
          totals.set(candidate.id, totals.get(candidate.id)! + points);
          ballotValues.push(voter.id, election, candidate.id, rank, points);
        }
      }
      const ballotTuples = Array.from(
        { length: ballotValues.length / 5 },
        (_, index) => {
          const start = index * 5;
          return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
        },
      );
      await client.query(
        `INSERT INTO votes (user_id, vote_type, candidate_id, rank, points)
         VALUES ${ballotTuples.join(", ")}`,
        ballotValues,
      );
      for (const candidate of candidates) {
        await client.query(`UPDATE candidates SET votes = $1 WHERE id = $2`, [
          totals.get(candidate.id),
          candidate.id,
        ]);
      }

      const revealPlan = generateElectionNightPlan(
        candidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          total: totals.get(candidate.id)!,
        })),
        { seed, startsAt: now, durationMs: args.durationMs },
      );
      const updateValues: Array<Date | number | string> = [];
      const updateTuples = revealPlan.map((update, index) => {
        updateValues.push(
          election,
          cycle,
          update.sequence,
          update.revealAt,
          update.type,
          update.headline,
          JSON.stringify(update.cumulativeTotals),
          update.totalPoints,
        );
        const start = index * 8;
        return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}::jsonb, $${start + 8})`;
      });
      await client.query(
        `INSERT INTO election_night_updates
           (election, cycle, sequence, reveal_at, type, headline, cumulative_totals, total_points)
         VALUES ${updateTuples.join(", ")}`,
        updateValues,
      );
      await client.query(
        `UPDATE elections
         SET status = 'ELECTION_NIGHT', cycle = $2, seats = $3,
             candidacy_starts_at = $4, candidacy_ends_at = $5,
             voting_starts_at = $5, voting_ends_at = $6,
             election_night_starts_at = $6, election_night_ends_at = $7,
             concluded_at = NULL, reporting_seed = $8
         WHERE election = $1`,
        [
          election,
          cycle,
          raceConfigs[election].seats,
          new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
          new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          now,
          endsAt,
          seed,
        ],
      );

      const invariants = await client.query<{
        bad_ballots: number;
        ballot_count: number;
        mismatched_totals: number;
      }>(
        `WITH ballot_checks AS (
           SELECT user_id, count(*) AS rows, count(DISTINCT candidate_id) AS candidates,
                  min(rank) AS min_rank, max(rank) AS max_rank, sum(points) AS points
           FROM votes WHERE vote_type = $1 GROUP BY user_id
         ), vote_totals AS (
           SELECT candidate_id, sum(points)::int AS total
           FROM votes WHERE vote_type = $1 GROUP BY candidate_id
         )
         SELECT
           (SELECT count(*)::int FROM ballot_checks) AS ballot_count,
           (SELECT count(*)::int FROM ballot_checks
            WHERE rows <> $2 OR candidates <> $2 OR min_rank <> 1 OR max_rank <> $2
               OR points <> ($2 * ($2 + 1) / 2)) AS bad_ballots,
           (SELECT count(*)::int FROM candidates c
            LEFT JOIN vote_totals t ON t.candidate_id = c.id
            WHERE c.election = $1 AND c.votes <> coalesce(t.total, 0)) AS mismatched_totals`,
        [election, raceConfigs[election].candidateCount],
      );
      const check = invariants.rows[0];
      if (
        check.ballot_count !== BALLOT_COUNT ||
        check.bad_ballots !== 0 ||
        check.mismatched_totals !== 0
      ) {
        throw new Error(`${election} demo failed ballot or total invariants`);
      }
      summaries.push({
        ballots: BALLOT_COUNT,
        candidates: candidates.length,
        cycle,
        election,
        events: revealPlan.length,
        playerRanking,
        seed,
      });
    }

    await client.query("COMMIT");
    console.log("Election-night demo prepared");
    console.log("Dashboard: http://localhost:3000/dashboard");
    console.log(
      `Players: ${simulationUsers.length}; ballots per race: ${BALLOT_COUNT}`,
    );
    console.log(
      `Duration: ${formatDuration(args.durationMs)} (${now.toISOString()} to ${endsAt.toISOString()})`,
    );
    for (const summary of summaries) {
      console.log(
        `${summary.election}: cycle ${summary.cycle}, ${summary.candidates} candidates, ${summary.ballots} ballots, ${summary.events} reveal events`,
      );
      console.log(`  Seed: ${summary.seed}`);
      console.log(
        `  ${player.username}'s ballot: ${summary.playerRanking.join(" > ")}`,
      );
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
