# VPS Deployment Runbook

This is the complete start-to-finish runbook for Democracy Online. It assumes a
fresh Ubuntu VPS and intentionally spells out every manual step. Follow it in
order. Do not deploy the application before completing the environment checks.

## Final Architecture

One VPS runs two independent checkouts of the same repository:

| Purpose     | Checkout                    | Git branch                  | URL                         | Host port | Compose project        | Docker subnet   | Database              |
| ----------- | --------------------------- | --------------------------- | --------------------------- | --------- | ---------------------- | --------------- | --------------------- |
| Production  | `/srv/democracyonline-prod` | Whichever branch you select | `https://oscana.nya.je`     | `3000`    | `democracyonline-prod` | `172.30.0.0/24` | `democracyonline`     |
| Development | `/srv/democracyonline-dev`  | Whichever branch you select | `https://dev.oscana.nya.je` | `3001`    | `democracyonline-dev`  | `172.31.0.0/24` | `democracyonline_dev` |

Each checkout has its own `.env`, Git branch, Docker network, application,
scheduler, and database credentials. Both use one Firebase project. PostgreSQL
runs directly on the VPS, outside Docker. Caddy terminates HTTPS and proxies to
the two loopback-only application ports.

The current release branch is named `revival` in Git. It is lowercase even
though this document refers to it as the Revival branch in prose. GitHub raw
URLs and Git commands are case-sensitive.

## Before You Begin

Have these ready:

- A freshly installed Ubuntu 26.04 LTS VPS with root or sudo access.
- The VPS public IPv4 address.
- DNS control for `oscana.nya.je` and `dev.oscana.nya.je`.
- Access to the shared Firebase project.
- The email addresses that should have `/admin` access.
- Access to <https://github.com/ajstrongdev/democracyonline.io>.

The bootstrap script installs Docker, Node.js, pnpm, PostgreSQL, Caddy, UFW,
Git, database tools, and the two systemd units. It also creates the two
databases and writes generated database URLs into each checkout's `.env`.

## 1. Point DNS At The VPS

Do this at the DNS provider before or immediately after bootstrapping. If the
DNS zone is `oscana.nya.je`, create:

| Type | Name  | Value           |
| ---- | ----- | --------------- |
| `A`  | `@`   | `YOUR_VPS_IPV4` |
| `A`  | `dev` | `YOUR_VPS_IPV4` |

If the DNS zone is instead `nya.je`, use names `oscana` and `dev.oscana`.
Do not create AAAA records unless IPv6 is configured and firewalled correctly
on the VPS.

Later, verify both records:

```bash
dig +short oscana.nya.je A
dig +short dev.oscana.nya.je A
```

Both commands must return the VPS IPv4 address.

## 2. Download And Run The Bootstrap Script

SSH into the blank VPS:

```bash
ssh root@YOUR_VPS_IPV4
```

Install the two tools needed to download and inspect the bootstrap script:

```bash
apt-get update
apt-get install -y ca-certificates curl less
```

Download the script from the lowercase `revival` branch into `/tmp`:

```bash
curl -fsSL \
  https://raw.githubusercontent.com/ajstrongdev/democracyonline.io/revival/scripts/vps-bootstrap.sh \
  -o /tmp/vps-bootstrap.sh
```

Inspect it before running it as root:

```bash
less /tmp/vps-bootstrap.sh
```

Run it. `INITIAL_BRANCH` only controls the initial clone; it does not pin either
checkout, and both can be switched independently afterward.

```bash
sudo env \
  INITIAL_BRANCH=revival \
  PROD_DOMAIN=oscana.nya.je \
  DEV_DOMAIN=dev.oscana.nya.je \
  TLS_EMAIL=YOUR_REAL_EMAIL_ADDRESS \
  bash /tmp/vps-bootstrap.sh
```

The bootstrap performs these actions:

1. Installs OS packages, Docker Engine and Compose, Node.js 22+, and pnpm.
2. Creates the `deploy` Unix user and adds it to the Docker group.
3. Clones the Revival branch into both `/srv` checkouts.
4. Installs PostgreSQL on the host.
5. Generates URL-safe hexadecimal database passwords.
6. Creates separate production and development roles/databases.
7. Restricts PostgreSQL authentication to the VPS and the two fixed Docker
   subnets.
8. Creates both mode-600 `.env` files with database URLs and random cron tokens.
9. Installs Caddy and writes both reverse-proxy sites.
10. Enables UFW with SSH/HTTP/HTTPS open and PostgreSQL closed to the internet.
11. Installs and enables, but does not start, both systemd application units.

