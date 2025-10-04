# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "${var.app_name}-docker"
  description   = "Docker repository for ${var.app_name}"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# Generate random password for PostgreSQL
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "${var.app_name}-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"  # Single zone for cost optimization
    disk_size         = 10       # Minimum disk size in GB
    disk_type         = "PD_HDD" # HDD is cheaper than SSD

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false # Disable for cost savings
      transaction_log_retention_days = 1
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = true
      # Public IP for cost optimization (no VPC peering costs)
      # You can add authorized networks here if needed
      authorized_networks {
        name  = "allow-all-temp"
        value = "0.0.0.0/0"
      }
    }

    insights_config {
      query_insights_enabled = false # Disable for cost savings
    }
  }

  deletion_protection = true # Prevent accidental deletion

  depends_on = [google_project_service.required_apis]
}

# Create database
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# Create database user
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}
