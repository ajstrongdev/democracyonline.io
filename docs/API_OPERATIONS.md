# API operations and release checks

This document covers HTTP routes in `src/routes/api/`. The game UI also calls TanStack Start server functions in `src/lib/server/`; those are application actions, **not** a versioned public REST API. Do not build a third-party client against their internal URLs. The public read-only integration contract is [the Bot API](BOT_API.md).

| Route | Method | Access | Purpose and success response |
| --- | --- | --- | --- |
| `/api/bot?endpoint=…` | GET | Public | Read-only users, parties, bills, current candidates, and election state. See [Bot API](BOT_API.md). |
| `/api/health` | GET | Public | DB readiness: `200 {"status":"ok"}` or `503 {"status":"unavailable"}`; never returns connection details. |
| `/api/election-advance` | POST | Internal scheduler or authorized admin | Reconcile due election transitions; `200 {"success":true}`. |
| `/api/bill-advance` | GET | Internal scheduler or authorized admin | Reconcile due bill deadlines and empty parties; `200 {"success":true}`. |
| `/api/game-advance` | GET | Internal scheduler or authorized admin | Archive idle players, reconcile moderation, and advance game lifecycle at configured pace; `200 {"success":true}` (may include `"skipped":true`). |

The last three endpoints change game state even where the historical method is GET. **Do not open them from a browser, public bot, uptime probe, or cache.** The VPS scheduler (`scripts/scheduler.mjs`) calls them in election → bill → game order, once per configured interval (60 seconds by default). Each endpoint checks a secret in `x-internal-cron-token`; the `.env` token must match in the app and scheduler containers. Admin-triggered requests use a Firebase bearer ID token with `x-admin-cron-trigger: 1` and a matching `ADMIN_EMAILS` allowlist. Cloud Scheduler can instead send `x-scheduler-token` and a verified service-account OIDC bearer token. Local non-production cron calls to localhost can use `CRON_LOCAL_TOKEN`. Missing/invalid credentials receive 401 or 403; errors in reconciliation receive 500. Never expose or log any of these tokens.

On the VPS, the scheduler sidecar handles election conclusions; Google Cloud Tasks is optional. If Cloud Tasks is configured, provide all of `GCP_PROJECT_ID`, `CLOUD_TASKS_LOCATION`, `ELECTION_TASK_QUEUE`, `ELECTION_TASK_SERVICE_ACCOUNT`, and `CRON_SCHEDULER_TOKEN` together. Partial Cloud Tasks configuration fails instead of silently falling back. The `/api/health` probe does **not** establish that the scheduler is running or its requests are succeeding: inspect `election-scheduler` logs after deploy.

## Before releasing to production

1. Review changes and the migration SQL. Back up production and test a **restore on a disposable database**; do not seed an existing production DB. Use `bash scripts/vps.sh check` to validate each target checkout.
2. On development, inspect historical duplicates **before** migration 0051 (the migration deliberately refuses duplicates rather than deleting them):

   ```sql
   SELECT 'coalition_votes' AS source, proposal_id AS item_id, voter_party_id AS voter_id, count(*) AS copies
   FROM coalition_votes GROUP BY proposal_id, voter_party_id HAVING count(*) > 1;
   SELECT 'house' AS source, bill_id, voter_id, count(*) AS copies FROM bill_votes_house
   WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1;
   SELECT 'senate' AS source, bill_id, voter_id, count(*) AS copies FROM bill_votes_senate
   WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1;
   SELECT 'presidential' AS source, bill_id, voter_id, count(*) AS copies FROM bill_votes_presidential
   WHERE bill_id IS NOT NULL AND voter_id IS NOT NULL GROUP BY bill_id, voter_id HAVING count(*) > 1;
   ```

   Run read-only queries with `docker compose --env-file .env exec -T db psql -U democracyonline -d democracyonline`. Review and resolve any matches manually with the game owner before running migrations; retain an audit record. Repeat this preflight on production data before production deployment. Do **not** automatically delete votes.
3. Apply migrations on **development** using `bash scripts/vps.sh deploy` or `update` for a clean, pushed checkout. Verify `bash scripts/vps.sh status` reports a healthy app and running scheduler, `curl -fsS https://dev.oscana.nya.je/api/health` reports `ok`, and bot queries for all five endpoints return expected shapes (and 400 for invalid input). Check `docker compose --env-file .env logs --tail=100 app election-scheduler` for errors. See [VPS deployment](../deploy.md) for offline/online procedure.
4. With disposable development data, exercise registration/invitation redemption, party/coalition proposal voting, bill committee/votes/deadlines, election transitions, and moderation reporting. Test simultaneous votes/reports/invitations and requests close to deadline boundaries. Confirm outcomes in the DB and scheduler logs; automated unit tests alone do not prove these cases.
5. Only after the development verification and production duplicate review, deploy production with a verified backup and monitor health, bot responses, scheduler logs, and player-visible game state. Keep a rollback plan for the **app and database**: migrations are not automatically reversible. Production `update` is blocked while production is offline/locked; follow the unlock → deploy → status → online order in `deploy.md` when ready.

Custom player colour schemes require migration `0052_shared_color_schemes.sql` (after 0051). Apply it on development before trying the theme switcher, then verify creating, privately applying, publishing, using another player's scheme, and unpublishing. This migration creates a new table; it does not alter existing saved themes or user records.

## Known limits

`/api/health` only confirms database reachability, not schema version or every upstream service. The public Bot API has no per-client rate limit; add an edge rate limit if abusive traffic appears. Election transitions and coalition-membership checks have not had a database-backed race test against each other. The deployed API cannot be certified production-stable from static checks alone; a staging run with migrated data, concurrency tests, and operator review remain release gates.
