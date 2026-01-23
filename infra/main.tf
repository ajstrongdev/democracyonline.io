terraform {
  required_version = "~> 1.14"

  backend "gcs" {
    bucket = "odr-terraform-state"
    prefix = "prod"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.12.0"
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

  # Firebase Admin SDK secrets mapping
  firebase_admin_secrets = {
    admin-project-id   = var.firebase_admin_project_id
    admin-client-email = var.firebase_admin_client_email
    admin-private-key  = var.firebase_admin_private_key
  }

  # All secret IDs for IAM binding
  all_secret_ids = concat(
    ["${var.app_name}-db-connection-string"],
    [for key, _ in local.firebase_secrets : "${var.app_name}-firebase-${key}"],
    [for key, _ in local.firebase_admin_secrets : "${var.app_name}-firebase-${key}"]
  )
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
    "certificatemanager.googleapis.com",
    "cloudtrace.googleapis.com",
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
  length           = 32
  special          = true
  override_special = "._~-" # Only URL-safe special characters for connection strings
}

resource "google_sql_database_instance" "postgres" {
  name                = "${var.app_name}-postgres-${var.environment}"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false

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

# Firebase Admin SDK secrets
resource "google_secret_manager_secret" "firebase_admin" {
  for_each = local.firebase_admin_secrets

  secret_id = "${var.app_name}-firebase-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_admin" {
  for_each = local.firebase_admin_secrets

  secret      = google_secret_manager_secret.firebase_admin[each.key].id
  secret_data = each.value
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
    google_secret_manager_secret.firebase_admin,
  ]
}

resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name                 = var.app_name
  location             = var.region
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  default_uri_disabled = true
  deletion_protection  = false

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
        name = "FIREBASE_PROJECT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_admin["admin-project-id"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "FIREBASE_CLIENT_EMAIL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_admin["admin-client-email"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "FIREBASE_PRIVATE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_admin["admin-private-key"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "ADMIN_EMAILS"
        value = var.admin_emails
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "SERVER_URL"
        value = "https://${var.custom_domain}"
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

# Allow public access to Cloud Run service (required for load balancer)
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

# Cloud Scheduler job to hit game-advance endpoint once per day at 8pm UTC
resource "google_cloud_scheduler_job" "game_advance" {
  name             = "${var.app_name}-game-advance"
  description      = "Trigger game advancement daily at 8pm UTC"
  schedule         = "0 20 * * *"
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "GET"
    uri         = "https://${var.custom_domain}/api/game-advance"

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
      audience              = "https://${var.custom_domain}"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.app,
  ]
}

# bill-advance runs 4am/12pm/8pm UTC daily.
resource "google_cloud_scheduler_job" "bill_advance" {
  name             = "${var.app_name}-bill-advance"
  description      = "Trigger bill advancement at 4am, 12pm, and 8pm UTC"
  schedule         = "0 4,12,20 * * *"
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "GET"
    uri         = "https://${var.custom_domain}/api/bill-advance"

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
      audience              = "https://${var.custom_domain}"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.app,
  ]
}


# ============================================
# LOAD BALANCER & CUSTOM DOMAIN
# ============================================

# Reserve a static IP address for the load balancer
resource "google_compute_global_address" "default" {
  name = "${var.app_name}-lb-ip"

  depends_on = [google_project_service.required_apis]
}

# Create a Network Endpoint Group (NEG) for Cloud Run
resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  name                  = "${var.app_name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.app.name
  }

  depends_on = [google_project_service.required_apis]
}

# Backend service for the load balancer
resource "google_compute_backend_service" "default" {
  name                  = "${var.app_name}-backend-v2"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [google_project_service.required_apis]
}

# URL map for routing
resource "google_compute_url_map" "default" {
  name            = "${var.app_name}-url-map-v2"
  default_service = google_compute_backend_service.default.id

  depends_on = [google_project_service.required_apis]
}

# Managed SSL certificate
resource "google_compute_managed_ssl_certificate" "default" {
  name = "${var.app_name}-ssl-cert"

  managed {
    domains = [var.custom_domain]
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.required_apis]
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "default" {
  name             = "${var.app_name}-https-proxy-v2"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]

  depends_on = [google_project_service.required_apis]
}

# HTTPS forwarding rule
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.app_name}-https-forwarding-rule-v2"
  target                = google_compute_target_https_proxy.default.id
  port_range            = "443"
  ip_address            = google_compute_global_address.default.address
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [google_project_service.required_apis]
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  name = "${var.app_name}-https-redirect-v2"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }

  depends_on = [google_project_service.required_apis]
}

# HTTP proxy for redirect
resource "google_compute_target_http_proxy" "https_redirect" {
  name    = "${var.app_name}-http-proxy-v2"
  url_map = google_compute_url_map.https_redirect.id

  depends_on = [google_project_service.required_apis]
}

# HTTP forwarding rule for redirect
resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.app_name}-http-forwarding-rule-v2"
  target                = google_compute_target_http_proxy.https_redirect.id
  port_range            = "80"
  ip_address            = google_compute_global_address.default.address
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [google_project_service.required_apis]
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

output "bill_scheduler_job_name" {
  description = "The name of the Cloud Scheduler job for bill advancement"
  value       = google_cloud_scheduler_job.bill_advance.name
}

output "load_balancer_ip" {
  description = "The static IP address of the load balancer"
  value       = google_compute_global_address.default.address
}

output "custom_domain" {
  description = "The custom domain configured for the application"
  value       = var.custom_domain
}

output "ssl_certificate_status" {
  description = "The status of the managed SSL certificate"
  value       = google_compute_managed_ssl_certificate.default.managed[0].domains
}

output "next_steps" {
  description = "Next steps to deploy your application"
  value       = <<-EOT

    ============================================
    Infrastructure deployed successfully! 🎉
    ============================================

    Custom Domain: https://${var.custom_domain}
    Load Balancer IP: ${google_compute_global_address.default.address}

    Note: Cloud Run default URL is disabled for security.
    Access only via: https://${var.custom_domain}

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

    4. Configure your DNS:

       Add an A record in your DNS provider pointing to:
       ${google_compute_global_address.default.address}

       Example DNS record:
       Type: A
       Name: ${var.custom_domain == "www.${replace(var.custom_domain, "www.", "")}" ? "www" : "@"}
       Value: ${google_compute_global_address.default.address}
       TTL: 300

       SSL Certificate Status: Provisioning (may take up to 15 minutes)
       The certificate will automatically provision once DNS is configured.

       Security: Cloud Run service is only accessible via the load balancer.
       Direct access to Cloud Run URL is disabled.

    ============================================
  EOT
}
