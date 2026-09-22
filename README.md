# democracyonline.io

This app is designed to run as a single background service on a VPS using Docker Compose. Docker runs the app container; PostgreSQL is provisioned and managed separately, with the connection supplied through `DATABASE_URL`.

This project no longer depends on the cloud Terraform / GCP deployment flow for a basic VPS setup. If you are hosting it on a Linux VPS, this is the recommended path.

For complete PostgreSQL provisioning, networking, migrations, backups, and prod/dev database setup, see [deploy.md](deploy.md).

## Requirements

- Ubuntu or Debian VPS
- Docker Engine
- Docker Compose v2
- Node.js 22+ and pnpm (only needed for local scripting and admin commands)
- A PostgreSQL-compatible database URL
- Firebase client/server credentials

## Quick start on a VPS

1. Install Docker and Docker Compose

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

2. Clone the repo and install dependencies

```bash
git clone <your-repo-url>
cdb democracyonline.io
pnpm install
```

3. Copy the example environment file

```bash
cp .env.example .env
```

4. Edit `.env` and fill in your secrets

At minimum, set values for:

- `DATABASE_URL`
- `SITE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Example:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SITE_URL=https://your-domain.example.com
DATABASE_URL=postgresql://democracyonline:yourstrongpassword@your-postgres-host:5432/democracyonline

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

5. Start the app in the background

```bash
pnpm deploy
```

This command does the equivalent of:

```bash
docker compose --env-file .env up -d --build
```

It will build the app and keep it running in the background. It does not create, migrate, seed, or reset the database.

Run database migrations separately after provisioning the database:

```bash
pnpm db:migrate
```

6. Check the service status

```bash
pnpm deploy:logs
```

If you need to view a specific container:

```bash
docker ps
docker compose ps
```

## Redeploying

If you change code or env vars and want to redeploy, just run:

```bash
pnpm deploy
```

This is safe to run repeatedly; Docker Compose will recreate or rebuild the service as needed.

## Taking it offline

To stop and remove the running containers:

```bash
pnpm deploy:down
```

## Production notes

- The app listens on port `3000` internally.
- Compose maps it to the host port `3000` by default.
- If you are behind a reverse proxy (Nginx / Caddy), point the proxy to `http://127.0.0.1:3000`.
- You should run the app with a real domain and TLS termination in front of it.
- The database volume is persisted under Docker named volume storage, so your Postgres data survives restarts.

## Recommended reverse proxy setup

If you want your app to be reachable as a proper website, front it with Nginx or Caddy on the VPS. Example Caddy config:

```caddy
your-domain.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Then run:

```bash
sudo systemctl enable --now caddy
```

## Useful commands

```bash
pnpm deploy
pnpm deploy:restart
pnpm deploy:down
pnpm deploy:logs
```

## Documentation

- [Firebase Authentication](./docs/FIREBASE_AUTH.md)
- [Bot API](./docs/BOT_API.md)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](./LICENSE) file for details.
