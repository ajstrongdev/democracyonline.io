# Service Account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.app_name}-cloud-run"
  display_name = "Service Account for ${var.app_name} Cloud Run"

  depends_on = [google_project_service.required_apis]
}

# Local variable with static secret names
locals {
  secret_ids = toset([
    "${var.app_name}-db-connection-string",
    "${var.app_name}-firebase-api-key",
    "${var.app_name}-firebase-auth-domain",
    "${var.app_name}-firebase-project-id",
    "${var.app_name}-firebase-storage-bucket",
    "${var.app_name}-firebase-messaging-sender-id",
    "${var.app_name}-firebase-app-id",
    "${var.app_name}-firebase-measurement-id",
  ])
}

# Grant Cloud Run SA access to Secret Manager
resource "google_secret_manager_secret_iam_member" "cloud_run_secret_access" {
  for_each = local.secret_ids

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"

  depends_on = [
    google_secret_manager_secret.db_connection_string,
    google_secret_manager_secret.firebase_api_key,
    google_secret_manager_secret.firebase_auth_domain,
    google_secret_manager_secret.firebase_project_id,
    google_secret_manager_secret.firebase_storage_bucket,
    google_secret_manager_secret.firebase_messaging_sender_id,
    google_secret_manager_secret.firebase_app_id,
    google_secret_manager_secret.firebase_measurement_id,
  ]
}

# Grant Cloud Run SA access to Cloud SQL
resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud Run Service
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
      # Initial placeholder image - will be updated via CI/CD
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true # Enable CPU throttling when idle for cost savings
      }

      # Runtime environment variables from Secret Manager
      # Note: NEXT_PUBLIC_ variables are baked into the build, not needed at runtime
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
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_secret_manager_secret_version.db_connection_string,
  ]
}

# Make Cloud Run service publicly accessible
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
