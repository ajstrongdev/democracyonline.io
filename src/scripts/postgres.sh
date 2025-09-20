#!/usr/bin/env bash
set -e

CONTAINER_NAME="${CONTAINER_NAME:-my-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
IMAGE="${POSTGRES_IMAGE:-docker.io/library/postgres:15}"

cleanup() {
    echo -e "\nStopping container..."
    podman stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Check if container already exists
if podman container exists "$CONTAINER_NAME"; then
    echo "Reusing existing container: $CONTAINER_NAME"
    podman start -a "$CONTAINER_NAME" &
else
    echo "Pulling image $IMAGE..."
    podman pull "$IMAGE"

    echo "Starting new Postgres container..."
    podman run -d \
        --name "$CONTAINER_NAME" \
        --env POSTGRES_USER="$POSTGRES_USER" \
        --env POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        --env POSTGRES_DB="$POSTGRES_DB" \
        -p "$POSTGRES_PORT:5432" \
        "$IMAGE"

    echo "Waiting for Postgres to be ready..."
    until podman exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
        sleep 1
    done
fi

DB_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "Database is ready!"
echo "Connection URL: $DB_URL"

echo "Press CTRL+C to stop the container..."
while true; do
    sleep 1
done