Generated database passwords are retained in this root-only recovery file:

```text
/etc/democracyonline/database-credentials.env
```

Do not delete or loosen permissions on it. Bootstrap is safe to rerun: it does
not overwrite existing `.env` files or rotate an established bootstrap
credential file. It refuses to take over pre-existing Democracy Online database
roles if it cannot prove which credentials belong to them.

## 3. Confirm Bootstrap Results

Still as root, run:

```bash
systemctl is-active docker postgresql caddy
docker compose version
node --version
pnpm --version
sudo -u postgres psql -c '\du democracyonline_prod'
sudo -u postgres psql -c '\du democracyonline_dev'
sudo -u postgres psql -lqt | cut -d '|' -f 1 | grep democracyonline
ls -l /srv/democracyonline-prod/.env /srv/democracyonline-dev/.env
ls -l /etc/democracyonline/database-credentials.env
```

Expected results:

- Docker, PostgreSQL, and Caddy are `active`.
- Node.js is version 22 or newer.
- Both database roles and both databases exist.
- All three credential files are readable only by their intended owner.

Check the detected database host and managed PostgreSQL access rules without
printing passwords:

```bash
sudo -u postgres psql -tAc 'show listen_addresses'
sudo -u postgres psql -tAc 'show hba_file'
sudo grep -A6 'BEGIN DEMOCRACYONLINE MANAGED' \
  "$(sudo -u postgres psql -tAc 'show hba_file')"
```

## 4. Configure The Shared Firebase Project

Production and development use one Firebase project, so the values in this
section are copied into both `.env` files.

### Enable Email/Password Authentication

1. Open <https://console.firebase.google.com/>.
2. Select the existing project.
3. Open **Authentication**.
4. Open **Sign-in method**.
5. Enable **Email/Password**.
6. Open **Authentication > Settings > Authorized domains**.
7. Add `oscana.nya.je`.
8. Add `dev.oscana.nya.je`.

### Obtain The Browser Configuration

1. Open **Project settings > General**.
2. Under **Your apps**, select the existing Web app or create one with the `</>`
   button.
3. Copy these values from the displayed Firebase configuration:

```text
apiKey             -> VITE_FIREBASE_API_KEY
authDomain         -> VITE_FIREBASE_AUTH_DOMAIN
projectId          -> VITE_FIREBASE_PROJECT_ID
storageBucket      -> VITE_FIREBASE_STORAGE_BUCKET
messagingSenderId  -> VITE_FIREBASE_MESSAGING_SENDER_ID
appId              -> VITE_FIREBASE_APP_ID
measurementId      -> VITE_FIREBASE_MEASUREMENT_ID (optional)
```

### Obtain The Server Credentials

1. Open **Project settings > Service accounts**.
2. Click **Generate new private key**.
3. Store the downloaded JSON securely on your own computer. Never commit it or
   upload the JSON file to the repository.
4. Read the required values locally with `jq`:

```bash
jq -r '.project_id' path/to/firebase-service-account.json
jq -r '.client_email' path/to/firebase-service-account.json
jq -r '.private_key | @json' path/to/firebase-service-account.json
```

Map them as follows:

```text
project_id   -> FIREBASE_PROJECT_ID
client_email -> FIREBASE_CLIENT_EMAIL
private_key  -> FIREBASE_PRIVATE_KEY
```

The `@json` command outputs the private key surrounded by quotes with embedded
newlines represented as `\n`. Paste that complete quoted value after
`FIREBASE_PRIVATE_KEY=`. Do not remove the quotes.

### Create The Two Seeded Firebase Users

The fresh database seed creates these provisional officeholders in PostgreSQL:

```text
ajstrongdev@pm.me
jenewland1999@gmail.com
```

Database seeding does not create Firebase Authentication users. In **Firebase
Console > Authentication > Users**, add both emails and assign secure initial
passwords. Because Firebase is shared, those credentials authenticate on both
sites while each site retains its own database state.

## 5. Complete Both Environment Files

Switch to the deployment user:

```bash
sudo -iu deploy
```

Edit production first:

```bash
nano /srv/democracyonline-prod/.env
```

The bootstrap already populated these production-specific values; verify them
but do not replace the generated secrets:

```env
NODE_ENV="production"
DEPLOYED_ENV="production"
APP_PORT="3000"
COMPOSE_PROJECT_NAME="democracyonline-prod"
DOCKER_SUBNET="172.30.0.0/24"
SITE_URL="https://oscana.nya.je"
DATABASE_URL="postgresql://democracyonline_prod:GENERATED_PASSWORD@VPS_IP:5432/democracyonline"
CRON_INTERNAL_TOKEN="GENERATED_TOKEN"
```

Edit development:

```bash
nano /srv/democracyonline-dev/.env
```

Verify these development-specific values:

```env
NODE_ENV="production"
DEPLOYED_ENV="development"
APP_PORT="3001"
COMPOSE_PROJECT_NAME="democracyonline-dev"
DOCKER_SUBNET="172.31.0.0/24"
SITE_URL="https://dev.oscana.nya.je"
DATABASE_URL="postgresql://democracyonline_dev:GENERATED_PASSWORD@VPS_IP:5432/democracyonline_dev"
CRON_INTERNAL_TOKEN="GENERATED_TOKEN"
```

Do not literally replace the generated database URL or cron token with the
placeholder text above. They are shown only to explain the expected shape.

Set these shared Firebase/admin values in **both** files:

```env
ADMIN_EMAILS="YOUR_ADMIN_EMAIL,YOUR_SECOND_ADMIN_EMAIL"

FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="value-copied-from-firebase"
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_FIREBASE_MEASUREMENT_ID="..."
```

For this VPS deployment:

- `CRON_INTERNAL_TOKEN` is required and was generated by bootstrap.
- `CRON_LOCAL_TOKEN` was generated but is only used by non-production localhost
  development.
- `CRON_SCHEDULER_TOKEN` can stay empty because the Docker sidecar uses the
  internal token; it is only needed for an external/GCP scheduler.
- `GCP_PROJECT_ID`, `CLOUD_TASKS_LOCATION`, `ELECTION_TASK_QUEUE`, and
  `ELECTION_TASK_SERVICE_ACCOUNT` can stay empty for the VPS deployment.
- `BILL_ADVANCE_SCHEDULE_UTC` is legacy. Bills use durable per-row deadlines.
- `ELECTION_TIME_MULTIPLIER` is only a fallback before `game_settings` exists;
  normal speed changes happen in `/admin`.

Protect both files again after editing:

```bash
chmod 600 /srv/democracyonline-prod/.env /srv/democracyonline-dev/.env
```

## 6. Select Branches Independently

Each checkout can run a different branch. For the initial deployment, select
the lowercase Revival branch in both:

```bash
cd /srv/democracyonline-dev
git fetch --prune origin
git checkout revival
git pull --ff-only origin revival
pnpm install --frozen-lockfile

cd /srv/democracyonline-prod
git fetch --prune origin
git checkout revival
git pull --ff-only origin revival
pnpm install --frozen-lockfile
```

Later you may run `git checkout ANOTHER_BRANCH` in either directory without
affecting the other environment. `pnpm update` always preserves and pulls the
currently checked-out branch; it never switches branches.

## 7. Validate Configuration And Database Authentication

Run the deployment checker in both checkouts:

```bash
cd /srv/democracyonline-dev && pnpm deploy:check
cd /srv/democracyonline-prod && pnpm deploy:check
```

It checks required variables, placeholder values, HTTPS URLs, Firebase key
shape, Firebase project consistency, Docker Compose rendering, and a real
database login. It never prints passwords or private keys.

Do not continue until both commands report `OK`.

If Docker reports that either fixed subnet overlaps an existing network, choose
two unused private `/24` ranges, update `DOCKER_SUBNET` in the affected `.env`,
and update the matching managed PostgreSQL and UFW rules before deploying.

## 8. Migrate And Seed Development

Run migrations first:

```bash
cd /srv/democracyonline-dev
pnpm db:migrate
```

For a brand-new database, initialize the game data:

```bash
pnpm seed:fresh
```

`seed:fresh` is destructive. It truncates game data before inserting the
nation, policy/stat definitions, provisional officeholders, elections, and
game settings. Use it now for the blank database; do not use it later as a
normal update command.

## 9. Deploy And Verify Development

Deploy the app and scheduler:

```bash
cd /srv/democracyonline-dev
pnpm deploy
pnpm deploy:ps
```

Both `app` and `election-scheduler` must show as running. Inspect the scheduler:

```bash
docker compose --env-file .env logs --tail=40 --timestamps election-scheduler
```

Expected lines include:

```text
[scheduler] starting target=http://app:3000 intervalMs=60000
[scheduler] ... /api/election-advance 200 ...ms
[scheduler] ... /api/bill-advance 200 ...ms
```

