#!/bin/bash
# Deploy script for Democracy Online
# This script helps you deploy your application to GCP

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Online Democratic Republic - Deployment${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install it from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Get project ID
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./deploy.sh PROJECT_ID${NC}"
    echo ""
    echo "Or set the default project:"
    echo "  gcloud config set project YOUR_PROJECT_ID"
    echo "  ./deploy.sh"
    echo ""
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}Error: No project ID specified${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Using project: $PROJECT_ID${NC}"
else
    PROJECT_ID=$1
    echo -e "${YELLOW}Using project: $PROJECT_ID${NC}"
fi

# Configuration
REGION="europe-west2"
SERVICE_NAME="odr"
ARTIFACT_REPO="${SERVICE_NAME}-docker"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${SERVICE_NAME}"

echo ""
echo -e "${GREEN}Step 1: Configuring Docker authentication...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo ""
echo -e "${GREEN}Step 2: Fetching Firebase credentials from Secret Manager...${NC}"
FIREBASE_API_KEY=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-api-key" --project=${PROJECT_ID})
FIREBASE_AUTH_DOMAIN=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-auth-domain" --project=${PROJECT_ID})
FIREBASE_PROJECT_ID=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-project-id" --project=${PROJECT_ID})
FIREBASE_STORAGE_BUCKET=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-storage-bucket" --project=${PROJECT_ID})
FIREBASE_MESSAGING_SENDER_ID=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-messaging-sender-id" --project=${PROJECT_ID})
FIREBASE_APP_ID=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-app-id" --project=${PROJECT_ID})
FIREBASE_MEASUREMENT_ID=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-measurement-id" --project=${PROJECT_ID})

echo ""
echo -e "${GREEN}Step 3: Building Docker image with Firebase credentials...${NC}"
echo -e "${YELLOW}Building for linux/amd64 platform (Cloud Run requirement)${NC}"
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${FIREBASE_APP_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${FIREBASE_MEASUREMENT_ID}" \
  -t ${IMAGE_NAME}:latest .

echo ""
echo -e "${GREEN}Step 4: Pushing image to Artifact Registry...${NC}"
docker push ${IMAGE_NAME}:latest

echo ""
echo -e "${GREEN}Step 5: Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --region ${REGION} \
  --platform managed \
  --project ${PROJECT_ID}

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Deployment complete! 🎉${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Your application URL:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format 'value(status.url)'
echo ""
