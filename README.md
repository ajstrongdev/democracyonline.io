# Democracy Online

Democracy Online is a TanStack Start game application with PostgreSQL and Firebase Authentication. This branch (`revival`) is an unfinished rewrite of the `develop` version. See [the rewrite notes](docs/REVIVAL_OVERVIEW.md) for the main product changes and known gaps.

## Local development

Use Node.js 24, pnpm 10.28.2, PostgreSQL, and Firebase credentials. Copy `.env.example` to `.env`, fill it, then run:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

`pnpm seed:fresh` resets game data. Use it only for a new or disposable database. The scheduler can be run locally with `CRON_INTERNAL_TOKEN` set to the local cron token and `APP_BASE_URL=http://localhost:3001`.

## VPS

The supported deployment is one Ubuntu VPS with two independent Docker Compose projects. Each has its own app, scheduler, PostgreSQL container, database volume, secrets, and Git checkout. Host Caddy provides HTTPS for both domains. See [the VPS runbook](deploy.md) for bootstrap, updates, backups, and recovery.

The host needs Docker, Compose, Caddy, and Git. Node and PostgreSQL run only in containers. Firebase Authentication remains an external service. The initial VPS deployment shares one Firebase project by operator choice; use separate Firebase projects when identities and credentials must be isolated too.

## Documentation

- [Revival rewrite overview](docs/REVIVAL_OVERVIEW.md)
- [VPS deployment](deploy.md)
- [Firebase Authentication](docs/FIREBASE_AUTH.md)
- [Bill lifecycle](docs/BILL_HANDOVER.md)
- [Bot API](docs/BOT_API.md)

GNU GPL v3.0; see [LICENSE](LICENSE).
