#!/usr/bin/env bash
# First-time provisioner for the democracyonline.io VPS (Ubuntu 26.04 LTS).
# Run ONCE as root on a fresh machine. Safe to re-run: every step skips
# work that is already done, and existing .env files are never overwritten.
#
# What it does:
#   1. base packages, Docker Engine + Compose plugin, Node.js 22, pnpm
#   2. `deploy` user (docker group), two independent /srv checkouts
#   3. host PostgreSQL with independent prod/dev roles and databases
#   4. per-checkout .env scaffolded from .env.example (database URL, ports,
#      env, site, fresh random cron tokens) — Firebase stays for you to fill in
#   5. Caddy installed with a Caddyfile for both domains
#   6. UFW firewall (SSH/80/443 open; PostgreSQL restricted to app networks)
#   7. systemd units installed + enabled (not started until .env is complete)
#
# Override any of these from the environment:
#   APP_USER=deploy REPO_URL=... INITIAL_BRANCH=revival \
#   PROD_DIR=/srv/democracyonline-prod DEV_DIR=/srv/democracyonline-dev \
#   PROD_DOMAIN=oscana.nya.je DEV_DOMAIN=dev.oscana.nya.je \
#   PROD_PORT=3000 DEV_PORT=3001 TLS_EMAIL=admin@oscana.nya.je \
#   PROD_SUBNET=172.30.0.0/24 DEV_SUBNET=172.31.0.0/24 DB_HOST=10.0.0.10 \
#   sudo bash scripts/vps-bootstrap.sh
set -euo pipefail

APP_USER="${APP_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/ajstrongdev/democracyonline.io.git}"
INITIAL_BRANCH="${INITIAL_BRANCH:-}"
PROD_DIR="${PROD_DIR:-/srv/democracyonline-prod}"
DEV_DIR="${DEV_DIR:-/srv/democracyonline-dev}"
PROD_DOMAIN="${PROD_DOMAIN:-oscana.nya.je}"
DEV_DOMAIN="${DEV_DOMAIN:-dev.oscana.nya.je}"
PROD_PORT="${PROD_PORT:-3000}"
DEV_PORT="${DEV_PORT:-3001}"
PROD_SUBNET="${PROD_SUBNET:-172.30.0.0/24}"
DEV_SUBNET="${DEV_SUBNET:-172.31.0.0/24}"
TLS_EMAIL="${TLS_EMAIL:-admin@oscana.nya.je}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo) on the VPS." >&2
  exit 1
fi

if [ "$PROD_PORT" = "$DEV_PORT" ]; then
  echo "PROD_PORT and DEV_PORT must differ." >&2
  exit 1
fi
if [ "$PROD_SUBNET" = "$DEV_SUBNET" ]; then
  echo "PROD_SUBNET and DEV_SUBNET must differ." >&2
  exit 1
fi

echo "=== 1/7 base packages ==="
apt-get update
apt-get install -y ca-certificates curl dnsutils git gnupg iproute2 jq openssl postgresql postgresql-client postgresql-contrib sudo ufw unzip

DB_HOST="${DB_HOST:-$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([^ ]*\).*/\1/p')}"
if [ -z "$DB_HOST" ]; then
  echo "Could not detect the VPS IPv4 address. Re-run with DB_HOST=<reachable VPS IP>." >&2
  exit 1
fi

echo "=== 2/7 Docker Engine + Compose ==="
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  apt-get remove -y docker.io docker-compose docker-doc containerd runc || true
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version

echo "=== 3/7 Node.js 22 + pnpm ==="
NODE_MAJOR="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "=== 4/7 deploy user + checkouts ==="
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG docker "$APP_USER"

