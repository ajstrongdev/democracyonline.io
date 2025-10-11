# Infrastructure Deployment Guide

This directory contains Terraform configuration for deploying the Democracy Online application to Google Cloud Platform (GCP).

## Architecture Overview

- **Cloud Run**: Serverless container platform hosting the Next.js application
- **Cloud SQL (PostgreSQL 15)**: Managed PostgreSQL database
- **Artifact Registry**: Container image repository
- **Secret Manager**: Secure storage for sensitive configuration (Firebase credentials, database connection string)

## Cost Optimization Features

- ✅ Cloud Run scales to zero (no cost when not in use)
- ✅ db-f1-micro instance (smallest tier)
- ✅ HDD storage instead of SSD
- ✅ Single zone availability
- ✅ Minimal backup retention
- ✅ CPU throttling when idle

## Prerequisites

1. **Install Required Tools**

   ```bash
   # Install Terraform
   brew install terraform  # macOS

   # Install gcloud CLI
   brew install google-cloud-sdk  # macOS
   ```

2. **Authenticate with GCP**

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Create a GCP Project** (if you don't have one)

   ```bash
   gcloud projects create YOUR_PROJECT_ID --name="Online Democratic Republic"
   gcloud config set project YOUR_PROJECT_ID

   # Enable billing (required for Cloud Run, Cloud SQL, etc.)
   # You'll need to do this via the GCP Console: https://console.cloud.google.com/billing
   ```

4. **Create GCS Bucket for Terraform State**

   ```bash
   # Update the bucket name in main.tf backend configuration
   gsutil mb -p YOUR_PROJECT_ID -l europe-west2 gs://YOUR_BUCKET_NAME/

   # Enable versioning for safety
   gsutil versioning set on gs://YOUR_BUCKET_NAME/
   ```

## Configuration

1. **Copy the example variables file**

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit `terraform.tfvars`** with your values:

   - Set `project_id` to your GCP project ID
   - Add your Firebase configuration from the Firebase Console
   - Adjust resource sizing if needed

3. **Update the backend configuration in `main.tf`**

   ```hcl
   backend "gcs" {
     bucket = "your-terraform-state-bucket"  # Update this
     prefix = "terraform/state"
   }
   ```

## Deployment

1. **Initialize Terraform**

   ```bash
   cd infra
   terraform init
   ```

2. **Review the planned changes**

   ```bash
   terraform plan
   ```

3. **Apply the configuration**

   ```bash
   terraform apply
   ```

   Review the plan and type `yes` to confirm.

4. **Note the outputs**
   After deployment, Terraform will display important outputs including:
   - Cloud Run URL
   - Artifact Registry repository URL
   - Database connection details
   - Next steps for deploying your application

## Building and Deploying Your Application

### Option 1: Manual Deployment

1. **Configure Docker authentication**

   ```bash
   gcloud auth configure-docker europe-west2-docker.pkg.dev
   ```

2. **Build your Docker image**

   ```bash
   # From the project root directory
   docker build -t europe-west2-docker.pkg.dev/YOUR_PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:latest .
   ```

3. **Push to Artifact Registry**

   ```bash
   docker push europe-west2-docker.pkg.dev/YOUR_PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:latest
   ```

4. **Deploy to Cloud Run**

   ```bash
   gcloud run deploy online-democratic-republic \
     --image europe-west2-docker.pkg.dev/YOUR_PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:latest \
     --region europe-west2 \
     --platform managed
   ```

### Option 2: Automated with Cloud Build (Recommended for CI/CD)

Create a `cloudbuild.yaml` in your project root:

```yaml
steps:
  # Build the container image
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "-t"
      - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:$COMMIT_SHA"
      - "-t"
      - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:latest"
      - "."

  # Push the container image
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "push"
      - "--all-tags"
      - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic"

  # Deploy to Cloud Run
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    entrypoint: gcloud
    args:
      - "run"
      - "deploy"
      - "online-democratic-republic"
      - "--image"
      - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:$COMMIT_SHA"
      - "--region"
      - "europe-west2"
      - "--platform"
      - "managed"

images:
  - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:$COMMIT_SHA"
  - "europe-west2-docker.pkg.dev/$PROJECT_ID/online-democratic-republic-docker/online-democratic-republic:latest"

options:
  logging: CLOUD_LOGGING_ONLY
```

Then trigger manually or set up a GitHub integration:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

## Database Setup

After deployment, you may need to run migrations or seed data:

1. **Connect to Cloud SQL**

   ```bash
   # Install cloud_sql_proxy
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
   chmod +x cloud-sql-proxy

   # Get connection name from terraform output
   CONNECTION_NAME=$(terraform output -raw database_connection_name)

   # Start proxy
   ./cloud-sql-proxy $CONNECTION_NAME
   ```

2. **Run migrations from another terminal**

   ```bash
   # Get database credentials from Secret Manager or Terraform output
   # Then connect with psql or your migration tool
   ```

## Updating the Infrastructure

1. Modify the Terraform files as needed
2. Run `terraform plan` to preview changes
3. Run `terraform apply` to apply changes

## Destroying the Infrastructure

⚠️ **WARNING**: This will delete all resources including the database!

```bash
terraform destroy
```

Before destroying, consider:

- Backing up your database
- Downloading important data
- Exporting any configurations

## Files Overview

- `main.tf` - Complete infrastructure configuration including:
  - Provider setup and API enablement
  - Artifact Registry for Docker images
  - Cloud SQL PostgreSQL instance and database
  - Secret Manager for all secrets (using loops for Firebase configs)
  - Cloud Run service and IAM configuration
  - All outputs
- `variables.tf` - Input variable definitions
- `terraform.tfvars.example` - Example variables file
- `.terraform.lock.hcl` - Dependency lock file (auto-generated)

## Security Notes

1. **Never commit `terraform.tfvars`** - Add it to `.gitignore`
2. The database has a public IP with `0.0.0.0/0` access for cost optimization
   - Consider restricting to specific IPs in production: Update `authorized_networks` in `database.tf`
3. All sensitive values are stored in Secret Manager
4. Deletion protection is enabled on the database

## Troubleshooting

### "API not enabled" errors

Run this to enable all required APIs:

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com
```

### Cloud Run service won't start

- Check logs: `gcloud run services logs read online-democratic-republic --region europe-west2`
- Verify all secrets are properly set
- Ensure database is accessible

### Permission denied errors

Ensure your service account has the necessary roles:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/run.admin"
```

## Cost Estimation

With the current configuration (scale to zero, minimal instance):

- **Cloud Run**: ~$0 when idle, ~$0.00002400/second when running
- **Cloud SQL**: ~$9-15/month for db-f1-micro with backups
- **Secret Manager**: ~$0.06/secret/month ($0.48/month for 8 secrets)
- **Artifact Registry**: $0.10/GB/month storage
- **Cloud Build**: Free tier covers 120 build-minutes/day

**Estimated monthly cost**: ~$10-20 USD for a low-traffic application

## Support

For Terraform issues, see: <https://registry.terraform.io/providers/hashicorp/google/latest/docs>
For GCP issues, see: <https://cloud.google.com/docs>
