# Bill Lifecycle Handover

## Current design

Bills use durable per-row deadlines. The application no longer relies on a global bill pool schedule to decide when a bill advances.

Each bill has:

- `stage`: `House`, `Senate`, or `Presidential`
- `status`: `Committee`, `Voting`, `Passed`, or `Defeated`
- `stage_started_at`
- `stage_ends_at`

The intended lifecycle is:

```text
Committee -> House voting -> Senate voting -> Presidential voting -> Passed
```

Each stage is intended to last 8 hours. A failed vote changes the bill to `Defeated` instead of advancing it.

## Main files

- [src/db/schema.ts](../src/db/schema.ts): bill columns and Drizzle schema
- [src/routes/api/bill-advance.ts](../src/routes/api/bill-advance.ts): deadline reconciler and vote outcomes
- [src/lib/server/bills.ts](../src/lib/server/bills.ts): new bill creation and initial 8-hour deadline
- [src/lib/server/committee.ts](../src/lib/server/committee.ts): committee outcome locking
- [src/lib/server/calendar.ts](../src/lib/server/calendar.ts): calendar selects the earliest persisted bill deadline
- [src/components/calendar-view.tsx](../src/components/calendar-view.tsx): bill countdown display
- [scripts/scheduler.mjs](../scripts/scheduler.mjs): VPS scheduler loop
- [src/lib/server/cron-auth.ts](../src/lib/server/cron-auth.ts): sidecar (internal token) + GCP OIDC + admin-trigger + local auth
- [src/routes/admin.tsx](../src/routes/admin.tsx): manual advance triggers (no SSH needed)
- [drizzle/0033_bill_stage_deadlines.sql](../drizzle/0033_bill_stage_deadlines.sql): schema migration and existing-row backfill

## Game speed modes (DB-owned)

Game pace is no longer env-owned. `game_settings` (migration `0034`) stores
`speed_mode` / `speed_multiplier` / `last_game_advance_at`, changed at will
from `/admin` → Game speed. Presets (`src/lib/game-speed.ts`):

```text
super-slow 0.25x, slow 0.5x, regular 1x, fast 2x,
super-fast 72x, dev 720x, dev-relaxed 2x
```

The multiplier scales elections, 8h bill stages, and the game-advance tick
(24h at regular) together. Switching rescales every live bill, election, and
reveal deadline proportionally in one transaction (`setGameSpeedFn` in
`src/lib/server/game-speed.ts`); overdue items stay overdue and advance on
the next tick. `ELECTION_TIME_MULTIPLIER` is now only a fallback for a fresh
database with no settings row. `game-advance` self-throttles server-side, so
the scheduler calls it every tick and the endpoint no-ops (`skipped: true`)
until due.

## Scheduler behavior

The `election-scheduler` sidecar calls these endpoints in a loop every 60 seconds:

```text
POST /api/election-advance   (every tick: due election deadlines)
GET  /api/bill-advance       (every tick: due per-bill 8h stage deadlines)
GET  /api/game-advance       (throttled to once per 24h: user inactivity + party cleanup)
```

It calls the app over the Docker network at `http://app:3000` and authenticates with:

```text
x-internal-cron-token: $CRON_INTERNAL_TOKEN
```

The bill endpoint itself checks `stage_ends_at <= now`, so calling it every minute is safe. It uses advisory lock `24092026` to prevent concurrent bill transitions.

View scheduler logs on the VPS:

```bash
docker compose --env-file .env \
  -f docker-compose.yml -f docker-compose.dev.yml \
  logs --follow --timestamps election-scheduler
```

Expected successful entries look like:

```text
[scheduler] starting target=http://app:3000 intervalMs=60000
[scheduler] 2026-09-23T... /api/election-advance 200 12ms
[scheduler] 2026-09-23T... /api/bill-advance 200 15ms
```

The scheduler exits on boot when `CRON_INTERNAL_TOKEN` is missing so a
misconfigured deploy fails visibly instead of looping with 401s. Tunables:
`APP_BASE_URL` (default `http://app:3000`), `SCHEDULER_INTERVAL_MS` (default
`60000`), `GAME_ADVANCE_INTERVAL_MS` (default `72000000`). `game-advance`
must stay throttled because it bumps user inactivity counters per call.

The scheduler must be rebuilt after changing `scripts/scheduler.mjs` because the script is copied into the runtime image by `Dockerfile`.

## Manual force test

From the scheduler container:

```bash
docker compose --env-file .env \
  -f docker-compose.yml -f docker-compose.dev.yml \
  exec election-scheduler node -e '
fetch("http://app:3000/api/bill-advance", {
  headers: { "x-internal-cron-token": process.env.CRON_INTERNAL_TOKEN }
}).then(async r => { console.log(r.status); console.log(await r.text()) })'
```

A `200` only means the reconciler completed. It may make no state changes if no bill deadline has elapsed.

Inspect bill state directly:

```bash
node --import tsx -e "process.loadEnvFile('.env'); const {Client}=await import('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); console.log((await c.query('SELECT id, status, stage, stage_started_at, stage_ends_at FROM bills ORDER BY id')).rows); await c.end();"
```

## Migration state

Migration numbering is sequential:

```text
0032_fixed_iceman
0033_bill_stage_deadlines
0034_useful_martin_li (game_settings for DB-owned game speed)
```

Apply with `pnpm db:migrate` per environment before deploying the speed-mode
code; without the table every timing call falls back to the env multiplier.

The target database had migration `0032` applied in schema but its bookkeeping row was missing. That history was repaired, and `pnpm db:migrate` successfully applied `0033`.

For another environment, run from the repository with the correct `.env` target:

```bash
set -a
source .env
set +a
pnpm db:migrate
```

Do not run `db:push` for this change. Do not create a second hand-written migration for the bill deadline columns. After changing the schema, use:

```bash
pnpm db:generate
```

## Important known edge case (fixed)

`lockCommitteeOutcome` (`src/lib/server/committee.ts`) now resets the bill to
a fresh 8-hour voting window when it transitions Committee -> Voting:

```text
stage_started_at = now
stage_ends_at = now + 8 hours
```

It accepts an optional `now` so the bill reconciler (`src/routes/api/bill-advance.ts`)
passes its transaction timestamp and avoids a redundant second write. A bill
closed early from Committee therefore no longer retains the original Committee
deadline.

## Legacy fields and configuration

`bills.pool`, `game_tracker.bill_pool`, `BILL_ADVANCE_SCHEDULE_UTC`, and the old calendar cron countdown are legacy concepts for bill progression. The current bill reconciler does not use the pool to select due bills. The scheduler still runs every minute regardless of the old bill schedule environment value.

The old pool fields should only be removed in a separate cleanup after confirming no other UI or game logic depends on them.

## Validation commands

```bash
pnpm exec tsc --noEmit --pretty false
node --check scripts/scheduler.mjs
pnpm db:generate
```

`pnpm db:generate` should report:

```text
No schema changes, nothing to migrate
```
