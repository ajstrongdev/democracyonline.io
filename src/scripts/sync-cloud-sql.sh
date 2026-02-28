#!/usr/bin/env bash

#===============================================================================
# Cloud SQL to Local Database Sync Script
#===============================================================================
# This script creates a backup of the Cloud SQL database and imports it into
# the local PostgreSQL database running in Docker or Podman.
#
# Usage: ./sync-cloud-sql.sh [OPTIONS]
#
# Options:
#   --dry-run    Show what would be done without executing
#   --help       Show this help message
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - gsutil CLI (comes with gcloud)
#   - Docker or Podman running with PostgreSQL container
#   - .env file with DATABASE_URL
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
readonly GCP_PROJECT_ID="onlinedemocraticrepublic"
readonly CLOUD_SQL_INSTANCE="odr-postgres-production"
readonly CLOUD_SQL_REGION="europe-west2"
readonly CLOUD_SQL_DATABASE="odr_db"
readonly GCS_BUCKET="odrdatabase_backups"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly ENV_FILE="${PROJECT_ROOT}/.env"
readonly BACKUP_DIR="${PROJECT_ROOT}/tmp/backups"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly BACKUP_FILENAME="backup_${TIMESTAMP}.sql"

# Colors for output
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[1;33m'
readonly BLUE=$'\033[0;34m'
readonly CYAN=$'\033[0;36m'
readonly NC=$'\033[0m' # No Color
readonly BOLD=$'\033[1m'

# Flags
DRY_RUN=false
# Optional container runtime override via environment variable (docker|podman)
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-}"

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------
log_info() {
    printf "%b\n" "${BLUE}ℹ${NC}  ${1}"
}

log_success() {
    printf "%b\n" "${GREEN}✔${NC}  ${1}"
}

log_warning() {
    printf "%b\n" "${YELLOW}⚠${NC}  ${1}"
}

log_error() {
    printf "%b\n" "${RED}✖${NC}  ${1}" >&2
}

log_step() {
    printf "\n%b\n" "${BOLD}${CYAN}▶ ${1}${NC}"
}

log_dry_run() {
    printf "%b\n" "${YELLOW}[DRY-RUN]${NC} ${1}"
}

print_banner() {
    printf "%b\n" "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           Cloud SQL → Local Database Sync Script              ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    printf "%b\n" "${NC}"
}

print_separator() {
    printf "%b\n" "${CYAN}───────────────────────────────────────────────────────────────${NC}"
}

#-------------------------------------------------------------------------------
# Help Function
#-------------------------------------------------------------------------------
show_help() {
    cat << EOF
${BOLD}Cloud SQL to Local Database Sync Script${NC}

${BOLD}USAGE:${NC}
    ./sync-cloud-sql.sh [OPTIONS]

${BOLD}OPTIONS:${NC}
    --dry-run    Show what would be done without executing any changes
    --help       Show this help message and exit

${BOLD}DESCRIPTION:${NC}
    This script performs the following operations:
    1. Creates an on-demand backup of the Cloud SQL database
    2. Exports the backup to a Google Cloud Storage bucket
    3. Downloads the backup file locally
    4. Imports the backup into the local PostgreSQL database (Docker/Podman)

${BOLD}CONFIGURATION:${NC}
    GCP Project:      ${GCP_PROJECT_ID}
    Cloud SQL:        ${CLOUD_SQL_INSTANCE}
    Cloud SQL DB:     ${CLOUD_SQL_DATABASE}
    Region:           ${CLOUD_SQL_REGION}
    Storage Bucket:   ${GCS_BUCKET}

${BOLD}PREREQUISITES:${NC}
    • gcloud CLI installed and authenticated
    • gsutil CLI (included with gcloud SDK)
    • Docker or Podman running with PostgreSQL container
    • .env file with DATABASE_URL variable

${BOLD}OPTIONAL ENVIRONMENT VARIABLES:${NC}
    CONTAINER_RUNTIME=docker|podman    Force a specific container runtime

${BOLD}EXAMPLES:${NC}
    ./sync-cloud-sql.sh              # Run the sync
    ./sync-cloud-sql.sh --dry-run    # Preview without making changes
    ./sync-cloud-sql.sh --help       # Show this help

EOF
}

