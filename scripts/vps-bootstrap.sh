#!/usr/bin/env bash
# Provision an Ubuntu VPS. Run as root from this repository checkout.
set -euo pipefail
umask 077
export DEBIAN_FRONTEND=noninteractive

[[ $(id -u) == 0 ]] || { echo "Run as root" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="${APP_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/ajstrongdev/democracyonline.io.git}"
INITIAL_BRANCH="${INITIAL_BRANCH:-revival}"
PROD_DOMAIN="${PROD_DOMAIN:-oscana.nya.je}"
DEV_DOMAIN="${DEV_DOMAIN:-dev.oscana.nya.je}"
PROD_DIR="${PROD_DIR:-/srv/democracyonline-prod}"
DEV_DIR="${DEV_DIR:-/srv/democracyonline-dev}"

[[ "$PROD_DOMAIN" != "$DEV_DOMAIN" && "$PROD_DIR" != "$DEV_DIR" ]] || { echo "Production and development must differ" >&2; exit 1; }
for dir in "$PROD_DIR" "$DEV_DIR"; do
  if [[ -f "$dir/.env" ]] && ! grep -q '@db:5432/democracyonline' "$dir/.env"; then
    echo "Legacy .env found at $dir. Migrate its database first; see deploy.md." >&2
    exit 1
  fi
done
if [[ -f /etc/caddy/Caddyfile ]] && ! grep -q 'Managed by Democracy Online vps-bootstrap' /etc/caddy/Caddyfile; then
  echo "Existing Caddyfile is not managed by this script. Back it up and merge it manually." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git gnupg openssl sudo ufw debian-keyring debian-archive-keyring apt-transport-https
if ! command -v caddy >/dev/null 2>&1; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  chmod a+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get remove -y docker.io docker-compose docker-doc containerd runc || true
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# A small swap file gives the image build room on a 4 GiB VPS. Preserve any
# swap already configured by the provider or administrator.
if [[ "$(free -m | awk '$1 == "Mem:" {print $2}')" -lt 6144 && -z "$(swapon --noheadings)" ]]; then
  if [[ -e /swapfile ]]; then
    echo "Existing inactive /swapfile found; configure it manually before building." >&2
  else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  fi
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG docker "$APP_USER"
if [[ -f /root/.ssh/authorized_keys && ! -f "/home/$APP_USER/.ssh/authorized_keys" ]]; then
  install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
  install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
fi

clone_or_keep() {
  local dir="$1"
  if [[ -e "$dir" && ! -d "$dir/.git" ]]; then
    echo "Refusing to overwrite $dir" >&2; exit 1
  fi
  if [[ ! -d "$dir/.git" ]]; then
    install -d -o "$APP_USER" -g "$APP_USER" "$dir"
    sudo -u "$APP_USER" git clone --branch "$INITIAL_BRANCH" "$REPO_URL" "$dir"
  elif [[ ! -f "$dir/.env" ]]; then
    if [[ -n "$(sudo -u "$APP_USER" git -C "$dir" status --porcelain)" ]]; then
      echo "Refusing dirty checkout at $dir" >&2; exit 1
    fi
    sudo -u "$APP_USER" git -C "$dir" fetch --prune origin
    sudo -u "$APP_USER" git -C "$dir" switch "$INITIAL_BRANCH"
    sudo -u "$APP_USER" git -C "$dir" pull --ff-only origin "$INITIAL_BRANCH"
  fi
}
clone_or_keep "$PROD_DIR"
clone_or_keep "$DEV_DIR"

make_env() {
  local dir="$1" mode="$2" port="$3" domain="$4" password token
  if [[ -f "$dir/.env" ]]; then
    echo "Preserving $dir/.env"
    return
  fi
  password="$(openssl rand -hex 32)"
  token="$(openssl rand -hex 32)"
  cat > "$dir/.env" <<EOF
NODE_ENV=production
DEPLOYED_ENV=$mode
COMPOSE_PROJECT_NAME=democracyonline-$mode
APP_PORT=$port
SITE_URL=https://$domain
DB_PASSWORD=$password
DATABASE_URL=postgresql://democracyonline:$password@db:5432/democracyonline
CRON_INTERNAL_TOKEN=$token
ADMIN_EMAILS=CHANGE_ME
FIREBASE_PROJECT_ID=CHANGE_ME
FIREBASE_CLIENT_EMAIL=CHANGE_ME
FIREBASE_PRIVATE_KEY=CHANGE_ME
VITE_FIREBASE_API_KEY=CHANGE_ME
VITE_FIREBASE_AUTH_DOMAIN=CHANGE_ME
VITE_FIREBASE_PROJECT_ID=CHANGE_ME
VITE_FIREBASE_STORAGE_BUCKET=CHANGE_ME
VITE_FIREBASE_MESSAGING_SENDER_ID=CHANGE_ME
VITE_FIREBASE_APP_ID=CHANGE_ME
VITE_FIREBASE_MEASUREMENT_ID=
EOF
  chown "$APP_USER:$APP_USER" "$dir/.env"
  chmod 600 "$dir/.env"
}
make_env "$PROD_DIR" production 3000 "$PROD_DOMAIN"
make_env "$DEV_DIR" development 3001 "$DEV_DOMAIN"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" /srv/democracyonline-backups

cat > /usr/local/sbin/democracyonline-backup <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$PROD_DIR"
bash scripts/vps.sh backup
cd "$DEV_DIR"
bash scripts/vps.sh backup
EOF
chmod 755 /usr/local/sbin/democracyonline-backup
cat > /etc/systemd/system/democracyonline-backup.service <<EOF
[Unit]
Description=Back up both Democracy Online databases
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=$APP_USER
ExecStart=/usr/local/sbin/democracyonline-backup
EOF
cat > /etc/systemd/system/democracyonline-backup.timer <<'EOF'
[Unit]
Description=Daily Democracy Online database backup

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true
Unit=democracyonline-backup.service

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now democracyonline-backup.timer

cat > /etc/caddy/Caddyfile <<EOF
# Managed by Democracy Online vps-bootstrap
$PROD_DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
$DEV_DOMAIN {
    reverse_proxy 127.0.0.1:3001
}
EOF
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

# Preserve the configured SSH port before enabling UFW.
while read -r ssh_port; do ufw allow "$ssh_port/tcp"; done < <(sshd -T | awk '$1 == "port" {print $2}')
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Bootstrap complete. Fill each .env, then deploy development and production separately."
echo "Run: sudo -iu $APP_USER; cd $DEV_DIR; bash scripts/vps.sh deploy"
echo "See $ROOT/deploy.md for seeding, verification, backup, and recovery."
