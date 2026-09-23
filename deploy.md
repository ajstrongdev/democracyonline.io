# VPS deployment guide

This project supports two live environments from the same repository:

- Production: root domain, for example `https://oscana.nya.je`
- Development: subdomain, for example `https://dev.oscana.nya.je`

Each environment gets its own `.env` file and its own Compose override so you can deploy either target independently. PostgreSQL is external to Docker; provision one database for each environment and put its reachable connection string in `DATABASE_URL`.

GitHub Actions is optional. You can ignore the entire **Automatic GitHub deployment** section and deploy manually over SSH using the commands in **Manual deployment without GitHub Actions** below.

## Manual deployment without GitHub Actions

Use this path if you want to deploy directly from an SSH session on the VPS. You do not need GitHub Actions secrets, a GitHub SSH key, or the `Deploy VPS` workflow.

### First-time VPS setup

The commands below target Ubuntu 26.04 LTS. Confirm the VPS version before continuing:

```bash
cat /etc/os-release
```

The output should identify Ubuntu 26.04 LTS (`VERSION_ID="26.04"`). The same Docker repository setup also works on current Ubuntu LTS releases, but package availability may differ on other distributions.

#### Install base packages

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git openssl unzip jq ufw
```

#### Install Docker Engine and Compose

Remove conflicting distribution packages if they are installed:

```bash
sudo apt remove -y docker.io docker-compose docker-doc containerd runc || true
```

Add Docker's official Ubuntu repository and signing key:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Enable Docker at boot and verify both Docker Engine and Compose:

```bash
sudo systemctl enable --now docker
sudo systemctl is-active --quiet docker && echo "Docker is running"
sudo docker version
sudo docker compose version
```

Allow the deployment user to run Docker without `sudo`. Replace `YOUR_LINUX_USER` with the user you will use for deployment:

```bash
sudo usermod -aG docker YOUR_LINUX_USER
```

Log out and back in, then verify that the group change works:

```bash
id
docker run --rm hello-world
```

Do not expose the Docker API socket or TCP API to the internet. Access to the `docker` group is effectively root-level access on the VPS, so only add trusted deployment users.

#### Install Node.js and pnpm

The application requires Node.js 22 or newer for local migrations, seeding, and deployment scripts. Install the current Node.js 22 LTS line from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Enable the pnpm version declared by the repository:

```bash
sudo corepack enable
sudo corepack prepare pnpm@10.28.2 --activate
pnpm --version
```

If `corepack` is not available in the installed Node.js package, install pnpm directly as the deployment user instead:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc
pnpm --version
```

#### Configure the firewall

Allow SSH before enabling UFW so you do not lock yourself out. Allow HTTP and HTTPS for the reverse proxy. Do not expose PostgreSQL or the Docker API publicly:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose
```

If SSH uses a non-standard port, allow that port instead of `OpenSSH`.

#### Clone the repository and install dependencies

Then clone the repository:

```bash
git clone https://github.com/ajstrongdev/democracyonline.io.git /srv/democracyonline.io
cd /srv/democracyonline.io
pnpm install --frozen-lockfile
```

If the repository is private, authenticate Git as the VPS deployment user before cloning. Keep the repository checkout and environment files owned by the same user that runs Docker Compose.

Create the shared environment file and fill it in using the database and Firebase values described below. Set `DEPLOYED_ENV` in your shell before each script or deploy command to choose the target mode.

```bash
cd /srv/democracyonline.io
cp .env.example .env
chmod 600 .env
```

The single `.env` file should hold the active target settings. The target is selected from the shell via `DEPLOYED_ENV`, for example `DEPLOYED_ENV=development` or `DEPLOYED_ENV=production`.

### First deployment

Create the external databases first, then apply migrations. The migration commands must run from the repository directory using the shared `.env` file and the active target selection:

```bash
cd /srv/democracyonline.io
DEPLOYED_ENV=development COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
DEPLOYED_ENV=production COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
```

Deploy each environment independently:

```bash
pnpm deploy:dev
pnpm deploy:prod
```

Both commands run detached Docker Compose services and return you to the shell. Docker only runs the app; it does not create, migrate, seed, or reset PostgreSQL.

### Manual updates

When deploying a new commit, run these commands on the VPS:

```bash
cd /srv/democracyonline.io
git fetch origin revival
git checkout revival
git pull --ff-only origin revival
pnpm install --frozen-lockfile
pnpm deploy:dev
```

For a production release, update the same checkout to the commit you want to release, apply and verify any migrations, then deploy production:

```bash
cd /srv/democracyonline.io
git fetch origin revival
git checkout revival
git pull --ff-only origin revival
pnpm install --frozen-lockfile
DEPLOYED_ENV=production COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
pnpm deploy:prod
```

If you want to deploy a specific commit instead of the latest branch commit, use a detached checkout after fetching it, then run the appropriate deploy command:

```bash
git fetch origin
git checkout --detach REVISION_OR_TAG
pnpm install --frozen-lockfile
pnpm deploy:prod
```

Return the checkout to the deployment branch before the next normal update:

```bash
git checkout revival
git pull --ff-only origin revival
```

### Manual monitoring and rollback

View the environment logs:

```bash
pnpm logs:dev
pnpm logs:prod
```

Check container health and status:

```bash
DEPLOYED_ENV=development docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml ps
DEPLOYED_ENV=production docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

