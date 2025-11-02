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
  default     = "online-democratic-republic"
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

variable "cron_secret" {
  description = "Secret key for securing API endpoints"
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for the application (e.g., example.com or www.example.com)"
  type        = string
  default     = "democracyonline.io"
}