Test the loopback and public endpoints:

```bash
curl -I http://127.0.0.1:3001
curl -I https://dev.oscana.nya.je
```

Sign in using one of the Firebase users created earlier. Confirm `/admin` is
available to an email listed in `ADMIN_EMAILS`. In **Admin > Game speed**, set
development to `dev` (720x) if you want approximately 40-second bill stages.

Create a test bill, cast a yes vote, and watch scheduler logs as it advances.
With zero yes votes, a tied `0–0` vote is defeated by design.

## 10. Migrate And Seed Production

Only continue after development works.

```bash
cd /srv/democracyonline-prod
pnpm db:migrate
SEED_ALLOW_PRODUCTION=true pnpm seed:fresh
```

The production guard is deliberately explicit because `seed:fresh` destroys
existing game data. Use it only for this brand-new production database unless
you intentionally want a complete reset.

Production starts at the `regular` game speed. Leave it there unless you have a
specific reason to accelerate the live game.

## 11. Deploy And Verify Production

```bash
cd /srv/democracyonline-prod
pnpm deploy
pnpm deploy:ps
docker compose --env-file .env logs --tail=40 --timestamps election-scheduler
curl -I http://127.0.0.1:3000
curl -I https://oscana.nya.je
```

Again, both containers must be running and scheduler calls must return 200.
Sign in and verify `/admin`, the dashboard, bills, elections, and the calendar.

## 12. Activate Systemd And Test A Reboot

Exit the `deploy` shell, start both already-enabled units, and check them:

```bash
exit
sudo systemctl start democracyonline-dev.service democracyonline-prod.service
sudo systemctl status democracyonline-dev.service --no-pager
sudo systemctl status democracyonline-prod.service --no-pager
sudo systemctl is-enabled democracyonline-dev.service democracyonline-prod.service
```

The units are `oneshot` services that start detached Compose stacks. Docker's
`restart: unless-stopped` policy keeps each container running.

Perform the final persistence test:

```bash
sudo reboot
```

Reconnect after the VPS returns, then run:

```bash
sudo systemctl is-active docker postgresql caddy
sudo systemctl is-active democracyonline-dev.service democracyonline-prod.service
sudo -iu deploy bash -lc 'cd /srv/democracyonline-dev && pnpm deploy:ps'
sudo -iu deploy bash -lc 'cd /srv/democracyonline-prod && pnpm deploy:ps'
curl -I https://dev.oscana.nya.je
curl -I https://oscana.nya.je
```

The installation is complete only when all checks succeed after reboot.

## Routine Deployments

Run application commands as `deploy`:

```bash
sudo -iu deploy
```

### Pull The Current Branch And Redeploy

```bash
cd /srv/democracyonline-dev
pnpm update
```

### Pull, Migrate, And Redeploy

Use this after reviewing new migrations and testing them in development:

```bash
cd /srv/democracyonline-dev
pnpm update:migrate
```

Then back up production and repeat there:

```bash
cd /srv/democracyonline-prod
pnpm update:migrate
```

Both commands refuse dirty or detached Git checkouts. They preserve the current
branch, require a fast-forward pull, install the lockfile exactly, and rebuild
both the app and scheduler.

### Switch One Environment To Another Branch

```bash
cd /srv/democracyonline-dev
git status
git fetch --prune origin
git checkout BRANCH_NAME
pnpm update:migrate
```

This does not affect production.

### Common Commands

```bash
pnpm deploy           # build and start app + scheduler
pnpm deploy:restart   # force-recreate both containers
pnpm deploy:ps        # status
pnpm deploy:logs      # follow all logs
pnpm deploy:down      # stop this checkout's stack
pnpm deploy:check     # validate env, Compose, and database login
pnpm db:migrate       # apply pending migrations only
```

## Backups

Take a production backup before every production migration. As `deploy`:

```bash
mkdir -p /srv/backups/democracyonline
cd /srv/democracyonline-prod
DATABASE_URL="$(node --env-file=.env -p 'process.env.DATABASE_URL')"
pg_dump --format=custom \
  --file="/srv/backups/democracyonline/prod-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  "$DATABASE_URL"
```

List and inspect backups:

```bash
ls -lh /srv/backups/democracyonline
pg_restore --list /srv/backups/democracyonline/PROD_BACKUP.dump >/dev/null
```

A backup on the same VPS does not protect against disk or VPS loss. Copy
backups to another machine or object-storage provider, retain multiple days,
and periodically restore one into a disposable database. Never test a restore
against production.

## Scheduler Troubleshooting