To roll back the app code, check out a known-good commit and redeploy the affected environment:

```bash
git checkout --detach KNOWN_GOOD_COMMIT
pnpm install --frozen-lockfile
pnpm deploy:prod
```

Do not roll back database migrations automatically. Database changes may not be safely reversible; inspect the migration and restore from a verified backup if data recovery is required.

## Automatic GitHub deployment

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which deploys to the VPS over SSH.

The deployment rules are intentionally narrow:

| GitHub event                                 | Selected environment | Result                                                      |
| -------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| Push or merge into `revival`                 | Dev                  | Deploys the latest `revival` commit with `pnpm deploy:dev`  |
| Manual `workflow_dispatch`, selecting `Dev`  | Dev                  | Deploys the latest `revival` commit with `pnpm deploy:dev`  |
| Manual `workflow_dispatch`, selecting `Prod` | Prod                 | Deploys the latest `revival` commit with `pnpm deploy:prod` |

There is no automatic production deployment. A pull request, push to another branch, or merge into a non-default branch does not deploy anything. The manual production release always deploys the current `revival` branch, so merge the release into `revival` first.

### Prepare the VPS for GitHub Actions

Complete the following once on the VPS.

1. Create a dedicated deployment user. Do not use `root` for GitHub Actions:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
```

Log out and back in, or start a new SSH session, before testing Docker access for this user.

2. Install Git, Node.js 22 or newer, pnpm, and Docker Compose. Verify the commands as the deployment user:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
node --version
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm --version
docker --version
docker compose version
```

3. Clone the repository into the deployment directory and make the deployment user its owner:

```bash
sudo mkdir -p /srv/democracyonline.io
sudo chown deploy:deploy /srv/democracyonline.io
sudo -u deploy git clone https://github.com/ajstrongdev/democracyonline.io.git /srv/democracyonline.io
```

If the repository is private, configure a read-only deploy key or another Git credential for the `deploy` user. Do not put a GitHub token in the workflow command or in `.env`.

4. Create the shared `.env` file on the VPS, owned and readable only by the deployment user:

```bash
sudo -u deploy cp /srv/democracyonline.io/.env.example /srv/democracyonline.io/.env
sudo chmod 600 /srv/democracyonline.io/.env
```

Fill in the real Firebase credentials, database URLs, domain names, cron tokens, and schedules. This file stays on the VPS and is not committed to Git. Set `DEPLOYED_ENV=development` or `DEPLOYED_ENV=production` in the shell before running the target-specific commands.

5. Test the exact commands that GitHub Actions will run:

```bash
sudo -iu deploy
cd /srv/democracyonline.io
pnpm install --frozen-lockfile
pnpm deploy:dev
pnpm logs:dev
exit
```

Apply the dev migration before the first dev deployment, then apply the production migration separately after confirming the dev app works:

```bash
sudo -iu deploy
cd /srv/democracyonline.io
DEPLOYED_ENV=development COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
DEPLOYED_ENV=production COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
exit
```

### Create the GitHub SSH key

