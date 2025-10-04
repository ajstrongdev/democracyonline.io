# Secret Manager - Database Connection String
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "${var.app_name}-db-connection-string"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret      = google_secret_manager_secret.db_connection_string.id
  secret_data = "postgresql://${var.db_user}:${random_password.db_password.result}@${google_sql_database_instance.postgres.public_ip_address}:5432/${var.db_name}?sslmode=no-verify"
}

# Firebase API Key
resource "google_secret_manager_secret" "firebase_api_key" {
  secret_id = "${var.app_name}-firebase-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_api_key" {
  secret      = google_secret_manager_secret.firebase_api_key.id
  secret_data = var.firebase_api_key
}

# Firebase Auth Domain (not sensitive, but keeping consistent)
resource "google_secret_manager_secret" "firebase_auth_domain" {
  secret_id = "${var.app_name}-firebase-auth-domain"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_auth_domain" {
  secret      = google_secret_manager_secret.firebase_auth_domain.id
  secret_data = var.firebase_auth_domain
}

# Firebase Project ID
resource "google_secret_manager_secret" "firebase_project_id" {
  secret_id = "${var.app_name}-firebase-project-id"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_project_id" {
  secret      = google_secret_manager_secret.firebase_project_id.id
  secret_data = var.firebase_project_id
}

# Firebase Storage Bucket
resource "google_secret_manager_secret" "firebase_storage_bucket" {
  secret_id = "${var.app_name}-firebase-storage-bucket"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_storage_bucket" {
  secret      = google_secret_manager_secret.firebase_storage_bucket.id
  secret_data = var.firebase_storage_bucket
}

# Firebase Messaging Sender ID
resource "google_secret_manager_secret" "firebase_messaging_sender_id" {
  secret_id = "${var.app_name}-firebase-messaging-sender-id"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_messaging_sender_id" {
  secret      = google_secret_manager_secret.firebase_messaging_sender_id.id
  secret_data = var.firebase_messaging_sender_id
}

# Firebase App ID
resource "google_secret_manager_secret" "firebase_app_id" {
  secret_id = "${var.app_name}-firebase-app-id"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_app_id" {
  secret      = google_secret_manager_secret.firebase_app_id.id
  secret_data = var.firebase_app_id
}

# Firebase Measurement ID
resource "google_secret_manager_secret" "firebase_measurement_id" {
  secret_id = "${var.app_name}-firebase-measurement-id"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_measurement_id" {
  secret      = google_secret_manager_secret.firebase_measurement_id.id
  secret_data = var.firebase_measurement_id
}