clone_checkout() {
  local dir="$1"
  if [ ! -d "$dir/.git" ]; then
    if [ -e "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then
      echo "Refusing: $dir exists but is not a git checkout." >&2
      exit 1
    fi
    install -d -o "$APP_USER" -g "$APP_USER" "$dir"
    if [ -n "$INITIAL_BRANCH" ]; then
      sudo -u "$APP_USER" git clone --branch "$INITIAL_BRANCH" "$REPO_URL" "$dir"
    else
      sudo -u "$APP_USER" git clone "$REPO_URL" "$dir"
    fi
  else
    echo "-- $dir exists; preserving branch $(sudo -u "$APP_USER" git -C "$dir" branch --show-current)"
    sudo -u "$APP_USER" git -C "$dir" fetch --prune origin
  fi
}
clone_checkout "$PROD_DIR"
clone_checkout "$DEV_DIR"

PNPM_VERSION="$(node -p "require('$PROD_DIR/package.json').packageManager.replace(/^pnpm@/, '').split('+')[0]")"
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
else
  npm install --global "pnpm@${PNPM_VERSION}"
fi
pnpm --version
sudo -u "$APP_USER" bash -c "cd '$PROD_DIR' && pnpm install --frozen-lockfile"
sudo -u "$APP_USER" bash -c "cd '$DEV_DIR' && pnpm install --frozen-lockfile"

echo "=== 5/7 PostgreSQL ==="
systemctl enable --now postgresql

# Keep generated database passwords stable across safe bootstrap reruns. This
# root-only file is a recovery copy; application credentials also live in each
# checkout's mode-600 .env file.
install -d -m 700 /etc/democracyonline
DB_SECRETS_FILE=/etc/democracyonline/database-credentials.env
if [ ! -f "$DB_SECRETS_FILE" ]; then
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname in ('democracyonline_prod', 'democracyonline_dev') limit 1" | grep -q 1; then
    echo "Refusing to replace existing Democracy Online database credentials." >&2
    echo "Database roles exist but $DB_SECRETS_FILE does not." >&2
    echo "Back up the databases and configure DATABASE_URL manually, or remove the old roles/databases only if they are disposable." >&2
    exit 1
  fi
  {
    echo "PROD_DB_PASSWORD=$(openssl rand -hex 32)"
    echo "DEV_DB_PASSWORD=$(openssl rand -hex 32)"
  } > "$DB_SECRETS_FILE"
  chmod 600 "$DB_SECRETS_FILE"
fi
# shellcheck disable=SC1090
source "$DB_SECRETS_FILE"

ensure_database() {
  local role="$1" database="$2" password="$3"
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = '$role'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "set password_encryption = 'scram-sha-256'; alter role $role with login password '$password'" >/dev/null
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "set password_encryption = 'scram-sha-256'; create role $role with login password '$password'" >/dev/null
  fi

  if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname = '$database'" | grep -q 1; then
    sudo -u postgres createdb --owner="$role" "$database"
  fi
  sudo -u postgres psql -v ON_ERROR_STOP=1 --dbname="$database" \
    -c "grant all privileges on schema public to $role" >/dev/null
}
ensure_database "democracyonline_prod" "democracyonline" "$PROD_DB_PASSWORD"
ensure_database "democracyonline_dev" "democracyonline_dev" "$DEV_DB_PASSWORD"

PG_HBA_FILE="$(sudo -u postgres psql -tAc 'show hba_file')"
if [ ! -f /etc/democracyonline/pg_hba.conf.original ]; then
  cp -a "$PG_HBA_FILE" /etc/democracyonline/pg_hba.conf.original
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "alter system set listen_addresses = 'localhost,$DB_HOST'" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "alter system set password_encryption = 'scram-sha-256'" >/dev/null

# Replace only our managed pg_hba block, preserving distribution defaults and
# any administrator-owned rules around it.
sed -i '/^# BEGIN DEMOCRACYONLINE MANAGED$/,/^# END DEMOCRACYONLINE MANAGED$/d' "$PG_HBA_FILE"
cat >> "$PG_HBA_FILE" <<EOF
# BEGIN DEMOCRACYONLINE MANAGED
host    democracyonline       democracyonline_prod    $PROD_SUBNET    scram-sha-256
host    democracyonline_dev   democracyonline_dev     $DEV_SUBNET     scram-sha-256
host    democracyonline       democracyonline_prod    $DB_HOST/32     scram-sha-256
host    democracyonline_dev   democracyonline_dev     $DB_HOST/32     scram-sha-256
# END DEMOCRACYONLINE MANAGED
EOF
systemctl restart postgresql

PGPASSWORD="$PROD_DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --username=democracyonline_prod \
  --dbname=democracyonline \
  --set=ON_ERROR_STOP=1 \
  --command='select 1' >/dev/null
PGPASSWORD="$DEV_DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --username=democracyonline_dev \
  --dbname=democracyonline_dev \
  --set=ON_ERROR_STOP=1 \
  --command='select 1' >/dev/null

PROD_DATABASE_URL="postgresql://democracyonline_prod:$PROD_DB_PASSWORD@$DB_HOST:5432/democracyonline"
DEV_DATABASE_URL="postgresql://democracyonline_dev:$DEV_DB_PASSWORD@$DB_HOST:5432/democracyonline_dev"

# Scaffold .env for one checkout. Never touches an existing file.
setup_env() {
  local dir="$1" deployed_env="$2" app_port="$3" site_url="$4" project_name="$5" subnet="$6" database_url="$7"
  local env_file="$dir/.env"
  if [ -f "$env_file" ]; then
    echo "-- $env_file exists, leaving it alone"
    return
  fi
  echo "-- creating $env_file"
  sudo -u "$APP_USER" cp "$dir/.env.example" "$env_file"
  chmod 600 "$env_file"
  sed -i -E "s|^NODE_ENV=.*|NODE_ENV=\"production\"|" "$env_file"
  sed -i -E "s|^DEPLOYED_ENV=.*|DEPLOYED_ENV=\"$deployed_env\"|" "$env_file"
  sed -i -E "s|^APP_PORT=.*|APP_PORT=\"$app_port\"|" "$env_file"
  sed -i -E "s|^COMPOSE_PROJECT_NAME=.*|COMPOSE_PROJECT_NAME=\"$project_name\"|" "$env_file"
  sed -i -E "s|^DOCKER_SUBNET=.*|DOCKER_SUBNET=\"$subnet\"|" "$env_file"
  sed -i -E "s|^SITE_URL=.*|SITE_URL=\"$site_url\"|" "$env_file"
  sed -i -E "s|^DATABASE_URL=.*|DATABASE_URL=\"$database_url\"|" "$env_file"
  sed -i -E "s|^CRON_INTERNAL_TOKEN=.*|CRON_INTERNAL_TOKEN=\"$(openssl rand -hex 32)\"|" "$env_file"
  sed -i -E "s|^CRON_LOCAL_TOKEN=.*|CRON_LOCAL_TOKEN=\"$(openssl rand -hex 32)\"|" "$env_file"
  chown "$APP_USER:$APP_USER" "$env_file"
}
setup_env "$PROD_DIR" "production" "$PROD_PORT" "https://$PROD_DOMAIN" "democracyonline-prod" "$PROD_SUBNET" "$PROD_DATABASE_URL"
setup_env "$DEV_DIR" "development" "$DEV_PORT" "https://$DEV_DOMAIN" "democracyonline-dev" "$DEV_SUBNET" "$DEV_DATABASE_URL"

echo "=== 6/7 Caddy reverse proxy ==="
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
if [ -f /etc/caddy/Caddyfile ]; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date -u +%Y%m%dT%H%M%SZ)"
fi
cat > /etc/caddy/Caddyfile <<EOF
{
	email $TLS_EMAIL
}