Generate a dedicated key on your workstation, not on the VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-democracyonline" -f ~/.ssh/democracyonline_github_actions
```

Install only the public key for the `deploy` user:

```bash
ssh-copy-id -i ~/.ssh/democracyonline_github_actions.pub deploy@YOUR_VPS_HOST
```

Test it explicitly:

```bash
ssh -i ~/.ssh/democracyonline_github_actions deploy@YOUR_VPS_HOST
```

Copy the complete contents of the private key file for the GitHub secret. Store it as a GitHub Actions secret, never as a repository variable:

```bash
cat ~/.ssh/democracyonline_github_actions
```

The key should be restricted to the deployment user. Consider limiting its `authorized_keys` entry to the GitHub Actions runner IP ranges only if your SSH firewall strategy can keep those ranges current.

### Configure GitHub Actions secrets

In GitHub, open **Settings > Secrets and variables > Actions** and add these secrets. Repository-level secrets are sufficient, although `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` can also be set separately on the `Dev` and `Prod` environments.

| Secret         | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| `VPS_HOST`     | VPS hostname or IP address                                  |
| `VPS_USER`     | `deploy`                                                    |
| `VPS_SSH_KEY`  | Complete private Ed25519 key, including the begin/end lines |
| `VPS_SSH_PORT` | SSH port, usually `22`; omit it to use the workflow default |
| `VPS_APP_DIR`  | `/srv/democracyonline.io`                                   |

If you use GitHub environment secrets, create environments named exactly `Dev` and `Prod`. The workflow selects those environments automatically. Protect the `Prod` environment with required reviewers so a production release requires approval before the SSH step runs.

### Verify automatic Dev deployment

After the VPS and secrets are ready:

1. Push or merge a small change into `revival`.
2. Open the repository's **Actions** tab.
3. Select **Deploy VPS** and open the running workflow.
4. Confirm the job says `Deploy Dev`.
5. On the VPS, check:

```bash
cd /srv/democracyonline.io
DEPLOYED_ENV=development docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml ps
pnpm logs:dev
```

The workflow fetches `origin/revival`, resets the checkout to that commit, removes untracked files, and runs the dev Compose deployment. It does not touch `.env` because that file is untracked and `git clean -fd` does not remove ignored environment files.

### Manually release Prod

Production releases are manual:

1. Merge the release into `revival`.
2. Open **Actions > Deploy VPS > Run workflow**.
3. Leave the branch as `revival`.
4. Select `Prod` from the environment input.
5. Start the workflow and approve the `Prod` environment if protection is enabled.
6. Verify the production service:

```bash
cd /srv/democracyonline.io
DEPLOYED_ENV=production docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
pnpm logs:prod
```

The workflow runs `pnpm deploy:prod`, which rebuilds the app image and recreates the running container as needed. It does not automatically run migrations or seed data. Apply and verify migrations explicitly before releasing a schema change.

## 1) Create the PostgreSQL databases

Docker does not create or initialize PostgreSQL. Create the database server, databases, and application roles before starting the app.

Use separate databases and separate credentials for production and development. Do not point both environments at the same database. A fresh database should be empty except for the default PostgreSQL objects; the application schema is installed in the migration step below.

### Option A: use managed PostgreSQL

This is the easiest production option. Create a PostgreSQL 15 or newer instance with your provider, then create two databases if the provider gives you one server:

- `democracyonline` for production
- `democracyonline_dev` for development

Create a separate login/password for each database. Enable SSL if the provider supports it, and copy the provider's complete connection string. It will usually look similar to one of these:

```text
postgresql://democracyonline_prod:password@db.example.com:5432/democracyonline?sslmode=require
postgresql://democracyonline_dev:password@db.example.com:5432/democracyonline_dev?sslmode=require
```

The exact hostname, port, username, password, and SSL options come from the provider. Do not use the example values above literally.

Configure the provider's network allowlist so that connections are allowed from:

- the VPS public IP, if the app connects over the public internet; or
- the private network/VPC between the VPS and the database, if both are in the same provider network.

Prefer private networking where it is available. If the provider offers automated backups, point-in-time recovery, and TLS, enable them for production.

### Option B: install PostgreSQL directly on the VPS

This keeps PostgreSQL outside Docker while storing its data in the VPS filesystem. It is suitable for a small deployment, but you are responsible for updates, backups, disk space, and recovery.

Install PostgreSQL on Ubuntu or Debian:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo systemctl status postgresql
```

Generate strong passwords without putting them in shell history:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Use one generated value for the production role and one for the development role. Connect to PostgreSQL as its administrator:

```bash
sudo -u postgres psql
```

Create independent roles and databases. Replace both password placeholders before running this SQL:

