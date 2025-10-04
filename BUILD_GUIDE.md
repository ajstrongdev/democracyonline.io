# Build Guide - NEXT*PUBLIC* Environment Variables

## Understanding Next.js Environment Variables

Next.js has two types of environment variables:

### 1. **Build-time variables** (`NEXT_PUBLIC_*`)

- Prefixed with `NEXT_PUBLIC_`
- **Inlined into the JavaScript bundle during build**
- Available in browser and server code
- **Must be present during `next build`**

### 2. **Runtime variables** (no prefix)

- Available only in server-side code
- Can be set at runtime (e.g., Cloud Run environment)
- Not exposed to the browser

## What Was Fixed

The Firebase configuration uses `NEXT_PUBLIC_` variables, which means they need to be available when building the Docker image, not just when running the container.

### Changes Made

#### 1. **Dockerfile** - Added build arguments

```dockerfile
# Accept build arguments for NEXT_PUBLIC_ environment variables
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

# Set environment variables from build arguments
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# ... etc
```

#### 2. **cloudbuild.yaml** - Pass secrets to build

```yaml
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "--build-arg"
      - "NEXT_PUBLIC_FIREBASE_API_KEY=$$FIREBASE_API_KEY"
      # ... more build args
    secretEnv:
      - "FIREBASE_API_KEY"
      # ... more secrets

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/odr-firebase-api-key/versions/latest
      env: "FIREBASE_API_KEY"
    # ... more secrets
```

#### 3. **deploy.sh** - Fetch and pass secrets

```bash
# Fetch secrets from Secret Manager
FIREBASE_API_KEY=$(gcloud secrets versions access latest --secret="${SERVICE_NAME}-firebase-api-key")
# ... more fetches

# Pass as build arguments
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${FIREBASE_API_KEY}" \
  # ... more args
```

#### 4. **cloud-run.tf** - Removed NEXT*PUBLIC* from runtime

The `NEXT_PUBLIC_` variables are no longer needed in Cloud Run's runtime environment since they're baked into the build. Only `CONNECTION_STRING` remains as a runtime variable.

## How to Build Locally

### Option 1: Using environment variables

```bash
# Export Firebase credentials
export NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-domain"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-bucket"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
export NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
export NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"

# Build Docker image
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID \
  -t myapp:latest .
```

### Option 2: Using the deploy script (recommended)

```bash
# The script automatically fetches from Secret Manager
./deploy.sh YOUR_PROJECT_ID
```

### Option 3: From .env file

```bash
# Load from .env file
set -a
source .env
set +a

# Build with explicit values
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}" \
  -t myapp:latest .
```

## CI/CD with Cloud Build

When using Cloud Build (automatic builds from git), the secrets are:

1. Stored in **Secret Manager** (via Terraform)
2. Accessed by Cloud Build (via `availableSecrets` in `cloudbuild.yaml`)
3. Passed as build arguments to Docker
4. Inlined into the Next.js bundle during build

This means:

- ✅ Secrets never appear in git
- ✅ Secrets never appear in Dockerfile
- ✅ Secrets are securely fetched at build time
- ✅ Final image has Firebase config baked in

## Security Notes

### ⚠️ Important: NEXT*PUBLIC* variables are NOT secret!

Even though we fetch them from Secret Manager, `NEXT_PUBLIC_` variables are **exposed in the browser JavaScript bundle**. This is by design - they're meant for client-side code.

**What this means:**

- Anyone can view these in browser DevTools
- They're included in the compiled JavaScript
- Use them for Firebase config, API endpoints, etc.
- **Never use NEXT*PUBLIC* for actual secrets like API keys that should stay server-side**

**For actual secrets:**

- Use regular environment variables (no `NEXT_PUBLIC_` prefix)
- Only access them in server-side code (API routes, getServerSideProps, etc.)
- Store them in Secret Manager
- Set them as Cloud Run runtime environment variables

### Example:

```typescript
// ✅ GOOD: Public Firebase config (needed in browser)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // ...
};

// ✅ GOOD: Database connection (server-only, in API route)
const db = new Pool({
  connectionString: process.env.CONNECTION_STRING, // NOT NEXT_PUBLIC_
});

// ❌ BAD: Never do this!
const apiSecret = process.env.NEXT_PUBLIC_MY_SECRET_KEY; // This will be exposed!
```

## Troubleshooting

### Build fails with "NEXT*PUBLIC* variable undefined"

Make sure you're passing all build arguments:

```bash
docker build --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="value" ...
```

### Firebase not initialized in browser

Check the browser console - the values should be there:

```javascript
console.log(process.env.NEXT_PUBLIC_FIREBASE_API_KEY); // Should show the key
```

### Cloud Build can't access secrets

Ensure Cloud Build has permission:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Summary

- **NEXT*PUBLIC*** = Build time (baked into bundle)
- **No prefix** = Runtime (set on Cloud Run)
- Firebase config = Build time (needs to be in browser)
- Database connection = Runtime (server-side only)

This approach ensures secure builds while keeping your Firebase config accessible to the client-side code where it's needed.
