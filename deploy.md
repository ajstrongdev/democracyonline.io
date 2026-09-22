# VPS deployment guide

This project supports two live environments from the same repository:

- Production: root domain, for example `https://oscana.nya.je`
- Development: subdomain, for example `https://dev.oscana.nya.je`

Each environment gets its own `.env` file and its own Compose override so you can deploy either target independently. PostgreSQL is external to Docker; provision one database for each environment and put its reachable connection string in `DATABASE_URL`.

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
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml run --rm app node -e "const net = require('node:net'); const url = new URL(process.env.DATABASE_URL); const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 5432) }, () => { console.log('database host reachable'); socket.end(); }); socket.on('error', (error) => { console.error(error.message); process.exit(1); });"
```

This only tests TCP reachability. The migration command below tests authentication and database permissions as well.

## 2) Create environment files

Create the files in the project root:

```bash
cp .env.example .env.prod
cp .env.example .env.dev
```

Then fill them in with the correct values for each environment.

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
CRON_LOCAL_TOKEN=local-dev-token
DEPLOYED_ENV=development
```

## 3) Set the dev heartbeat schedule

For the dev instance, set your environment variables to a much faster heartbeat:

```env
BILL_ADVANCE_SCHEDULE_UTC="*/5 * * * *"
GAME_ADVANCE_SCHEDULE_UTC="*/20 * * * *"
```

This makes the game move much faster than production while preserving the same cron endpoints.

Production can keep the normal values:

```env
BILL_ADVANCE_SCHEDULE_UTC="0 4,12,20 * * *"
GAME_ADVANCE_SCHEDULE_UTC="0 20 * * *"
```

## 4) Apply migrations and deploy production

```bash
pnpm deploy:prod
```

This starts the app with the prod environment file and the production override.

Before the first deploy, apply the schema from a machine that can reach the production database:

```bash
node --env-file=.env.prod ./node_modules/.bin/drizzle-kit migrate
```

Docker does not provision, migrate, seed, or reset PostgreSQL.

For development, use `.env.dev` instead:

```bash
node --env-file=.env.dev ./node_modules/.bin/drizzle-kit migrate
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

## 10) Cron jobs

The app exposes the job endpoints for advancing the game:

- `/api/bill-advance`
- `/api/game-advance`

These should be hit by a cron job or external scheduler using the configured token:

```bash
curl -X POST "https://democracyonline.io/api/game-advance" \
  -H "Authorization: Bearer $CRON_SCHEDULER_TOKEN"
```

For dev:

```bash
curl -X POST "https://dev.oscana.nya.je/api/game-advance" \
  -H "Authorization: Bearer $CRON_SCHEDULER_TOKEN"
```

You can schedule these with `crontab`, a hosted cron service, or your Linux VPS cron.

## 11) Recommended VPS setup

Run the app as a background service with systemd, then use the Compose commands to update the working deployment whenever you want.

Example systemd service:

```ini
[Unit]
Description=Democracy Online app
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/democracyonline.io
ExecStart=/usr/bin/docker compose --env-file /srv/democracyonline.io/.env.prod -f /srv/democracyonline.io/docker-compose.yml -f /srv/democracyonline.io/docker-compose.prod.yml up --no-recreate
ExecStop=/usr/bin/docker compose --env-file /srv/democracyonline.io/.env.prod -f /srv/democracyonline.io/docker-compose.yml -f /srv/democracyonline.io/docker-compose.prod.yml down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

You can create a separate service for dev with the dev env file and dev override.

## 12) Typical commands

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