```sql
CREATE ROLE democracyonline_prod LOGIN PASSWORD 'REPLACE_WITH_PROD_PASSWORD';
CREATE DATABASE democracyonline OWNER democracyonline_prod;

CREATE ROLE democracyonline_dev LOGIN PASSWORD 'REPLACE_WITH_DEV_PASSWORD';
CREATE DATABASE democracyonline_dev OWNER democracyonline_dev;

\connect democracyonline
GRANT ALL PRIVILEGES ON SCHEMA public TO democracyonline_prod;

\connect democracyonline_dev
GRANT ALL PRIVILEGES ON SCHEMA public TO democracyonline_dev;
\q
```

The application role must be able to create and alter tables because Drizzle migrations run using that role. Keep the PostgreSQL administrator role out of the application environment.

If the app and PostgreSQL are on the same VPS, do not use `localhost` in the container's connection string: `localhost` inside Docker means the app container itself. Use the VPS private IP or a hostname that resolves to the VPS from the container, for example:

```env
DATABASE_URL="postgresql://democracyonline_prod:REPLACE_WITH_PROD_PASSWORD@10.0.0.10:5432/democracyonline"
DATABASE_URL="postgresql://democracyonline_dev:REPLACE_WITH_DEV_PASSWORD@10.0.0.10:5432/democracyonline_dev"
```

Use the actual private address of the VPS. You can find its addresses with:

```bash
ip -brief address
```

Configure PostgreSQL to listen on the address used by the app. First inspect the active configuration paths:

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
```

Edit `postgresql.conf` and set `listen_addresses` to the VPS private address, or to `*` only when the firewall prevents unwanted access:

```conf
listen_addresses = '10.0.0.10'
port = 5432
```

Then add a rule to `pg_hba.conf`. Replace the subnet with the Docker network subnet shown by the command below:

```bash
docker network ls
docker network inspect democracyonline_default
```

Example `pg_hba.conf` entries:

```conf
host    democracyonline       democracyonline_prod    172.18.0.0/16    scram-sha-256
host    democracyonline_dev   democracyonline_dev    172.18.0.0/16    scram-sha-256
```

If the Compose project uses a different network name or subnet, use that actual value. Restrict access to the Docker network and trusted administration IPs; do not add `0.0.0.0/0`.

Restart PostgreSQL after changing its configuration:

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

If you use UFW, allow port 5432 only from the required private network or administration address. Do not expose it to the whole internet:

```bash
sudo ufw status verbose
sudo ufw allow from 10.0.0.0/24 to any port 5432 proto tcp
```

Adjust the subnet to your network. If PostgreSQL and the app are on the same machine, Docker networking and UFW rules can interact differently depending on the host setup; verify the connection from the app container rather than assuming the firewall rule is sufficient.

### Test the database credentials

From the VPS host, test each connection before deploying. The password will be requested interactively:

```bash
psql "postgresql://democracyonline_prod@10.0.0.10:5432/democracyonline" -W -c 'select current_database(), current_user, version();'
psql "postgresql://democracyonline_dev@10.0.0.10:5432/democracyonline_dev" -W -c 'select current_database(), current_user, version();'
```

From inside the app container, test the network path after the first app build:

```bash
DEPLOYED_ENV=production docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml run --rm app node -e "const net = require('node:net'); const url = new URL(process.env.DATABASE_URL); const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 5432) }, () => { console.log('database host reachable'); socket.end(); }); socket.on('error', (error) => { console.error(error.message); process.exit(1); });"
```

This only tests TCP reachability. The migration command below tests authentication and database permissions as well.

## 2) Create environment files

Create the shared file in the project root:

```bash
cp .env.example .env
```

Then fill it in with the correct values for the active target. Set `DEPLOYED_ENV=development` or `DEPLOYED_ENV=production` in the shell when running target-specific commands.

The dev environment should use a different database, different Firebase config if needed, and a shorter game schedule.

### Example prod settings

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
SITE_URL=https://democracyonline.io
DATABASE_URL=postgresql://democracyonline_prod:strongpassword@your-postgres-host:5432/democracyonline

FIREBASE_PROJECT_ID=prod-project
FIREBASE_CLIENT_EMAIL=prod-admin@prod-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n"

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=prod-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=prod-project
VITE_FIREBASE_STORAGE_BUCKET=prod-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

ADMIN_EMAILS=admin@example.com
CRON_SCHEDULER_TOKEN=prod-cron-token
CRON_INTERNAL_TOKEN=long-random-prod-internal-token
CRON_LOCAL_TOKEN=local-dev-token
DEPLOYED_ENV=production
```