$PROD_DOMAIN {
	reverse_proxy 127.0.0.1:$PROD_PORT
}

$DEV_DOMAIN {
	reverse_proxy 127.0.0.1:$DEV_PORT
}
EOF
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

echo "=== 7/7 firewall + systemd ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny "$PROD_PORT"/tcp
ufw deny "$DEV_PORT"/tcp
ufw allow from "$PROD_SUBNET" to any port 5432 proto tcp
ufw allow from "$DEV_SUBNET" to any port 5432 proto tcp
ufw deny 5432/tcp
ufw --force enable
ufw status verbose

write_systemd_unit() {
  local name="$1" description="$2" dir="$3"
  cat > "/etc/systemd/system/$name.service" <<EOF
[Unit]
Description=$description
After=network-online.target docker.service postgresql.service
Requires=docker.service postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$APP_USER
WorkingDirectory=$dir
ExecStart=/usr/bin/docker compose --env-file $dir/.env up -d --no-recreate
ExecStop=/usr/bin/docker compose --env-file $dir/.env down

[Install]
WantedBy=multi-user.target
EOF
}
write_systemd_unit "democracyonline-prod" "Democracy Online (production)" "$PROD_DIR"
write_systemd_unit "democracyonline-dev" "Democracy Online (development)" "$DEV_DIR"
systemctl daemon-reload
systemctl enable democracyonline-prod.service democracyonline-dev.service

echo ""
echo "Bootstrap complete. Remaining manual steps:"
echo "  1. Point DNS A records for $PROD_DOMAIN and $DEV_DOMAIN at this VPS."
echo "  2. Fill secrets in $PROD_DIR/.env and $DEV_DIR/.env:"
echo "     Firebase admin + VITE_ client values and ADMIN_EMAILS. Database URLs"
echo "     and cron tokens are already generated. DB recovery credentials are in"
echo "     $DB_SECRETS_FILE (root-only)."
echo "  3. Per checkout, migrate then deploy:"
echo "       cd $PROD_DIR && pnpm exec drizzle-kit migrate && pnpm deploy"
echo "       cd $DEV_DIR  && pnpm exec drizzle-kit migrate && pnpm deploy"
echo "  4. Seed dev if needed:  cd $DEV_DIR && pnpm seed:fresh"
echo "     (refuses production unless SEED_ALLOW_PRODUCTION=true is set)"
echo "  5. Check: curl -I https://$PROD_DOMAIN ; curl -I https://$DEV_DOMAIN"
