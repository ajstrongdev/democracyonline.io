# Refactor status and safe test setup

This is an in-progress refactor, **not** a production deployment checklist or a
claim that live updates are complete. Do not deploy this branch without a full
review of routes, auth, and the deployed database upgrade path.

## Completed so far

- Moved shared UI and server modules into domain folders under `src/components/`
  and `src/lib/server/`. Kept TanStack route definitions, route paths, redirects,
  and the dashboard workspace in `src/routes/`.
- Moved social, admin, and dashboard-home page implementations out of route
  modules. The route files are still the owners of navigation and loaders.
- Dashboard data is read through a Query key with loader-provided initial data
  and a foreground 10-second refresh. Auth account switches clear the client
  Query cache. Refreshed latest activity retains already loaded pages rather
  than collapsing them. The social timeline's first page uses Query and retains its
  existing manual pagination and a non-disruptive "new posts" affordance.
  Z.com mentions also use a Query first page with a foreground 10-second
  private-state fallback and manual "load more" pagination.
- Added `0055_public_change_notices` (new migration only): transaction-committed
  PostgreSQL notifications for selected public social/dashboard tables. The
  authenticated `/api/live` SSE stream broadcasts only public domain names;
  social feed Query keys and dashboard Query keys invalidate on these signals.
  A disconnected-stream 10-second foreground fallback, reconnection refresh,
  and five-minute stream reauthentication are in place. This covers only these
  selected reads, not the complete freshness requirement.
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

## Important unresolved items

- **Vite dev-server dashboard SSR remains broken.** A signed-in direct document
  request to `/dashboard/social` received HTTP 500 in the isolated dev setup:
  `getDashboardData` failed inside TanStack Start `createSsrRpc` / `getServerFnById`
  before its handler. The same path now passes a signed-in direct-document
  Playwright assertion against a local `NODE_ENV=production` build. Investigate
  the dev-server resolver independently; do not treat a passing build as proof
  that Vite dev SSR works.
- Query migration is **not** complete on other pages; social and mention
  pagination and many other screens still hold local read copies.
- Web Push has not yet been tested with a real browser push service or enabled
  in a deployment. Per-user in-app invalidation, full domain event coverage,
  fallback on every page and broader lifecycle tests are still missing. The
  product requirement that every changing screen becomes current within
  5–10 seconds without a refresh is **not met**.
- No production/dev schema cleanup, migration-history rewrite, deployed
  migration, seed, or deployment has been performed. The new migrations were
  applied only to the disposable isolated E2E database. The existing production
  Firebase `.env` must never be used for browser mutation tests.
- Server-domain lifecycle logic, auth/SSR synchronization, dead-code proofs,
  broader game lifecycle tests, and full architecture documentation remain.

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
`pnpm exec firebase emulators:exec --only auth --project demo-oscana 'pnpm e2e:prepare && pnpm test:e2e'`
only after confirming the target is disposable. The guard cannot detect a
loopback tunnel to a remote database; verify your own port mapping as well.

For non-mutating checks, run `pnpm typecheck`, `pnpm test`, `pnpm lint .`, and
`pnpm build` with dummy client Firebase values. Do not run `pnpm seed:fresh`,
`pnpm db:migrate`, or authenticated browser tests against the repository's
default `.env`.
