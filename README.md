# democracyonline.io

Democracy Online is a TanStack Start application backed by PostgreSQL and
Firebase Authentication.

## VPS Architecture

The supported VPS deployment runs two independent checkouts on one Ubuntu host:

- Production: `/srv/democracyonline-prod` → `https://oscana.nya.je`
- Development: `/srv/democracyonline-dev` → `https://dev.oscana.nya.je`

Each checkout has its own Git branch, `.env`, Docker Compose project, app,
scheduler sidecar, and PostgreSQL database. PostgreSQL and Caddy run directly on
the host. Docker publishes the applications only on loopback ports 3000 and 3001.

For a completely blank VPS, follow [deploy.md](deploy.md) from top to bottom. It
includes the exact command to download and run the bootstrap script, host
PostgreSQL provisioning, shared Firebase setup, generated credentials,
migrations, first-time seeding, TLS, scheduler verification, and a reboot test.

## Local Development

Requirements:

- Node.js 22+
- pnpm (the pinned version is declared in `package.json`)
- PostgreSQL 15+
- Firebase browser and Admin SDK credentials

Install dependencies and create the local environment file:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Fill `.env`, apply migrations, optionally initialize a disposable database, and
start Vite:

```bash
pnpm db:migrate
pnpm seed:fresh
pnpm dev
```

`seed:fresh` truncates game data. Never run it against data you intend to keep.

Vite does not run the lifecycle heartbeat. For local bill/election advancement,
run this in a second terminal using the value of `CRON_LOCAL_TOKEN` from `.env`:

```bash
CRON_INTERNAL_TOKEN="YOUR_CRON_LOCAL_TOKEN" \
APP_BASE_URL=http://localhost:3001 \
SCHEDULER_INTERVAL_MS=10000 \
node scripts/scheduler.mjs
```

## VPS Commands

Run these inside the production or development checkout you intend to operate:

```bash
pnpm deploy:check     # validate environment, Compose, and database login
pnpm deploy           # build and start app + scheduler
pnpm deploy:restart   # force-recreate both containers
pnpm deploy:ps        # status
pnpm deploy:logs      # follow logs
pnpm deploy:down      # stop this stack
pnpm update           # pull current branch and redeploy
pnpm update:migrate   # pull current branch, migrate, and redeploy
```

## Other Documentation

- [VPS deployment runbook](./deploy.md)
- [Firebase Authentication](./docs/FIREBASE_AUTH.md)
- [Bill lifecycle handover](./docs/BILL_HANDOVER.md)
- [Bot API](./docs/BOT_API.md)

## License

GNU General Public License v3.0. See [LICENSE](./LICENSE).