#-------------------------------------------------------------------------------
# Utility Functions
#-------------------------------------------------------------------------------
check_command() {
    local cmd=$1
    local name=${2:-$1}

    if command -v "$cmd" &> /dev/null; then
        log_success "${name} is installed"
        return 0
    else
        log_error "${name} is not installed"
        return 1
    fi
}

parse_database_url() {
    local url=$1

    # Parse PostgreSQL connection string
    # Format: postgresql://user:password@host:port/database
    if [[ $url =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        # Remove any query parameters from database name
        DB_NAME="${DB_NAME%%\?*}"
        return 0
    # Alternative format: postgres://user:password@host:port/database
    elif [[ $url =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        DB_NAME="${DB_NAME%%\?*}"
        return 0
    else
        return 1
    fi
}

detect_container_runtime() {
    # Allow explicit override via CONTAINER_RUNTIME env var
    if [[ -n "${CONTAINER_RUNTIME}" ]]; then
        CONTAINER_RUNTIME="$(printf "%s" "${CONTAINER_RUNTIME}" | tr '[:upper:]' '[:lower:]')"
        case "${CONTAINER_RUNTIME}" in
            docker|podman)
                if ! command -v "${CONTAINER_RUNTIME}" &> /dev/null; then
                    log_error "CONTAINER_RUNTIME=${CONTAINER_RUNTIME} is set, but the command is not installed"
                    return 1
                fi
                if ! "${CONTAINER_RUNTIME}" info &> /dev/null; then
                    log_error "${CONTAINER_RUNTIME} is installed but not available. Start it and try again."
                    return 1
                fi
                log_success "Using container runtime from CONTAINER_RUNTIME=${CONTAINER_RUNTIME}"
                return 0
                ;;
            *)
                log_error "Invalid CONTAINER_RUNTIME=${CONTAINER_RUNTIME}. Use 'docker' or 'podman'."
                return 1
                ;;
        esac
    fi

    # Auto-detect runtime: prefer Docker first, then Podman
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        log_success "Using container runtime: Docker"
        return 0
    fi

    if command -v podman &> /dev/null && podman info &> /dev/null; then
        CONTAINER_RUNTIME="podman"
        log_success "Using container runtime: Podman"
        return 0
    fi

    if command -v docker &> /dev/null; then
        log_warning "Docker is installed but not available"
    fi
    if command -v podman &> /dev/null; then
        log_warning "Podman is installed but not available"
    fi

    log_error "No available container runtime found. Install/start Docker or Podman."
    return 1
}

get_postgres_container_id() {
    local runtime=$1

    # Find the PostgreSQL container - try common naming patterns
    local container_id

    # Try to find by image name
    container_id=$("${runtime}" ps --filter "ancestor=postgres" --format "{{.ID}}" 2>/dev/null | head -n 1 || true)

    if [[ -z "$container_id" ]]; then
        # Try to find by name pattern
        container_id=$("${runtime}" ps --filter "name=postgres" --format "{{.ID}}" 2>/dev/null | head -n 1 || true)
    fi

    if [[ -z "$container_id" ]]; then
        # Try to find by exposed port
        container_id=$("${runtime}" ps --filter "publish=${DB_PORT}" --format "{{.ID}}" 2>/dev/null | head -n 1 || true)
    fi

    echo "$container_id"
}

cleanup() {
    local exit_code=$?
    if [[ -f "${BACKUP_DIR}/${BACKUP_FILENAME}" ]] && [[ $exit_code -ne 0 ]]; then
        log_warning "Cleaning up temporary files..."
        rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>/dev/null || true
    fi
}

trap cleanup EXIT

#-------------------------------------------------------------------------------
# Main Functions
#-------------------------------------------------------------------------------
verify_prerequisites() {
    log_step "Verifying Prerequisites"
    print_separator

    local missing_tools=0

    # Check required tools
    check_command "gcloud" "Google Cloud CLI" || ((missing_tools++))
    check_command "gsutil" "gsutil" || ((missing_tools++))
    check_command "psql" "PostgreSQL CLI (psql)" || ((missing_tools++))

    # At least one supported container runtime must be installed
    if command -v docker &> /dev/null || command -v podman &> /dev/null; then
        log_success "Container runtime installed (Docker or Podman)"
    else
        log_error "Neither Docker nor Podman is installed"
        ((missing_tools++))
    fi

    if [[ $missing_tools -gt 0 ]]; then
        echo ""
        log_error "Missing ${missing_tools} required tool(s). Please install them and try again."
        exit 1
    fi

    # Detect container runtime availability
    if ! detect_container_runtime; then
        exit 1
    fi

    # Check gcloud authentication
    if ! gcloud auth print-identity-token &> /dev/null; then
        log_error "Not authenticated with gcloud. Run 'gcloud auth login' first."
        exit 1
    fi
    log_success "gcloud is authenticated"

    # Check .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env file not found at: ${ENV_FILE}"
        exit 1
    fi
    log_success ".env file found"

    # Load DATABASE_URL from .env
    if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
        DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
        log_success "DATABASE_URL found in .env"
    else
        log_error "DATABASE_URL not found in .env file"
        exit 1
    fi

    # Parse the DATABASE_URL
    if ! parse_database_url "$DATABASE_URL"; then
        log_error "Failed to parse DATABASE_URL. Expected format: postgresql://user:password@host:port/database"
        exit 1
    fi
    log_success "DATABASE_URL parsed successfully"

    # Display parsed connection info (hide password)
    log_info "  Host: ${DB_HOST}"
    log_info "  Port: ${DB_PORT}"
    log_info "  Database: ${DB_NAME}"
    log_info "  User: ${DB_USER}"

    # Check PostgreSQL container is running
    local container_id
    container_id=$(get_postgres_container_id "${CONTAINER_RUNTIME}")
    if [[ -z "$container_id" ]]; then
        log_error "No PostgreSQL container found running in ${CONTAINER_RUNTIME}"
        log_info "Make sure your PostgreSQL container is running"
        exit 1
    fi
    log_success "PostgreSQL container found (${CONTAINER_RUNTIME}): ${container_id:0:12}"

    echo ""
    log_success "All prerequisites verified!"
}

create_backup_directory() {
    log_step "Preparing Local Environment"
    print_separator

    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would create backup directory: ${BACKUP_DIR}"
        return 0
    fi

    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_success "Created backup directory: ${BACKUP_DIR}"
    else
        log_info "Backup directory already exists: ${BACKUP_DIR}"
    fi
}

export_cloud_sql_backup() {
    log_step "Exporting Cloud SQL Database"
    print_separator

    local gcs_uri="gs://${GCS_BUCKET}/${BACKUP_FILENAME}"

    log_info "Source: ${CLOUD_SQL_INSTANCE}/${CLOUD_SQL_DATABASE} (${CLOUD_SQL_REGION})"
    log_info "Destination: ${gcs_uri}"

    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would export database to: ${gcs_uri}"
        log_dry_run "Command: gcloud sql export sql ${CLOUD_SQL_INSTANCE} ${gcs_uri} --database=${CLOUD_SQL_DATABASE} --project=${GCP_PROJECT_ID}"
        return 0
    fi

    log_info "Starting export... This may take a few minutes."

    # Export the database to GCS
    if gcloud sql export sql "${CLOUD_SQL_INSTANCE}" "${gcs_uri}" \
        --database="${CLOUD_SQL_DATABASE}" \
        --project="${GCP_PROJECT_ID}" \
        --quiet; then
        log_success "Database exported successfully to ${gcs_uri}"
    else
        log_error "Failed to export database"
        exit 1
    fi
}

download_backup() {
    log_step "Downloading Backup from Cloud Storage"
    print_separator

    local gcs_uri="gs://${GCS_BUCKET}/${BACKUP_FILENAME}"
    local local_path="${BACKUP_DIR}/${BACKUP_FILENAME}"

    log_info "Source: ${gcs_uri}"
    log_info "Destination: ${local_path}"

    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would download backup to: ${local_path}"
        log_dry_run "Command: gsutil cp ${gcs_uri} ${local_path}"
        return 0
    fi

    log_info "Downloading backup file..."

    if gsutil cp "${gcs_uri}" "${local_path}"; then
        local file_size=$(ls -lh "${local_path}" | awk '{print $5}')
        log_success "Backup downloaded successfully (${file_size})"
    else
        log_error "Failed to download backup"
        exit 1
    fi
}

import_to_local_database() {
    log_step "Importing Backup to Local Database"
    print_separator

    local local_path="${BACKUP_DIR}/${BACKUP_FILENAME}"

    log_info "Target database: ${DB_NAME}"
    log_info "Target host: ${DB_HOST}:${DB_PORT}"

    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would drop and recreate database: ${DB_NAME}"
        log_dry_run "Would import backup from: ${local_path}"
        return 0
    fi

    # Verify backup file exists
    if [[ ! -f "$local_path" ]]; then
        log_error "Backup file not found: ${local_path}"
        exit 1
    fi

    log_warning "This will replace all data in the local database!"
    printf "%b" "${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
    read -r

    log_info "Terminating existing connections to database..."

    # Use template1 for admin operations (can't drop a DB while connected to it)
    local admin_db="template1"

    # Terminate existing connections to the database
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${admin_db}" \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
        &> /dev/null || true

    log_info "Dropping existing database..."

    # Drop the existing database
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${admin_db}" \
        -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" || {
            log_error "Failed to drop database"
            exit 1
        }

    log_info "Creating fresh database..."

    # Create a fresh database
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${admin_db}" \
        -c "CREATE DATABASE \"${DB_NAME}\";" || {
            log_error "Failed to create database"
            exit 1
        }

    log_info "Importing backup... This may take a while."

    # Import the backup
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -f "${local_path}" \
        --quiet 2>&1 | grep -v "^SET$\|^COMMENT$" || true

    log_success "Backup imported successfully!"
}

cleanup_remote_backup() {
    log_step "Cleanup"
    print_separator

    local gcs_uri="gs://${GCS_BUCKET}/${BACKUP_FILENAME}"

    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would optionally delete remote backup: ${gcs_uri}"
        log_dry_run "Would optionally delete local backup: ${BACKUP_DIR}/${BACKUP_FILENAME}"
        return 0
    fi

    printf "%b" "${YELLOW}Do you want to delete the remote backup from GCS? [y/N]${NC} "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        if gsutil rm "${gcs_uri}" 2>/dev/null; then
            log_success "Remote backup deleted"
        else
            log_warning "Could not delete remote backup"
        fi
    else
        log_info "Remote backup kept at: ${gcs_uri}"
    fi

    printf "%b" "${YELLOW}Do you want to delete the local backup? [y/N]${NC} "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}"
        log_success "Local backup deleted"
    else
        log_info "Local backup kept at: ${BACKUP_DIR}/${BACKUP_FILENAME}"
    fi
}

print_summary() {
    echo ""
    print_separator
    printf "%b\n" "${BOLD}${GREEN}✔ Database sync completed successfully!${NC}"
    print_separator
    echo ""
    log_info "Summary:"
    log_info "  • Cloud SQL database: ${CLOUD_SQL_INSTANCE}/${CLOUD_SQL_DATABASE}"
    log_info "  • Local database: ${DB_NAME}"
    log_info "  • Backup file: ${BACKUP_FILENAME}"
    echo ""
}

#-------------------------------------------------------------------------------
# Main Execution
#-------------------------------------------------------------------------------
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    print_banner

    if [[ "$DRY_RUN" == true ]]; then
        printf "%b\n" "${YELLOW}${BOLD}🔍 DRY RUN MODE - No changes will be made${NC}"
        echo ""
    fi

    # Run all steps
    verify_prerequisites
    create_backup_directory
    export_cloud_sql_backup
    download_backup
    import_to_local_database
    cleanup_remote_backup
    print_summary
}

# Run main function
main "$@"
