# Notification delivery

The dashboard's Z.com alerts (mentions and comments on your posts) and **Your next moves** are in-app
notifications. Pending next moves cannot be hidden or dismissed; individual
mentions retain their existing dismiss controls. Web Push is a separate, optional
delivery channel for both. It is **off by default**, requires a
browser click to request permission, and does not show mention text or pending
action titles on the lock screen unless the player explicitly enables
notification details. Settings are under Account settings → Alerts. The
preference centre cannot disable the in-app dashboard.
Quiet hours apply to Web Push only: messages during the chosen local
time interval are skipped, not delayed. The in-app list remains available.

## VPS configuration

Generate one VAPID key pair with `bunx web-push generate-vapid-keys` and
store `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (for example,
`mailto:ops@example.com`) in the server-side VPS `.env`. Treat the private key
as a secret and **keep the same pair between deployments**. Do not commit it or
put it in a `VITE_` variable. If these three variables are absent, the UI
explains Web Push is unavailable; the rest of the app still works. The
repository's `.env` is not safe for browser mutation tests.

Migration `0056_notification_delivery.sql` is additive and has not been
applied to deployed dev or production by this refactor. Rehearse it against a
disposable database before any reviewed deployment. The current VPS update
still uses planned downtime: backup, stop app and scheduler, migrate, restart.

PostgreSQL inserts a source ID into `notification_outbox` in the **same
transaction** as a new social post/comment. The existing scheduler calls
`/api/notification-delivery` every ten seconds with `CRON_INTERNAL_TOKEN`;
the endpoint leases rows and retries failed deliveries. It reuses the current
mention eligibility query, including actor identity and dismissals, and checks
active account, preferences and quiet hours at delivery time. Each endpoint
must be an HTTPS URL at a recognized browser push service; invalid and expired
subscriptions are rejected or removed. Push payloads link only to the
corresponding dashboard social route. Duplicate retries share a notification
tag so browsers can replace an earlier notification.

The scheduler also scans the dashboard's pending decision rules every 30
seconds for subscribed users: joining a party, primary and national election
actions, bill votes, committee assessments and coalition votes. Receipts
deduplicate each action/cycle; quiet hours skip Web Push without removing the
action from the in-app dashboard. By default, push says only that a decision
is waiting. A player must opt into notification details to show its title.

## Safe VS Code local testing

Run the default VS Code build task, **Oscana: production clone + isolated app +
scheduler** (`.vscode/tasks.json`) with `OSCANA_VPS_SSH` exported in VS Code's
environment. It creates a disposable PostgreSQL container on loopback port
55440, copies a fresh VPS production backup over SSH, restores it into the
container, starts the `demo-oscana` Firebase Auth Emulator, migrates the copy,
and serves the app on `http://127.0.0.1:31017` with a local scheduler. It
does not seed synthetic database users. Stop the task to stop the app,
emulator, scheduler and its container. Never point it at the repository
`.env`; the task sets safe values explicitly and refuses to reuse occupied
ports. An emulator login for `ajstrongdev@pm.me` uses `local-e2e-password` if
that user is present in the clone. Web Push is disabled so production push
subscriptions are not contacted. `node scripts/local/full-stack.mjs --check`
checks startup and health without starting the scheduler and shuts down.

Web Push cannot be fully exercised against the Firebase Auth Emulator alone:
the browser's push service is external. CI exercises the database transaction,
outbox, scheduler authorization, in-app actions and browser navigation, with
Web Push **unconfigured** to prevent external delivery. Before enabling it in a
deployment, test opt-in/receipt with a dedicated non-production Firebase
project and a real browser, then confirm expired subscriptions and quiet hours.
