#!/bin/bash
# Setup Workload Identity Federation for GitHub Actions to GCP
# This allows GitHub Actions to authenticate to GCP without service account keys

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up Workload Identity Federation for GitHub Actions${NC}"
echo ""

# Configuration
PROJECT_ID="onlinedemocraticrepublic"
GITHUB_REPO="ajstrongdev/onlinedemocraticrepublic"
SERVICE_ACCOUNT_NAME="github-actions-deployer"
WORKLOAD_IDENTITY_POOL="github-pool"
WORKLOAD_IDENTITY_PROVIDER="github-provider"

echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}GitHub Repo: $GITHUB_REPO${NC}"
echo ""

# Enable required APIs
echo "1. Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com \
  --project=$PROJECT_ID

gcloud services enable cloudresourcemanager.googleapis.com \
  --project=$PROJECT_ID

gcloud services enable sts.googleapis.com \
  --project=$PROJECT_ID

# Create service account
echo ""
echo "2. Creating service account for GitHub Actions..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID || echo "Service account already exists"

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant necessary roles to service account
echo ""
echo "3. Granting roles to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Create Workload Identity Pool
echo ""
echo "4. Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create $WORKLOAD_IDENTITY_POOL \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool" || echo "Pool already exists"

# Get the pool ID
WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe $WORKLOAD_IDENTITY_POOL \
  --project=$PROJECT_ID \
  --location="global" \
  --format="value(name)")

# Create Workload Identity Provider
echo ""
echo "5. Creating Workload Identity Provider for GitHub..."
gcloud iam workload-identity-pools providers create-oidc $WORKLOAD_IDENTITY_PROVIDER \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_REPO%/*}'" \
  --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider already exists"

# Grant the service account permission to be impersonated by the Workload Identity Pool
echo ""
echo "6. Allowing Workload Identity Pool to impersonate service account..."
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}"

# Get the Workload Identity Provider resource name
WORKLOAD_IDENTITY_PROVIDER_LOCATION=$(gcloud iam workload-identity-pools providers describe $WORKLOAD_IDENTITY_PROVIDER \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL \
  --format="value(name)")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Add these secrets to your GitHub repository:"
echo ""
echo "Repository: https://github.com/${GITHUB_REPO}/settings/secrets/actions"
echo ""
echo -e "${YELLOW}Secret Name: GCP_WORKLOAD_IDENTITY_PROVIDER${NC}"
echo "Value:"
echo "$WORKLOAD_IDENTITY_PROVIDER_LOCATION"
echo ""
echo -e "${YELLOW}Secret Name: GCP_SERVICE_ACCOUNT${NC}"
echo "Value:"
echo "$SERVICE_ACCOUNT_EMAIL"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Instructions:"
echo "1. Go to: https://github.com/${GITHUB_REPO}/settings/secrets/actions/new"
echo "2. Add GCP_WORKLOAD_IDENTITY_PROVIDER with the value above"
echo "3. Add GCP_SERVICE_ACCOUNT with the value above"
echo "4. Push to the 'develop' branch to trigger deployment"
echo ""
