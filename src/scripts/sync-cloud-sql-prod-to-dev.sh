#!/usr/bin/env bash

#===============================================================================
# Cloud SQL Production -> Development Sync Script
#===============================================================================
# This script:
#   1) Exports a backup of the production Cloud SQL database to GCS
#   2) Recreates the development database on Cloud SQL
#   3) Imports the production backup into the development database
#
# Usage: ./sync-cloud-sql-prod-to-dev.sh [OPTIONS]
#
# Options:
#   --dry-run      Show what would happen without making changes
#   --yes          Skip interactive confirmations
#   --keep-backup  Keep the temporary backup file in GCS
#   --help         Show this help message
#
# Notes:
#   - All GCP interactions use gcloud commands.
#   - This operation replaces all data in the target development database.
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration (override with env vars as needed)
#-------------------------------------------------------------------------------
readonly GCP_PROJECT_ID="${GCP_PROJECT_ID:-your-gcp-project-id}"
readonly SOURCE_SQL_INSTANCE="${SOURCE_SQL_INSTANCE:-prod-sql-instance}"
readonly SOURCE_SQL_DATABASE="${SOURCE_SQL_DATABASE:-app_db}"
readonly TARGET_SQL_INSTANCE="${TARGET_SQL_INSTANCE:-dev-sql-instance}"
readonly TARGET_SQL_DATABASE="${TARGET_SQL_DATABASE:-app_db}"
readonly GCS_BUCKET="${GCS_BUCKET:-your-db-backups-bucket}"
readonly GCS_PREFIX="${GCS_PREFIX:-prod-to-dev-sync}"
readonly TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
readonly BACKUP_FILENAME="prod_to_dev_${TIMESTAMP}.sql"
readonly GCS_URI="gs://${GCS_BUCKET}/${GCS_PREFIX}/${BACKUP_FILENAME}"

