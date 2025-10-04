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
  description = "The public IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "database_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "service_account_email" {
  description = "The email of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.email
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

    3. Your database is ready at:
       Host: ${google_sql_database_instance.postgres.public_ip_address}
       Database: ${var.db_name}
       User: ${var.db_user}

       Connection string is stored in Secret Manager.

    ============================================
  EOT
}