No system crontab is required. Each checkout's `election-scheduler` calls these
idempotent endpoints every minute over its private Compose network:

```text
POST http://app:3000/api/election-advance
GET  http://app:3000/api/bill-advance
GET  http://app:3000/api/game-advance
```

The game endpoint self-throttles to game pace. Endpoint failures are isolated,
so an election failure does not prevent the bill reconciler from running.

If a bill remains at **Advancing now**:

```bash
cd /srv/democracyonline-dev  # or production
pnpm deploy:ps
docker compose --env-file .env logs --tail=100 --timestamps election-scheduler
```

Diagnosis:

- Only `app` exists: run `pnpm deploy`; the single Compose file includes both.
- Scheduler is restarting with a missing token: restore `CRON_INTERNAL_TOKEN`
  in this checkout's `.env`, then run `pnpm deploy:restart`.
- Scheduler logs 401: the app container has an old token; run
  `pnpm deploy:restart`.
- Scheduler logs database/500 errors: fix that endpoint; bill advancement still
  runs independently on each tick.

Force one bill reconciliation from inside the scheduler container:

```bash
docker compose --env-file .env exec election-scheduler node -e '
fetch("http://app:3000/api/bill-advance", {
  headers: { "x-internal-cron-token": process.env.CRON_INTERNAL_TOKEN }
}).then(async response => {
  console.log(response.status)
  console.log(await response.text())
})'
```

A 200 response means reconciliation completed; it may make no changes when no
deadline is due. Admins can also trigger reconciliation from `/admin`.

## PostgreSQL Troubleshooting

Check service and logs:

```bash
sudo systemctl status postgresql --no-pager
sudo journalctl -u postgresql -n 100 --no-pager
```

Confirm the fixed application networks:

```bash
docker network inspect democracyonline-prod-network
docker network inspect democracyonline-dev-network
```

Test credentials without displaying them:

```bash
sudo -iu deploy bash -lc 'cd /srv/democracyonline-prod && pnpm deploy:check'
sudo -iu deploy bash -lc 'cd /srv/democracyonline-dev && pnpm deploy:check'
```

Do not use `localhost` in `DATABASE_URL`: inside the application container,
localhost means the container itself. Bootstrap writes the reachable VPS IP.
Do not expose PostgreSQL port 5432 publicly.

## Caddy And TLS Troubleshooting

```bash
dig +short oscana.nya.je A
dig +short dev.oscana.nya.je A
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 100 --no-pager
sudo ufw status verbose
```

Ports 80 and 443 must also be open in any firewall supplied by the VPS provider.
Application ports 3000/3001 and PostgreSQL 5432 must not be publicly exposed.

## GitHub Actions (Optional)

The `Deploy VPS` workflow is manual. It SSHes into the selected checkout and
runs `pnpm update`, preserving whichever branch that checkout currently uses.

Create these GitHub Actions secrets:

| Secret         | Value                                                   |
| -------------- | ------------------------------------------------------- |
| `VPS_HOST`     | VPS hostname or IP                                      |
| `VPS_USER`     | `deploy`                                                |
| `VPS_SSH_KEY`  | Private key for the deploy user's authorized public key |
| `VPS_SSH_PORT` | Usually `22`                                            |
| `VPS_PROD_DIR` | `/srv/democracyonline-prod`                             |
| `VPS_DEV_DIR`  | `/srv/democracyonline-dev`                              |

Create GitHub environments named `Dev` and `Prod`; protect `Prod` with required
reviewers. The workflow does not run migrations. For schema releases, use
`pnpm update:migrate` over SSH after testing development and taking a backup.

## Migrating The Old Single-Checkout Deployment

Before pulling a revision that removes the old override files, stop whichever
old stack exists:

```bash
cd /srv/democracyonline.io
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml down
# or:
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml down
```

Then follow this runbook using the two new checkouts. Do not copy the old `.env`
unchanged into both: ports, project names, Docker subnets, deployed environment,
site URL, database URL, and cron tokens must remain environment-specific.

## Managed PostgreSQL Alternative

If you later move PostgreSQL to a provider:

1. Create separate production and development databases and users.
2. Require TLS and enable automated backups/point-in-time recovery.
3. Allow connections only from the VPS IP or private network.
4. Replace each checkout's `DATABASE_URL` with its provider URL, usually ending
   in `?sslmode=require`.
5. Run `pnpm deploy:check` in both checkouts.
6. Migrate and restore data deliberately before switching applications.

Do not point both environments at one database.
