#!/usr/bin/env bash
set -e

CONTAINER_NAME="${CONTAINER_NAME:-my-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
IMAGE="${POSTGRES_IMAGE:-docker.io/library/postgres:15}"

# Auto-detect container runtime (podman or docker)
CONTAINER_CMD=""
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    echo "Using Podman as container runtime"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    echo "Using Docker as container runtime"
else
    echo "Error: Neither podman nor docker is installed!"
    exit 1
fi

cleanup() {
    echo -e "\nStopping container..."
    $CONTAINER_CMD stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Check if container already exists
if $CONTAINER_CMD container exists "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo "Reusing existing container: $CONTAINER_NAME"
    $CONTAINER_CMD start "$CONTAINER_NAME" >/dev/null 2>&1
else
    echo "Pulling image $IMAGE..."
    $CONTAINER_CMD pull "$IMAGE"

    echo "Starting new Postgres container..."
    $CONTAINER_CMD run -d \
        --name "$CONTAINER_NAME" \
        --env POSTGRES_USER="$POSTGRES_USER" \
        --env POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        --env POSTGRES_DB="$POSTGRES_DB" \
        -p "$POSTGRES_PORT:5432" \
        "$IMAGE"

    echo "Waiting for Postgres to be ready..."
    until $CONTAINER_CMD exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
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
