# VPS deployment and recovery

## Architecture

One Ubuntu VPS runs:

| Part | Production | Development |
| --- | --- | --- |
| DNS | `oscana.nya.je` | `dev.oscana.nya.je` |
| Checkout | `/srv/democracyonline-prod` | `/srv/democracyonline-dev` |
| Compose project | `democracyonline-production` | `democracyonline-development` |
| Caddy upstream | `127.0.0.1:3000` | `127.0.0.1:3001` |
| Database | Private PostgreSQL container and volume | Separate private PostgreSQL container and volume |

Each project has its own `.env`, app, scheduler, database network, and database volume. Database ports are never published. Docker isolates the two projects; Caddy is the only public HTTP entry point. Both apps still use Firebase Authentication. Create **separate Firebase projects and service accounts** for prod and dev so identities and credentials are isolated too.

The VPS is a single point of failure. A daily systemd timer and every deploy/seed create local backups, but a backup on the same VPS cannot recover a lost VPS. Arrange an offsite copy of `/srv/democracyonline-backups` and the two `.env` files in a secure store. Test a restore periodically.

## 1. Prepare

Use a recent supported Ubuntu LTS VPS with enough memory and disk for two builds and two databases. Set DNS A records for both domains to the VPS IPv4 address. If using AAAA records, point them to a working VPS IPv6 address. Open inbound TCP 22 (or your custom SSH port), 80, and 443 in Hostinger's firewall; keep 3000, 3001, and 5432 closed. The bootstrap also configures UFW.

Keep root SSH access until the deploy user's login and UFW have been tested. Check any existing `/srv/democracyonline-*` directories, PostgreSQL service, Docker volumes, and `/etc/caddy/Caddyfile` before bootstrap. The script refuses an old `.env` or unrelated Caddyfile; it never deletes old databases or volumes.

Clone this branch on the VPS (or copy the checkout there) and run as root:

```bash
git clone --branch chore/vps-reproducible-deploy https://github.com/ajstrongdev/democracyonline.io.git /root/democracyonline-setup
cd /root/democracyonline-setup
INITIAL_BRANCH=chore/vps-reproducible-deploy bash scripts/vps-bootstrap.sh
```

The branch must be pushed before a fresh VPS can clone it. After review/merge, use the final branch name in both places. Override `REPO_URL`, `PROD_DOMAIN`, `DEV_DOMAIN`, or directories via environment variables if needed. Bootstrap installs Docker/Compose, Caddy, Git, UFW, and a `deploy` user; clones two checkouts; creates mode-600 `.env` files with independent random DB passwords and cron tokens; and configures HTTPS routing and firewall. It is safe to rerun with the same settings. Existing clean checkouts without `.env` switch to `INITIAL_BRANCH`; existing checkouts with `.env` keep their branch and secrets. It does not seed or launch the app.

On the currently inspected VPS, both checkouts are clean `develop` checkouts with no `.env`; there are no application containers or Democracy Online databases. Bootstrap can adopt them and switch them to the chosen branch. Host PostgreSQL is installed but contains only default databases; it is unused by this deployment.

The deploy user receives a copy of root's SSH authorized keys if present. Docker group membership lets the deploy user control the host; use a trusted SSH key and restrict that account accordingly. Log in again after bootstrap to pick up group membership. On a host below 6 GiB RAM with no swap, bootstrap creates a 2 GiB `/swapfile`; builds run serially to limit peak memory.

## 2. Fill the environment files

Edit each file as `deploy`:

```bash
sudo -iu deploy
nano /srv/democracyonline-dev/.env
nano /srv/democracyonline-prod/.env
chmod 600 /srv/democracyonline-dev/.env /srv/democracyonline-prod/.env
```

Replace every `CHANGE_ME` value. Keep each generated `DB_PASSWORD`, `DATABASE_URL`, `CRON_INTERNAL_TOKEN`, project name, port, and `SITE_URL` tied to its environment. A PostgreSQL password change requires changing both `DB_PASSWORD` and the password embedded in `DATABASE_URL`; after a database volume exists, rotate the database role password inside PostgreSQL too. Never copy one `.env` over the other.

Firebase values come from the Firebase console as described in [Firebase Authentication](docs/FIREBASE_AUTH.md). Create a production project authorizing only `oscana.nya.je` and a development project authorizing only `dev.oscana.nya.je`; enable email/password sign-in in both. Use each project's service account JSON `project_id`, `client_email`, and JSON-escaped `private_key` in its corresponding `.env`. Put the key on one line, in double quotes, with literal `\n` sequences. `VITE_*` values are browser configuration; the service account private key must stay server-side. Set `ADMIN_EMAILS` to real admin addresses.

Check each configuration:

```bash
cd /srv/democracyonline-dev && bash scripts/vps.sh check
cd /srv/democracyonline-prod && bash scripts/vps.sh check
```

## 3. Deploy development, then production

As `deploy`, from the corresponding checkout:

