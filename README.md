# Oscana

Oscana is a TanStack Start game application with PostgreSQL and Firebase Authentication. This branch (`revival`) is an unfinished rewrite of the `develop` version. See [the rewrite notes](docs/REVIVAL_OVERVIEW.md) for the main product changes and known gaps.

## Local development

Use Node.js 24, pnpm 10.28.2, PostgreSQL, and Firebase credentials. Copy `.env.example` to `.env`, fill it, then run:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

`pnpm seed:fresh` resets game data. Use it only for a new or disposable database. The scheduler can be run locally with `CRON_INTERNAL_TOKEN` set to the local cron token and `APP_BASE_URL=http://localhost:3001`.

To test party permissions on a **local development database**, first make sure AJ (`ajstrongdev@pm.me`) belongs to an active party with another active, unappointed member. Run `pnpm db:seed:party-leader`, `pnpm db:seed:chief-whip`, or `pnpm db:seed:social-media-officer` to switch AJ to that post. These commands do not reset the database, but replace the incumbent in the chosen post; moving AJ out of the leadership post assigns an eligible party member as successor. Set `PARTY_TEST_EMAIL` to use another existing party member instead. They refuse non-local database hosts and production mode. The admin panel's **Database Users** tab can create a database-only player with an email and username; no Firebase account or invitation is created. A player needs a matching Firebase login before they can sign in.

## VPS

The supported deployment is one Ubuntu VPS with two independent Docker Compose projects. Each has its own app, scheduler, PostgreSQL container, database volume, secrets, and Git checkout. Development is live; production is intentionally offline. Host Caddy provides HTTPS for development and an explicit production offline response. See [the VPS runbook](deploy.md) for bootstrap, updates, backups, and recovery.

The host needs Docker, Compose, Caddy, and Git. Node and PostgreSQL run only in containers. Firebase Authentication remains an external service. The initial VPS deployment shares one Firebase project by operator choice; use separate Firebase projects when identities and credentials must be isolated too.

## Documentation

- [Revival rewrite overview](docs/REVIVAL_OVERVIEW.md)
- [VPS deployment](deploy.md)
- [Firebase Authentication](docs/FIREBASE_AUTH.md)
- [Bill lifecycle](docs/BILL_HANDOVER.md)
- [Bot API](docs/BOT_API.md)
- [API operations and release checks](docs/API_OPERATIONS.md)

GNU GPL v3.0; see [LICENSE](LICENSE).
