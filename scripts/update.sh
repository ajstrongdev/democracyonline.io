#!/usr/bin/env bash
# Pull latest changes and redeploy THIS checkout.
# Run from the checkout directory on the VPS:
#   pnpm update            # pull + install + redeploy
#   pnpm update:migrate    # pull + install + migrate + redeploy
# Each VPS checkout (prod/dev) has its own .env and keeps its currently
# checked-out branch. Switch branches with git before running this command.
set -euo pipefail

# `git pull` can replace this file while it is running. Execute a temporary
# snapshot so the remainder of a deployment always uses one script version.
if [ -z "${UPDATE_SCRIPT_SNAPSHOT:-}" ]; then
  UPDATE_SCRIPT_SNAPSHOT="$(mktemp)"
  cp "$0" "$UPDATE_SCRIPT_SNAPSHOT"
  chmod 700 "$UPDATE_SCRIPT_SNAPSHOT"
  export UPDATE_SCRIPT_SNAPSHOT
  exec bash "$UPDATE_SCRIPT_SNAPSHOT" "$@"
fi
trap 'rm -f "$UPDATE_SCRIPT_SNAPSHOT"' EXIT

MIGRATE=false
if [ "${1:-}" = "--migrate" ]; then
  MIGRATE=true
elif [ -n "${1:-}" ]; then
  echo "Usage: scripts/update.sh [--migrate]" >&2
  exit 1
fi

HERE="$(git rev-parse --show-toplevel)"
cd "$HERE"

if [ ! -f .env ]; then
  echo "Refusing: $HERE/.env does not exist." >&2
  exit 1
fi

if ! BRANCH="$(git symbolic-ref --quiet --short HEAD)"; then
  echo "Refusing: checkout is detached. Check out the branch you want to deploy first." >&2
  exit 1
fi

DEPLOYED_ENV_HINT="$(grep -E '^DEPLOYED_ENV=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"

echo "=== Updating ${HERE} (DEPLOYED_ENV=${DEPLOYED_ENV_HINT:-unknown}, branch=${BRANCH}) ==="

if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing: working tree has uncommitted changes. Commit or stash them first." >&2
  git status --short >&2
  exit 1
fi

git fetch --prune origin
git pull --ff-only origin "$BRANCH"

pnpm install --frozen-lockfile

if [ "$MIGRATE" = true ]; then
  echo "=== Applying migrations ==="
  pnpm exec drizzle-kit migrate
fi

echo "=== Redeploying ==="
docker compose --env-file .env up -d --build --remove-orphans

echo "=== Status ==="
docker compose --env-file .env ps
