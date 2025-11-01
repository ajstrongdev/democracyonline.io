terraform {
  required_version = "~> 1.13"

  backend "gcs" {
    bucket = "fir-test-cee1e-terraform-state"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ============================================
# LOCALS - Configuration and Data
# ============================================

locals {
  # Firebase secrets mapping
  firebase_secrets = {
    api-key             = var.firebase_api_key
    auth-domain         = var.firebase_auth_domain
    project-id          = var.firebase_project_id
    storage-bucket      = var.firebase_storage_bucket
    messaging-sender-id = var.firebase_messaging_sender_id
    app-id              = var.firebase_app_id
    measurement-id      = var.firebase_measurement_id
  }

  # All secret IDs for IAM binding
  all_secret_ids = concat(
    ["${var.app_name}-db-connection-string"],
    ["${var.app_name}-cron-secret"],
    [for key, _ in local.firebase_secrets : "${var.app_name}-firebase-${key}"]
  )

  # API Auth token
  cron_secret = var.cron_secret
}

# ============================================
# API ENABLEMENT
# ============================================

resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "cloudscheduler.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ============================================
# ARTIFACT REGISTRY
# ============================================

resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "${var.app_name}-docker"
  description   = "Docker repository for ${var.app_name}"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# ============================================
# DATABASE
# ============================================

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_database_instance" "postgres" {
  name             = "${var.app_name}-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_HDD"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false
      transaction_log_retention_days = 1
      backup_retention_settings {
        retained_backups = 7
      }
    }

    # Network configuration with SSL enforcement
    # - Public IP enabled for Cloud SQL Proxy connections
    # - SSL/TLS encryption enforced (ENCRYPTED_ONLY mode)
    # - Google-managed server certificates (automatic rotation)
    # - No authorized networks (all access via Cloud SQL Proxy)
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    insights_config {
      query_insights_enabled = false
    }
  }

  deletion_protection = true

  depends_on = [google_project_service.required_apis]
}

resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

# ============================================
# SECRET MANAGER
# ============================================

# Database connection string secret
# Connection uses Cloud SQL Proxy via Unix socket:
# - Connects to /cloudsql/PROJECT:REGION:INSTANCE socket
# - SSL/TLS encryption enforced (Cloud SQL Proxy handles this)
# - Google-managed certificates (no manual cert management needed)
# - IAM authentication supported (using Cloud Run service account)
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "${var.app_name}-db-connection-string"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret      = google_secret_manager_secret.db_connection_string.id
  secret_data = "postgresql://${var.db_user}:${random_password.db_password.result}@localhost:5432/${var.db_name}?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}"
}

# Firebase secrets (using for_each to reduce duplication)
resource "google_secret_manager_secret" "firebase" {
  for_each = local.firebase_secrets

  secret_id = "${var.app_name}-firebase-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase" {
  for_each = local.firebase_secrets

  secret      = google_secret_manager_secret.firebase[each.key].id
  secret_data = each.value
}

# Cron secret for securing API endpoints
resource "google_secret_manager_secret" "cron_secret" {
  secret_id = "${var.app_name}-cron-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "cron_secret" {
  secret      = google_secret_manager_secret.cron_secret.id
  secret_data = var.cron_secret

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ============================================
# CLOUD RUN
# ============================================

resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.app_name}-cloud-run"
  display_name = "Service Account for ${var.app_name} Cloud Run"

  depends_on = [google_project_service.required_apis]
}

# Grant Cloud Run SA access to all secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_secret_access" {
  for_each = toset(local.all_secret_ids)

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"

  depends_on = [
    google_secret_manager_secret.db_connection_string,
    google_secret_manager_secret.firebase,
  ]
}

resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.app_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true
      }

      env {
        name = "CONNECTION_STRING"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection_string.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CRON_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.cron_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }

    # Cloud SQL Proxy connection
    # Automatically handles SSL/TLS encryption and authentication
    # Creates Unix socket at /cloudsql/PROJECT:REGION:INSTANCE
    annotations = {
      "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.postgres.connection_name
    }
  }

  # Ignore changes to the container image since it's managed by CI/CD
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.required_apis,
    google_secret_manager_secret_version.db_connection_string,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ============================================
# CLOUD SCHEDULER
# ============================================

# Service account for Cloud Scheduler
resource "google_service_account" "scheduler_sa" {
  account_id   = "${var.app_name}-scheduler"
  display_name = "Service Account for ${var.app_name} Cloud Scheduler"

  depends_on = [google_project_service.required_apis]
}

# Grant the scheduler service account permission to invoke Cloud Run
resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_sa.email}"
}

# Cloud Scheduler job to hit game-advance endpoint once per day at midnight UTC
resource "google_cloud_scheduler_job" "game_advance" {
  name             = "${var.app_name}-game-advance"
  description      = "Trigger game advancement daily at midnight UTC"
  schedule         = "0 0 * * *"
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "GET"
    uri         = "${google_cloud_run_v2_service.app.uri}/api/game-advance"

    headers = {
      "Authorization" = "Bearer ${var.cron_secret}"
    }

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.app,
  ]
}

# ============================================
# OUTPUTS
# ============================================

output "cloud_run_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repository" {
  description = "The Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "database_instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "database_public_ip" {
  description = "The public IP address of the Cloud SQL instance (accessed via Cloud SQL Proxy)"
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "database_connection_name" {
  description = "The connection name of the Cloud SQL instance (for Cloud SQL Proxy)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "service_account_email" {
  description = "The email of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.email
}

output "scheduler_job_name" {
  description = "The name of the Cloud Scheduler job for game advancement"
  value       = google_cloud_scheduler_job.game_advance.name
}

output "next_steps" {
  description = "Next steps to deploy your application"
  value       = <<-EOT

    ============================================
    Infrastructure deployed successfully! 🎉
    ============================================

    Cloud Run URL: ${google_cloud_run_v2_service.app.uri}

    Next steps:

    1. Build and push your Docker image:

       gcloud auth configure-docker ${var.region}-docker.pkg.dev

       docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/${var.app_name}:latest .

       docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/${var.app_name}:latest

    2. Deploy to Cloud Run:

       gcloud run deploy ${var.app_name} \
         --image ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/${var.app_name}:latest \
         --region ${var.region}

    3. Your database is secured with Cloud SQL Proxy:
       Connection: ${google_sql_database_instance.postgres.connection_name}
       Database: ${var.db_name}
       User: ${var.db_user}

       Connection string is stored in Secret Manager.
       Cloud Run connects via Cloud SQL Proxy (automatic SSL/TLS).
       Public IP: ${google_sql_database_instance.postgres.public_ip_address}
       (Only accessible via Cloud SQL Proxy authentication)

    ============================================
  EOT
}