```bash
cd /srv/democracyonline-dev
bash scripts/vps.sh deploy
bash scripts/vps.sh seed
bash scripts/vps.sh status
curl -I https://dev.oscana.nya.je
```

`deploy` checks configuration, starts its database, makes a timestamped custom-format backup, builds the app and migration image, applies Drizzle migrations, and starts the app and scheduler. `seed` resets game data, so run it only once for an empty environment. It also makes a backup first. Create Firebase users for seeded officeholders if needed; see [Firebase Authentication](docs/FIREBASE_AUTH.md). Verify login, admin, a bill stage, and an election advancement on development.

After development passes, run the production sequence. The production seed requires an explicit flag:

```bash
cd /srv/democracyonline-prod
bash scripts/vps.sh deploy
bash scripts/vps.sh seed --allow-production
bash scripts/vps.sh status
curl -I https://oscana.nya.je
```

If production already has data, **do not seed it**. Migrations are one-way operations; review schema changes and test them on development before updating production.

Check after a reboot: `docker compose --env-file .env ps` in each checkout and both HTTPS URLs. Containers use Docker restart policies; Caddy and Docker are enabled at boot.

## Routine operation

Run as `deploy` from the intended checkout:

```bash
bash scripts/vps.sh update   # fast-forward current branch, backup, migrate, deploy
bash scripts/vps.sh backup   # timestamped pg_dump archive
bash scripts/vps.sh status
bash scripts/vps.sh logs
bash scripts/vps.sh stop     # stops only this environment; preserves its volume
```

`update` refuses dirty or detached checkouts and retains the branch checked out in that environment. Production and development can use different branches. Do not use `docker compose down -v`; that removes the database volume. The deployment script never uses `-v`.

The optional manual **Deploy VPS** GitHub Action calls this same update command. Configure GitHub environments `Dev` and `Prod` (require review for `Prod`) and set `VPS_HOST`, `VPS_USER=deploy`, `VPS_SSH_KEY`, and optional `VPS_SSH_PORT` in each. Use a dedicated deploy SSH key, put its public half in `/home/deploy/.ssh/authorized_keys`, and store its private half only in the GitHub environment secret. The action does not seed or switch branches. Test the SSH key interactively before relying on the workflow.

Backups are written to `/srv/democracyonline-backups/{production,development}` with private permissions. The daily timer runs at 03:30 UTC; inspect it with `systemctl status democracyonline-backup.timer` and `journalctl -u democracyonline-backup.service`. A successful `pg_dump` does not prove recovery: copy backups off the VPS, retain several generations, monitor disk usage, and restore one into a disposable environment. Check archive contents with `docker compose exec -T db pg_restore --list < backup.dump`.

To restore, copy the dump to the VPS, verify its contents, and run the explicit restore command in the **target** checkout:

```bash
cd /srv/democracyonline-dev
bash scripts/vps.sh restore /path/to/backup.dump --confirm-development
```

For production, use the production checkout and `--confirm-production`. Restore takes one more backup, stops the app and scheduler, replaces only this project's database, restores the archive, and starts the app again. If restore fails, the app stays stopped so you can investigate. Test this process on development before relying on it for production. Keep the matching `.env` and Git revision with an offsite backup; bootstrap can recreate infrastructure but cannot recreate lost game data or Firebase credentials.

## Existing VPS / legacy database

The previous `revival` VPS draft used host PostgreSQL, fixed Docker subnets, and systemd units. Bootstrap deliberately refuses its `.env` and does not migrate that database automatically. If an older deployment is found later: record its current schema/version; take a `pg_dump --format=custom` of each database; copy the dumps offsite; stop the old app/scheduler; and restore into the appropriate new Compose database. Do this first on development. The v3 rewrite also changed schema and seed data; a `develop` database is not known to migrate cleanly into it. Preserve the old database and plan data conversion separately if it matters.

After confirming the new deployment works, disable the old systemd units and host PostgreSQL manually. Do not remove old volumes or host databases until a tested restore and cutover are complete. If the Caddyfile already contains other sites, merge the two proxy blocks manually instead of replacing it.

## Troubleshooting

- `bash scripts/vps.sh check` validates required config and Compose syntax without printing secrets.
- `bash scripts/vps.sh status` shows all containers; `bash scripts/vps.sh logs` shows app, database, and scheduler output.
- `docker compose --env-file .env logs election-scheduler` should show successful calls to game, election, and bill advancement endpoints.
- `sudo journalctl -u caddy -n 100` and `sudo caddy validate --config /etc/caddy/Caddyfile` diagnose HTTPS. DNS must point to the VPS and ports 80/443 must be reachable for Caddy certificates.
- Check `sudo ufw status` and Hostinger firewall rules if the site is unreachable. Only Caddy ports and SSH should be public.
- `docker compose --env-file .env exec db pg_isready -U democracyonline -d democracyonline` checks the selected database.

## Reference documentation

- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) and [Compose startup health checks](https://docs.docker.com/compose/how-tos/startup-order/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [PostgreSQL custom-format backup](https://www.postgresql.org/docs/17/app-pgdump.html) and [restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