### Example dev settings

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
SITE_URL=https://dev.oscana.nya.je
DATABASE_URL=postgresql://democracyonline_dev:strongpassword@your-postgres-host:5432/democracyonline_dev

FIREBASE_PROJECT_ID=dev-project
FIREBASE_CLIENT_EMAIL=dev-admin@dev-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxyz\n-----END PRIVATE KEY-----\n"

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=dev-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dev-project
VITE_FIREBASE_STORAGE_BUCKET=dev-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

ADMIN_EMAILS=admin@example.com
CRON_SCHEDULER_TOKEN=dev-cron-token
CRON_INTERNAL_TOKEN=long-random-dev-internal-token
CRON_LOCAL_TOKEN=local-dev-token
DEPLOYED_ENV=development
```

## 3) Set the game pace (DB-owned, changed in /admin)

Game pace is no longer set with environment variables. Apply migrations first
(step 4 runs before first deploy), then pick a speed in `/admin` → Game
speed. Presets: super-slow 0.25x, slow 0.5x, regular 1x, fast 2x, super-fast
72x, dev 720x, dev-relaxed 2x. Switching rescales every live deadline, so for
a beta dev instance pick `dev` (pres cycle ≈57min, bill stages ≈40s) instead
of waiting days.

`ELECTION_TIME_MULTIPLIER` remains only as a fallback for a fresh database
with no settings row. `BILL_ADVANCE_SCHEDULE_UTC` is legacy. Election
transitions are handled by the scheduler sidecar checking durable deadlines
every minute in both environments; the lifecycle transaction always
re-checks the deadline, so an election cannot transition early or twice.
Production should stay on `regular`.

For reference, the old 72x dev heartbeat produced approximately:

- Senate candidacy: 80 minutes instead of 4 days
- Senate voting: 80 minutes instead of 4 days
- Presidential candidacy: 3 hours 20 minutes instead of 10 days
- Presidential voting: 3 hours 20 minutes instead of 10 days
- Election night: 10 minutes instead of 12 hours
- Senate concluded period: 2 hours instead of 6 days
- Presidential concluded period: 2 hours 40 minutes instead of 8 days

## 4) Apply migrations and deploy production

```bash
pnpm deploy:prod
```

This starts the app with the prod environment file and the production override.

Before the first deploy, apply the schema from a machine that can reach the production database:

```bash
DEPLOYED_ENV=production COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
```

Docker does not provision, migrate, seed, or reset PostgreSQL. Environment timing changes apply to newly created or newly transitioned election deadlines; they do not rewrite timestamps already stored in the database. For a fresh Dev environment, run `pnpm seed:fresh:dev` after migrating if you need all initial election timings to use the Dev multiplier.

For development, use the dev target instead:

```bash
DEPLOYED_ENV=development COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
```

## 5) Deploy development

```bash
pnpm deploy:dev
```

This starts the same app stack, but with the dev environment file and dev-specific settings.

## 6) Choose a target interactively

You can also target the same deployment by name:

```bash
pnpm deploy:target -- prod
pnpm deploy:target -- dev
```

and stop it with:

```bash
pnpm down:target -- prod
pnpm down:target -- dev
```

The target helper reads the environment and deploys the matching stack.

## 7) View logs

```bash
pnpm logs:prod
pnpm logs:dev
```

## 8) Seed the database for either target

Always apply migrations before running `seed:fresh`. The seed script assumes the database schema already exists; it does not create missing tables. For the default local/production `.env` target:

```bash
COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
pnpm seed:fresh
```

For the target-specific environments, set the selected target in the shell before running the matching commands:

```bash
DEPLOYED_ENV=development COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
pnpm seed:fresh:dev

