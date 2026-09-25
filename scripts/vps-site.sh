#!/usr/bin/env bash
# Route the production hostname to the app or an explicit offline response.
# Run as root on the VPS.
set -euo pipefail

[[ "$(id -u)" == 0 ]] || { echo "Run as root" >&2; exit 1; }
mode="${1:-}"
[[ "$mode" == offline || "$mode" == unlock || "$mode" == online ]] || {
  echo "Usage: bash scripts/vps-site.sh {offline|unlock|online}" >&2
  exit 2
}
prod_domain="${PROD_DOMAIN:-oscana.nya.je}"
dev_domain="${DEV_DOMAIN:-dev.oscana.nya.je}"
prod_dir="${PROD_DIR:-/srv/democracyonline-prod}"
for domain in "$prod_domain" "$dev_domain"; do
  [[ "$domain" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo "Invalid domain: $domain" >&2; exit 1; }
done

caddyfile=/etc/caddy/Caddyfile
if [[ -f "$caddyfile" ]] && ! grep -Eq '^# Managed by (Democracy Online|Oscana) vps-bootstrap$' "$caddyfile"; then
  echo "Refusing to replace an unmanaged Caddyfile" >&2
  exit 1
fi
install -d -m 755 /etc/democracyonline
lock=/etc/democracyonline/production-offline
if [[ "$mode" == unlock ]]; then
  grep -q 'Production is offline while development continues.' "$caddyfile" || {
    echo "Production must show the offline page before unlocking deployment" >&2; exit 1;
  }
  rm -f "$lock"
  echo "Production deployment unlocked; public site remains offline"
  exit 0
fi
if [[ "$mode" == offline ]]; then
  install -m 644 /dev/null "$lock"
  prod_handler='respond "Production is offline while development continues." 503'
else
  curl -fsS http://127.0.0.1:3000/ >/dev/null || {
    echo "Production app must be healthy before enabling its public site" >&2; exit 1;
  }
  prod_handler='reverse_proxy 127.0.0.1:3000'
fi

pending="$(mktemp /etc/caddy/Caddyfile.pending.XXXXXX)"
trap 'rm -f "$pending"' EXIT
cat > "$pending" <<EOF
# Managed by Oscana vps-bootstrap
$prod_domain {
    $prod_handler
}
$dev_domain {
    reverse_proxy 127.0.0.1:3001
}
EOF
chmod 644 "$pending"
caddy validate --config "$pending" --adapter caddyfile >/dev/null
if [[ -f "$caddyfile" ]]; then cp -a "$caddyfile" /etc/caddy/Caddyfile.previous; fi
mv "$pending" "$caddyfile"
trap - EXIT
systemctl enable --now caddy
systemctl reload caddy
if [[ "$mode" == offline && -f "$prod_dir/.env" && -f "$prod_dir/scripts/vps.sh" ]]; then
  owner="$(stat -c %U "$prod_dir")"
  sudo -u "$owner" bash "$prod_dir/scripts/vps.sh" stop
fi
if [[ "$mode" == online ]]; then rm -f "$lock"; fi
echo "Production site mode: $mode"
