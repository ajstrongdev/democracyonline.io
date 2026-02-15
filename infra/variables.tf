variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "europe-west2"
}

variable "app_name" {
  description = "The application name"
  type        = string
  default     = "odr"
}

variable "name_suffix" {
  description = "Optional suffix appended to app_name for environment-specific resources (e.g., dev)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro" # Smallest/cheapest tier for cost optimization
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "odr_db"
}

variable "db_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "odr_user"
}

# Firebase Configuration Variables
variable "firebase_api_key" {
  description = "Firebase API Key"
  type        = string
  sensitive   = true
}

variable "firebase_auth_domain" {
  description = "Firebase Auth Domain"
  type        = string
}

variable "firebase_project_id" {
  description = "Firebase Project ID"
  type        = string
}

variable "firebase_storage_bucket" {
  description = "Firebase Storage Bucket"
  type        = string
}

variable "firebase_messaging_sender_id" {
  description = "Firebase Messaging Sender ID"
  type        = string
  sensitive   = true
}

variable "firebase_app_id" {
  description = "Firebase App ID"
  type        = string
  sensitive   = true
}

variable "firebase_measurement_id" {
  description = "Firebase Measurement ID"
  type        = string
}

variable "manage_firebase_secrets" {
  description = "Whether Terraform should create Firebase secrets in Secret Manager"
  type        = bool
  default     = true
}

# Firebase Admin SDK Variables
variable "firebase_admin_project_id" {
  description = "Firebase Admin SDK Project ID"
  type        = string
}

variable "firebase_admin_client_email" {
  description = "Firebase Admin SDK Client Email"
  type        = string
  sensitive   = true
}

variable "firebase_admin_private_key" {
  description = "Firebase Admin SDK Private Key"
  type        = string
  sensitive   = true
}

variable "cron_scheduler_token" {
  description = "Shared token used by Cloud Scheduler and API cron auth"
  type        = string
  sensitive   = true
}

variable "cron_local_token" {
  description = "Local-only cron token for localhost non-production access"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "512Mi"
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0 # Scale to zero for cost optimization
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "admin_emails" {
  description = "Comma-separated list of admin email addresses"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain for the application (e.g., example.com or www.example.com)"
  type        = string
  default     = "democracyonline.io"
}

variable "enable_custom_domain" {
  description = "Whether to provision custom domain and load balancer resources"
  type        = bool
  default     = true
}

variable "game_advance_schedule" {
  description = "Cron schedule for game advance Cloud Scheduler job"
  type        = string
  default     = "0 20 * * *"
}

variable "bill_advance_schedule" {
  description = "Cron schedule for bill advance Cloud Scheduler job"
  type        = string
  default     = "0 4,12,20 * * *"
}

variable "hourly_advance_schedule" {
  description = "Cron schedule for hourly advance Cloud Scheduler job"
  type        = string
  default     = "0 * * * *"
}