DEPLOYED_ENV=production COMPOSE_ENV_FILE=.env pnpm exec drizzle-kit migrate
SEED_ALLOW_PRODUCTION=true pnpm seed:fresh:prod
```

If you see `relation "organization_lifecycle_events" does not exist`, migration `0032_fixed_iceman` has not been applied to the database targeted by `DATABASE_URL`. Do not manually create only that table; apply all pending migrations in order. Verify the migration with:

```bash
psql "$DATABASE_URL" -c 'select tablename from pg_tables where schemaname = '\''public'\'' and tablename = '\''organization_lifecycle_events'\'';'
```

To reset the target database and reseed it fresh:

```bash
pnpm seed:fresh:prod
pnpm seed:fresh:dev
```

Or choose a target interactively:

```bash
pnpm seed:fresh:target -- prod
pnpm seed:fresh:target -- dev
```

The script does the full wipe-and-seed flow, but it will refuse to run against production unless you explicitly set the guard in the environment.

## 9) Backups and database maintenance

Docker does not manage PostgreSQL data, so backups must be configured for the database provider or the VPS host. Do not treat `seed:fresh` as a backup or recovery mechanism; it intentionally deletes application data.

For a one-time logical backup from the VPS:

```bash
mkdir -p /srv/backups/democracyonline
pg_dump --format=custom --file=/srv/backups/democracyonline/prod-$(date -u +%Y%m%dT%H%M%SZ).dump "$DATABASE_URL"
```

Restore into a deliberately chosen database, never directly into production without confirming the target:

```bash
createdb -h 10.0.0.10 -U democracyonline_restore democracyonline_restore
pg_restore --clean --if-exists --no-owner \
  --dbname="postgresql://democracyonline_restore@10.0.0.10:5432/democracyonline_restore" \
  /path/to/backup.dump
```

For host-installed PostgreSQL, store backups on a different disk or machine, retain multiple days of backups, and periodically perform a test restore. A backup that has never been restored is not a verified backup. Managed PostgreSQL users should enable automated backups and point-in-time recovery in the provider dashboard.

Before applying a migration:

1. Take a current backup.
2. Check the migration SQL in `drizzle/`.
3. Apply it to development first.
4. Verify the app and important workflows.
5. Apply the same migration to production.

Drizzle records applied migrations in the database. Do not delete rows from its migration bookkeeping table and do not manually edit an applied migration unless you understand the recovery procedure.

## 10) Scheduler (no system cron required)

Do not use system `crontab` for bill/election advancement. Both environments
run an `election-scheduler` sidecar (see `docker-compose.dev.yml` /
`docker-compose.prod.yml`) that loops every 60 seconds over the Docker network:

```text
POST http://app:3000/api/election-advance  (every tick: due election deadlines)
GET  http://app:3000/api/bill-advance      (every tick: due per-bill stage deadlines)
GET  http://app:3000/api/game-advance      (every tick; self-throttles server-side to game pace)
```

Implementation: [`scripts/scheduler.mjs`](scripts/scheduler.mjs). Auth is
`x-internal-cron-token: $CRON_INTERNAL_TOKEN` and only works when the token
matches the app container. The scheduler exits on boot when
`CRON_INTERNAL_TOKEN` is missing so a misconfigured deploy fails visibly
instead of idling with 401s.

`GAME_ADVANCE_SCHEDULE_UTC` still drives the calendar display. Game-advance
work itself is triggered by the throttled sidecar call above, not by cron.
`BILL_ADVANCE_SCHEDULE_UTC` is legacy: bills use per-row `stage_ends_at`
deadlines reconciled every minute, not a global cron schedule.

View scheduler logs on the VPS:

```bash
docker compose --env-file .env \
  -f docker-compose.yml -f docker-compose.dev.yml \
  logs --follow --timestamps election-scheduler
```

Expected entries look like:

```text
[scheduler] starting target=http://app:3000 intervalMs=60000
[scheduler] 2026-09-23T... /api/election-advance 200 12ms
[scheduler] 2026-09-23T... /api/bill-advance 200 15ms
```

A `200` only means the reconciler completed; it may make no state changes if
no deadline has elapsed. After changing `scripts/scheduler.mjs`, redeploy
(`pnpm deploy:dev` / `pnpm deploy:prod`) because the script is copied into the
runtime image by `Dockerfile`.

Manual checks from the VPS:

```bash
# Scheduler container is running
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml ps

# Force one reconciliation round (same auth the sidecar uses)
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml \
  exec election-scheduler node -e '
