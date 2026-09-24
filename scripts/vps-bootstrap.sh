#!/usr/bin/env bash
# First-time provisioner for the democracyonline.io VPS (Ubuntu 26.04 LTS).
# Run ONCE as root on a fresh machine. Safe to re-run: every step skips
# work that is already done, and existing .env files are never overwritten.
#
# What it does:
#   1. base packages, Docker Engine + Compose plugin, Node.js 22, pnpm
#   2. `deploy` user (docker group), two independent /srv checkouts
#   3. per-checkout .env scaffolded from .env.example (ports, env, site,
#      fresh random cron tokens) — secrets stay for you to fill in
#   4. Caddy installed with a Caddyfile for both domains
#   5. UFW firewall (SSH/80/443 open; app ports closed)
#   6. systemd units installed + enabled (not started until .env is complete)
#
# Override any of these from the environment:
#   APP_USER=deploy REPO_URL=... \
#   PROD_DIR=/srv/democracyonline-prod DEV_DIR=/srv/democracyonline-dev \
#   PROD_DOMAIN=oscana.nya.je DEV_DOMAIN=dev.oscana.nya.je \
#   PROD_PORT=3000 DEV_PORT=3001 TLS_EMAIL=admin@oscana.nya.je \
#   sudo bash scripts/vps-bootstrap.sh
set -euo pipefail

APP_USER="${APP_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/ajstrongdev/democracyonline.io.git}"
PROD_DIR="${PROD_DIR:-/srv/democracyonline-prod}"
DEV_DIR="${DEV_DIR:-/srv/democracyonline-dev}"
PROD_DOMAIN="${PROD_DOMAIN:-oscana.nya.je}"
DEV_DOMAIN="${DEV_DOMAIN:-dev.oscana.nya.je}"
PROD_PORT="${PROD_PORT:-3000}"
DEV_PORT="${DEV_PORT:-3001}"
TLS_EMAIL="${TLS_EMAIL:-admin@oscana.nya.je}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo) on the VPS." >&2
  exit 1
fi

echo "=== 1/6 base packages ==="
apt-get update
apt-get install -y ca-certificates curl dnsutils git gnupg jq openssl postgresql-client sudo ufw unzip

echo "=== 2/6 Docker Engine + Compose ==="
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

echo "=== 3/6 Node.js 22 + pnpm ==="
NODE_MAJOR="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "=== 4/6 deploy user + checkouts ==="
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
    sudo -u "$APP_USER" git clone "$REPO_URL" "$dir"
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

# Scaffold .env for one checkout. Never touches an existing file.
setup_env() {
  local dir="$1" deployed_env="$2" app_port="$3" site_url="$4" project_name="$5"
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
  sed -i -E "s|^SITE_URL=.*|SITE_URL=\"$site_url\"|" "$env_file"
  sed -i -E "s|^CRON_INTERNAL_TOKEN=.*|CRON_INTERNAL_TOKEN=\"$(openssl rand -hex 32)\"|" "$env_file"
  sed -i -E "s|^CRON_LOCAL_TOKEN=.*|CRON_LOCAL_TOKEN=\"$(openssl rand -hex 32)\"|" "$env_file"
  chown "$APP_USER:$APP_USER" "$env_file"
}
setup_env "$PROD_DIR" "production" "$PROD_PORT" "https://$PROD_DOMAIN" "democracyonline-prod"
setup_env "$DEV_DIR" "development" "$DEV_PORT" "https://$DEV_DOMAIN" "democracyonline-dev"

echo "=== 5/6 Caddy reverse proxy ==="
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

echo "=== 6/6 firewall + systemd ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny "$PROD_PORT"/tcp
ufw deny "$DEV_PORT"/tcp
ufw --force enable
ufw status verbose

write_systemd_unit() {
  local name="$1" description="$2" dir="$3"
  cat > "/etc/systemd/system/$name.service" <<EOF
[Unit]
Description=$description
After=network-online.target docker.service
Requires=docker.service
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
echo "     DATABASE_URL (separate database per checkout), Firebase admin +"
echo "     VITE_ client values, ADMIN_EMAILS. Cron tokens are already random."
echo "  3. Per checkout, migrate then deploy:"
echo "       cd $PROD_DIR && pnpm exec drizzle-kit migrate && pnpm deploy"
echo "       cd $DEV_DIR  && pnpm exec drizzle-kit migrate && pnpm deploy"
echo "  4. Seed dev if needed:  cd $DEV_DIR && pnpm seed:fresh"
echo "     (refuses production unless SEED_ALLOW_PRODUCTION=true is set)"
echo "  5. Check: curl -I https://$PROD_DOMAIN ; curl -I https://$DEV_DOMAIN"