# Colors
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[1;33m'
readonly BLUE=$'\033[0;34m'
readonly CYAN=$'\033[0;36m'
readonly BOLD=$'\033[1m'
readonly NC=$'\033[0m'

# Flags
DRY_RUN=false
ASSUME_YES=false
KEEP_BACKUP=false

#-------------------------------------------------------------------------------
# Logging
#-------------------------------------------------------------------------------
log_info() {
  printf "%b\n" "${BLUE}[INFO]${NC} ${1}"
}

log_success() {
  printf "%b\n" "${GREEN}[OK]${NC}   ${1}"
}

log_warning() {
  printf "%b\n" "${YELLOW}[WARN]${NC} ${1}"
}

log_error() {
  printf "%b\n" "${RED}[ERR]${NC}  ${1}" >&2
}

log_step() {
  printf "\n%b\n" "${BOLD}${CYAN}==> ${1}${NC}"
}

log_dry_run() {
  printf "%b\n" "${YELLOW}[DRY]${NC}  ${1}"
}

print_separator() {
  printf "%b\n" "${CYAN}-----------------------------------------------------------------${NC}"
}

print_banner() {
  printf "%b\n" "${BOLD}${CYAN}"
  echo "================================================================="
  echo "       Cloud SQL Production -> Development Sync Script"
  echo "================================================================="
  printf "%b\n" "${NC}"
}

#-------------------------------------------------------------------------------
# Help
#-------------------------------------------------------------------------------
show_help() {
  cat <<EOF
${BOLD}Cloud SQL Production -> Development Sync Script${NC}

${BOLD}USAGE:${NC}
  ./sync-cloud-sql-prod-to-dev.sh [OPTIONS]

${BOLD}OPTIONS:${NC}
  --dry-run      Show what would happen without making changes
  --yes          Skip interactive confirmations
  --keep-backup  Keep the temporary SQL backup in GCS
  --help, -h     Show this help message

${BOLD}ENVIRONMENT OVERRIDES:${NC}
  GCP_PROJECT_ID       (default: ${GCP_PROJECT_ID})
  SOURCE_SQL_INSTANCE  (default: ${SOURCE_SQL_INSTANCE})
  SOURCE_SQL_DATABASE  (default: ${SOURCE_SQL_DATABASE})
  TARGET_SQL_INSTANCE  (default: ${TARGET_SQL_INSTANCE})
  TARGET_SQL_DATABASE  (default: ${TARGET_SQL_DATABASE})
  GCS_BUCKET           (default: ${GCS_BUCKET})
  GCS_PREFIX           (default: ${GCS_PREFIX})

${BOLD}DESCRIPTION:${NC}
  This script exports the production DB to GCS, recreates the target dev DB,
  and imports the exported SQL into dev using gcloud commands.

${BOLD}EXAMPLES:${NC}
  ./sync-cloud-sql-prod-to-dev.sh
  GCP_PROJECT_ID=my-project-id SOURCE_SQL_INSTANCE=prod-sql TARGET_SQL_INSTANCE=dev-sql GCS_BUCKET=my-backups ./sync-cloud-sql-prod-to-dev.sh
  ./sync-cloud-sql-prod-to-dev.sh --dry-run
  ./sync-cloud-sql-prod-to-dev.sh --yes --keep-backup
EOF
}

#-------------------------------------------------------------------------------
# Utility
#-------------------------------------------------------------------------------
check_command() {
  local cmd=$1
  local name=${2:-$1}

  if command -v "$cmd" >/dev/null 2>&1; then
    log_success "${name} is installed"
  else
    log_error "${name} is not installed"
    exit 1
  fi
}

is_affirmative_response() {
  local response="${1:-}"
  response="$(printf '%s' "${response}" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
  response="${response#"${response%%[![:space:]]*}"}"
  response="${response%"${response##*[![:space:]]}"}"
  [[ "${response}" == "y" || "${response}" == "yes" ]]
}

confirm_or_exit() {
  local prompt=$1
  if [[ "${ASSUME_YES}" == true ]]; then
    return 0
  fi

  printf "%b" "${YELLOW}${prompt} [y/N] ${NC}"
  read -r response
  if ! is_affirmative_response "${response}"; then
    log_info "Canceled by user."
    exit 0
  fi
}

run_or_dry() {
  local command_display=$1
  shift
  if [[ "${DRY_RUN}" == true ]]; then
    log_dry_run "${command_display}"
  else
    "$@"
  fi
}

verify_prerequisites() {
  log_step "Verifying prerequisites"
  print_separator

  check_command "gcloud" "Google Cloud CLI"

  # Force explicit, non-placeholder configuration in public/shared repos.
  if [[ "${GCP_PROJECT_ID}" == "your-gcp-project-id" || -z "${GCP_PROJECT_ID}" ]]; then
    log_error "Set GCP_PROJECT_ID to a real project ID before running."
    exit 1
  fi
  if [[ "${SOURCE_SQL_INSTANCE}" == "prod-sql-instance" || -z "${SOURCE_SQL_INSTANCE}" ]]; then
    log_error "Set SOURCE_SQL_INSTANCE to your production Cloud SQL instance."
    exit 1
  fi
  if [[ "${TARGET_SQL_INSTANCE}" == "dev-sql-instance" || -z "${TARGET_SQL_INSTANCE}" ]]; then
    log_error "Set TARGET_SQL_INSTANCE to your development Cloud SQL instance."
    exit 1
  fi
  if [[ "${GCS_BUCKET}" == "your-db-backups-bucket" || -z "${GCS_BUCKET}" ]]; then
    log_error "Set GCS_BUCKET to an existing GCS bucket for SQL exports."
    exit 1
  fi

  if ! gcloud auth print-access-token >/dev/null 2>&1; then
    log_error "gcloud is not authenticated. Run: gcloud auth login"
    exit 1
  fi
  log_success "gcloud authentication is valid"

  local active_project
  active_project="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -z "${active_project}" ]]; then
    log_warning "No active gcloud project set in config."
  elif [[ "${active_project}" != "${GCP_PROJECT_ID}" ]]; then
    log_warning "Active gcloud project is '${active_project}', script uses '${GCP_PROJECT_ID}'."
  else
    log_success "gcloud active project matches expected project (${GCP_PROJECT_ID})"
  fi

  if [[ "${SOURCE_SQL_INSTANCE}" == "${TARGET_SQL_INSTANCE}" && "${SOURCE_SQL_DATABASE}" == "${TARGET_SQL_DATABASE}" ]]; then
    log_error "Source and target point to the same instance/database. Refusing to continue."
    exit 1
  fi

  if ! gcloud sql instances describe "${SOURCE_SQL_INSTANCE}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    log_error "Source Cloud SQL instance not found or inaccessible: ${SOURCE_SQL_INSTANCE}"
    exit 1
  fi
  log_success "Source Cloud SQL instance exists: ${SOURCE_SQL_INSTANCE}"

  if ! gcloud sql instances describe "${TARGET_SQL_INSTANCE}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    log_error "Target Cloud SQL instance not found or inaccessible: ${TARGET_SQL_INSTANCE}"
    exit 1
  fi
  log_success "Target Cloud SQL instance exists: ${TARGET_SQL_INSTANCE}"

  if ! gcloud sql databases describe "${SOURCE_SQL_DATABASE}" \
    --instance="${SOURCE_SQL_INSTANCE}" \
    --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    log_error "Source database not found or inaccessible: ${SOURCE_SQL_INSTANCE}/${SOURCE_SQL_DATABASE}"
    exit 1
  fi
  log_success "Source database exists: ${SOURCE_SQL_DATABASE}"

  if ! gcloud storage ls "gs://${GCS_BUCKET}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    log_error "GCS bucket not found or inaccessible: gs://${GCS_BUCKET}"
    exit 1
  fi
  log_success "GCS bucket exists: gs://${GCS_BUCKET}"
}

export_production_database() {
  log_step "Exporting production database to GCS"
  print_separator

  log_info "Source: ${SOURCE_SQL_INSTANCE}/${SOURCE_SQL_DATABASE}"
  log_info "Backup: ${GCS_URI}"

  run_or_dry \
    "gcloud sql export sql ${SOURCE_SQL_INSTANCE} ${GCS_URI} --database=${SOURCE_SQL_DATABASE} --project=${GCP_PROJECT_ID} --quiet" \
    gcloud sql export sql "${SOURCE_SQL_INSTANCE}" "${GCS_URI}" \
      --database="${SOURCE_SQL_DATABASE}" \
      --project="${GCP_PROJECT_ID}" \
      --quiet

  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: production export not executed"
  else
    log_success "Production export completed"
  fi
}

recreate_target_database() {
  log_step "Recreating target development database"
  print_separator

  log_warning "This will REPLACE all data in ${TARGET_SQL_INSTANCE}/${TARGET_SQL_DATABASE}"
  confirm_or_exit "Continue with destructive replace?"

  if [[ "${DRY_RUN}" == true ]]; then
    log_dry_run "gcloud sql databases delete ${TARGET_SQL_DATABASE} --instance=${TARGET_SQL_INSTANCE} --project=${GCP_PROJECT_ID} --quiet"
    log_dry_run "gcloud sql databases create ${TARGET_SQL_DATABASE} --instance=${TARGET_SQL_INSTANCE} --project=${GCP_PROJECT_ID}"
    log_info "Dry-run: target database recreation not executed"
    return 0
  fi

  # Delete DB only if it exists, then create a fresh DB.
  if gcloud sql databases describe "${TARGET_SQL_DATABASE}" \
    --instance="${TARGET_SQL_INSTANCE}" \
    --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    run_or_dry \
      "gcloud sql databases delete ${TARGET_SQL_DATABASE} --instance=${TARGET_SQL_INSTANCE} --project=${GCP_PROJECT_ID} --quiet" \
      gcloud sql databases delete "${TARGET_SQL_DATABASE}" \
        --instance="${TARGET_SQL_INSTANCE}" \
        --project="${GCP_PROJECT_ID}" \
        --quiet
    log_success "Deleted existing target database: ${TARGET_SQL_DATABASE}"
  else
    log_info "Target database does not exist yet. Skipping delete."
  fi

  run_or_dry \
    "gcloud sql databases create ${TARGET_SQL_DATABASE} --instance=${TARGET_SQL_INSTANCE} --project=${GCP_PROJECT_ID}" \
    gcloud sql databases create "${TARGET_SQL_DATABASE}" \
      --instance="${TARGET_SQL_INSTANCE}" \
      --project="${GCP_PROJECT_ID}"

  log_success "Created fresh target database: ${TARGET_SQL_DATABASE}"
}

import_into_target_database() {
  log_step "Importing backup into development database"
  print_separator

  log_info "Target: ${TARGET_SQL_INSTANCE}/${TARGET_SQL_DATABASE}"
  log_info "Source backup: ${GCS_URI}"

  run_or_dry \
    "gcloud sql import sql ${TARGET_SQL_INSTANCE} ${GCS_URI} --database=${TARGET_SQL_DATABASE} --project=${GCP_PROJECT_ID} --quiet" \
    gcloud sql import sql "${TARGET_SQL_INSTANCE}" "${GCS_URI}" \
      --database="${TARGET_SQL_DATABASE}" \
      --project="${GCP_PROJECT_ID}" \
      --quiet

  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: import not executed"
  else
    log_success "Import completed"
  fi
}

cleanup_backup() {
  log_step "Cleanup"
  print_separator

  if [[ "${KEEP_BACKUP}" == true ]]; then
    log_info "Keeping backup in GCS: ${GCS_URI}"
    return 0
  fi

  if [[ "${DRY_RUN}" == true ]]; then
    log_dry_run "gcloud storage rm ${GCS_URI} --project=${GCP_PROJECT_ID}"
    log_info "Dry-run: backup cleanup not executed"
    return 0
  fi

  if [[ "${ASSUME_YES}" == false ]]; then
    printf "%b" "${YELLOW}Delete temporary backup from GCS (${GCS_URI})? [y/N] ${NC}"
    read -r response
    if ! is_affirmative_response "${response}"; then
      log_info "Backup kept in GCS: ${GCS_URI}"
      return 0
    fi
  fi

  run_or_dry \
    "gcloud storage rm ${GCS_URI} --project=${GCP_PROJECT_ID}" \
    gcloud storage rm "${GCS_URI}" --project="${GCP_PROJECT_ID}"
  log_success "Deleted backup from GCS"
}

print_summary() {
  echo ""
  print_separator
  printf "%b\n" "${BOLD}${GREEN}Sync complete${NC}"
  print_separator
  log_info "Project:           ${GCP_PROJECT_ID}"
  log_info "Source:            ${SOURCE_SQL_INSTANCE}/${SOURCE_SQL_DATABASE}"
  log_info "Target:            ${TARGET_SQL_INSTANCE}/${TARGET_SQL_DATABASE}"
  log_info "Backup file (GCS): ${GCS_URI}"
  echo ""
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --yes)
        ASSUME_YES=true
        shift
        ;;
      --keep-backup)
        KEEP_BACKUP=true
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo "Use --help for usage details."
        exit 1
        ;;
    esac
  done

  print_banner
  if [[ "${DRY_RUN}" == true ]]; then
    log_warning "DRY-RUN mode enabled. No changes will be made."
  fi

  verify_prerequisites
  export_production_database
  recreate_target_database
  import_into_target_database
  cleanup_backup
  print_summary
}

main "$@"