fetch("http://app:3000/api/bill-advance", {
  headers: { "x-internal-cron-token": process.env.CRON_INTERNAL_TOKEN }
}).then(async r => { console.log(r.status); console.log(await r.text()) })'
```

Admins can also trigger one round from `/admin` (Manual Advance Triggers)
without SSH. If that returns 401/403, check `ADMIN_EMAILS` and Firebase auth,
not the scheduler token.

## 11) Install and configure Caddy

Caddy will be the public reverse proxy and TLS terminator. The application remains private on the VPS:

- `oscana.nya.je` -> `127.0.0.1:3000` -> production app
- `dev.oscana.nya.je` -> `127.0.0.1:3001` -> development app

The Compose port bindings intentionally listen only on loopback. Do not change them to `0.0.0.0` unless you have a specific reason to expose the application directly.

### Point DNS at the VPS

At your DNS provider, create these records. Replace `YOUR_VPS_IP` with the VPS public IPv4 address:

| Record | Name  | Value         |
| ------ | ----- | ------------- |
| A      | `@`   | `YOUR_VPS_IP` |
| A      | `dev` | `YOUR_VPS_IP` |

If the VPS has a public IPv6 address, add matching AAAA records and make sure IPv6 is configured and allowed in the VPS firewall. Wait for DNS to resolve before asking Caddy for certificates:

```bash
dig +short oscana.nya.je A
dig +short dev.oscana.nya.je A
```

Both commands should return the VPS address. DNS must resolve publicly because the certificate authority needs to reach the server for HTTP-01 or TLS-ALPN validation.

### Install Caddy on Ubuntu 26.04 LTS

Install Caddy from its official package repository:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Verify the installation and service:

```bash
caddy version
sudo systemctl enable --now caddy
sudo systemctl status caddy --no-pager
```

### Create the Caddyfile

Replace the existing Caddyfile with this configuration:

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
{
    email admin@oscana.nya.je
}

oscana.nya.je {
    reverse_proxy 127.0.0.1:3000
}

dev.oscana.nya.je {
    reverse_proxy 127.0.0.1:3001
}
EOF
```

Replace `admin@oscana.nya.je` with an email address you monitor. Caddy uses it for certificate account notifications and renewal problems.

Validate and reload the configuration:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl is-active --quiet caddy && echo "Caddy is running"
```

Caddy automatically obtains and renews certificates from Let's Encrypt or another configured ACME CA. Do not add manual certificate paths unless you have a specific certificate-management requirement.

### Configure firewall access

Caddy needs public HTTP and HTTPS. Keep the application ports private; the loopback bindings above already enforce this, and these deny rules provide an additional firewall boundary:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 3001/tcp
sudo ufw status verbose
```

If you enabled UFW earlier, the allow rules are safe to repeat. If you use another firewall or a VPS provider firewall, allow inbound TCP 80 and 443 there as well. Do not expose port 5432, Docker's socket, or ports 3000/3001 publicly.

### Start and verify both application environments

Start the app containers before testing Caddy:

```bash
cd /srv/democracyonline.io
pnpm deploy:prod
pnpm deploy:dev
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3001
curl -I https://oscana.nya.je
curl -I https://dev.oscana.nya.je
```

If certificate issuance or proxying fails, inspect Caddy logs and the app logs:

```bash
sudo journalctl -u caddy -n 100 --no-pager
pnpm logs:prod
pnpm logs:dev
```

Common causes are DNS still pointing elsewhere, ports 80/443 blocked by the provider firewall, an app container not running, or an incorrect `SITE_URL` in the matching environment file.

## 12) Recommended VPS setup

Run the app as a background service with systemd, then use the Compose commands to update the working deployment whenever you want.

Example systemd service:

```ini
[Unit]
Description=Democracy Online app
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/democracyonline.io
Environment=DEPLOYED_ENV=production
Environment=COMPOSE_ENV_FILE=/srv/democracyonline.io/.env
ExecStart=/usr/bin/docker compose --env-file /srv/democracyonline.io/.env -f /srv/democracyonline.io/docker-compose.yml -f /srv/democracyonline.io/docker-compose.prod.yml up --no-recreate
ExecStop=/usr/bin/docker compose --env-file /srv/democracyonline.io/.env -f /srv/democracyonline.io/docker-compose.yml -f /srv/democracyonline.io/docker-compose.prod.yml down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

You can create a separate service for dev with the dev env file and dev override.

## 13) Typical commands

```bash
# deploy prod
pnpm deploy:prod

# deploy dev
pnpm deploy:dev

# view logs
pnpm logs:prod
pnpm logs:dev

# target-specific seed
pnpm seed:fresh:target -- prod

# stop env
pnpm down:target -- dev
```

This gives you a clean, predictable deploy process for both the public site and the dev playground without mixing the two environments.
