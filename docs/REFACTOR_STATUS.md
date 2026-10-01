# Refactor status and safe test setup

This status describes an in-progress refactor, not a production deployment
checklist or a claim that live updates are complete. Production use requires a
review of routes, authentication, and the deployed database upgrade path.

## Completed so far

- Moved shared UI and server modules into domain folders under `src/components/`
  and `src/lib/server/`. Kept TanStack route definitions, route paths, redirects,
  and the dashboard workspace in `src/routes/`.
- Moved social, admin, and dashboard-home page implementations out of route
  modules. The route files are still the owners of navigation and loaders.
- Dashboard data is read through a Query key with loader-provided initial data.
  Auth account switches clear the client Query cache. Refreshed latest activity
  retains already loaded pages rather than collapsing them. The social
  timeline's first page uses Query and retains its existing manual pagination
  and a non-disruptive "new posts" affordance. Z.com mentions also use a Query
  first page and manual "load more" pagination.
- Added `0055_public_change_notices` (new migration only): transaction-committed
  PostgreSQL notifications for selected public social/dashboard tables. The
  authenticated `/api/live` SSE stream broadcasts only public domain names;
  social feed Query keys and dashboard Query keys invalidate on these signals.
  A `game` signal now covers mutations on the game-facing tables listed in
  migration `0059_game_change_notices.sql`; clients invalidate active route
  loaders and queries for all three domains. A foreground 10-second fallback,
  reconnection refresh, return-to-tab refresh, and five-minute stream
  reauthentication are in place. This is bounded freshness, not an assertion
  that every displayed datum updates instantly.
- Added `0056_notification_delivery` (new migration only): notification
  preferences, per-browser Web Push subscriptions, and a durable post/comment
  outbox. The existing VPS scheduler drains it every ten seconds when Web Push
  is configured. Permission is requested only by an explicit click; generic
  payloads, quiet hours and a Web Push preference centre are in place. In-app
  dashboard actions remain visible without a hide control; existing individual
  mention dismissals are unchanged.
  See `docs/NOTIFICATIONS.md` for configuration and testing limits.
- Added `0057_next_move_push` and `0058_push_action_preference`: Web Push for
  the dashboard's pending decisions, with per-action receipts, generic/private
  default payloads and optional previews. Actions stay in-game even if Web
  Push is disabled. A safe VS Code full-stack task runs an isolated local
  scheduler and generated local VAPID keys; no deployed data is touched.
- Added a CI Playwright smoke job against PostgreSQL and the Firebase **Auth
  Emulator**, using the Firebase `demo-oscana` project only. The E2E runner
  rejects any non-loopback DB host, a DB not named `oscana_e2e`, mismatched
  project IDs, or an absent emulator. The E2E database is migrated and reset
  before each run. The smoke test checks two independent signed-in users, a
  live new-post affordance, account filtering, a second player's new mention
  and dashboard activity,
  an authenticated document deep link, and a rejected unauthenticated stream.
  The browser test also verifies privacy and quiet-hour settings. A PostgreSQL-backed test asserts
  that a rolled-back post sends no notice and a committed one does. These run
  against a locally built production-mode app.
  The existing local DB and the production Firebase project are not used.
- Login cannot submit a password as a GET during the pre-hydration interval.
- Added lint to CI after fixing the baseline lint errors (warnings remain).
- Audited server-boundary modules and the production client output. The current
  browser assets include PostgreSQL client code and the server environment
  schema, including private-variable names. The inspected output showed schema
  and code, not configured secret values. The shared database barrel's dynamic
  imports and universal `src/env.ts` are implicated; browser-safe and server
  configuration need separate entry points, and database/Firebase Admin
  dependencies must remain behind Start server-function or server-only
  boundaries.

## Important unresolved items

- The prior signed-in Vite dev-server HTTP 500 report was not reproduced in a
  direct-request check: `/dashboard/social` returned HTTP 200 and rendered the
  workspace. The `UserMenu` hydration mismatch was fixed in `ba56c0f`; a signed-in
  direct request afterward emitted no hydration console error. Recheck on the
  developer's current Vite process if the warning returns.
- Query migration is **not** complete on other pages; social and mention
  pagination and many other screens still hold local read copies.
- Web Push has not yet been tested with a real browser push service or enabled
  in a deployment. The live update mechanism now invalidates active route data
  and queries after game/social/dashboard signals and uses a foreground
  10-second fallback. Its table triggers are a reviewed selection, not proven
  exhaustive coverage of every route dependency; in particular, the product
  requirement that every changing screen becomes current within 5–10 seconds
  without a refresh is not yet guaranteed.
- No production/dev schema cleanup, migration-history rewrite, deployed
  migration, seed, or deployment has been performed. The new migrations were
  applied only to the disposable isolated E2E database. The existing production
  Firebase `.env` must never be used for browser mutation tests.
- Server-only boundary remediation remains outstanding. TanStack Start's
  production import-protection check rejects `.server.*` dependencies imported
  by client-reachable server-function entry modules. A trial rename confirmed
  that those entry modules need their server implementation dependencies moved
  behind the transformed handler boundary before selective `.server.ts`
  renames. PostgreSQL code in the client bundle is a release-blocking boundary
  defect; remediation needs a focused change with a clean production build and
  client-asset inspection.
- Auth/SSR synchronization, dead-code proofs, broader game lifecycle tests, and
  full architecture documentation remain.

## E2E safety

CI provides `oscana_e2e` via its own PostgreSQL service and only the Auth
Emulator. Locally, use a **separate, disposable** PostgreSQL container with a
unique port and database name `oscana_e2e`; do not point the runner at the
existing local database. The E2E command requires explicitly exported
`OSCANA_E2E=1`, `DEPLOYED_ENV=local`, `DATABASE_URL` (loopback host,
`/oscana_e2e`), `FIREBASE_PROJECT_ID=demo-oscana`,
`VITE_FIREBASE_PROJECT_ID=demo-oscana`,
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`,
  `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`, and dummy values for
  the other required `VITE_FIREBASE_*` keys. VAPID keys must be absent to avoid
  external delivery. Run
`bunx firebase emulators:exec --only auth --project demo-oscana 'bun run e2e:prepare && bun run test:e2e'`
only after confirming the target is disposable. The guard cannot detect a
loopback tunnel to a remote database; verify your own port mapping as well.

Non-mutating checks include `bun run typecheck`, `bun run test`, `bun run lint .`, and
`bun run build` with dummy client Firebase values. Seeding, migrations, and
authenticated browser tests require an explicitly isolated disposable stack;
the repository's default `.env` is not an E2E target.
