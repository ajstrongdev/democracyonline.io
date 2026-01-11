# GitHub Actions CI/CD Setup

This project uses GitHub Actions for CI/CD instead of Cloud Build.

## Workflows

### 1. **CI Workflow** (`.github/workflows/ci.yml`)

- **Triggers**: On push to any branch (except `master`), and PRs to `develop` or `master`
- **Jobs**:
  - Runs ESLint
  - Builds the Next.js application

### 2. **CD Workflow** (`.github/workflows/deploy.yml`)

- **Triggers**: On push to `master` branch, or manually
- **Jobs**:
  - Authenticates to GCP using Workload Identity Federation
  - Fetches Firebase credentials from Secret Manager
  - Builds Docker image with Firebase configs
  - Pushes to Artifact Registry
  - Deploys to Cloud Run

## Initial Setup

### 1. Run the setup script

```bash
cd .github
./setup-workload-identity.sh
```

This script will:

- Enable required GCP APIs
- Create a service account for GitHub Actions
- Grant necessary permissions
- Create Workload Identity Pool and Provider
- Display secrets to add to GitHub

### 2. Add GitHub Secrets

Go to: https://github.com/ajstrongdev/onlinedemocraticrepublic/settings/secrets/actions/new

Add these two secrets (values will be shown by the setup script):

1. **`GCP_WORKLOAD_IDENTITY_PROVIDER`**
   - The full resource name of the Workload Identity Provider
   - Format: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NAME/providers/PROVIDER_NAME`

2. **`GCP_SERVICE_ACCOUNT`**
   - The email of the service account
   - Format: `github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com`

### 3. Test the workflows

**Test CI:**

```bash
git checkout -b test-ci
git push origin test-ci
```

Check: https://github.com/ajstrongdev/onlinedemocraticrepublic/actions

**Test CD:**

```bash
git checkout master
git merge test-ci
git push origin master
```

## How It Works

### Authentication Flow

```
GitHub Action
    ↓ (OIDC token)
Workload Identity Federation
    ↓ (impersonates)
Service Account
    ↓ (has permissions)
GCP Resources (Cloud Run, Artifact Registry, Secret Manager)
```

**Why this is secure:**

- ❌ No service account keys stored in GitHub
- ✅ Temporary credentials generated per workflow run
- ✅ Scoped to specific GitHub repository
- ✅ Can be revoked instantly if needed

### CI Workflow Details

```yaml
on:
  push:
    branches-ignore:
      - master # Skip CI on master (CD will run)
  pull_request:
    branches: [develop, master]
```

**Steps:**

1. Checkout code
2. Setup pnpm + Node.js
3. Install dependencies
4. Run ESLint
5. Build Next.js (with dummy Firebase vars)

### CD Workflow Details

```yaml
on:
  push:
    branches: [master]
  workflow_dispatch: # Manual trigger
```

**Steps:**

1. Checkout code
2. Authenticate to GCP (Workload Identity)
3. Fetch Firebase credentials from Secret Manager (using a loop)
4. Build Docker image for linux/amd64 (with real Firebase vars)
5. Push to Artifact Registry
6. Deploy to Cloud Run
7. Display deployment URL

## Permissions Required

The service account needs these roles:

| Role                                 | Purpose                               |
| ------------------------------------ | ------------------------------------- |
| `roles/run.admin`                    | Deploy to Cloud Run                   |
| `roles/artifactregistry.writer`      | Push Docker images                    |
| `roles/secretmanager.secretAccessor` | Read Firebase credentials             |
| `roles/iam.serviceAccountUser`       | Impersonate Cloud Run service account |

## Troubleshooting

### "Workload Identity Pool not found"

Run the setup script again: `./.github/setup-workload-identity.sh`

### "Permission denied" during deployment

Check that the service account has all required roles:

```bash
gcloud projects get-iam-policy fir-test-cee1e \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-actions-deployer"
```

### "Failed to fetch secrets"

Ensure the service account has `secretmanager.secretAccessor` role:

```bash
gcloud projects add-iam-policy-binding fir-test-cee1e \
  --member="serviceAccount:github-actions-deployer@fir-test-cee1e.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### CI build fails with "NEXT*PUBLIC* undefined"

The CI workflow uses dummy values for build-time validation. This is normal and expected. The actual values are only used in the CD workflow.

## Comparison: GitHub Actions vs Cloud Build

| Feature            | GitHub Actions               | Cloud Build              |
| ------------------ | ---------------------------- | ------------------------ |
| **Location**       | GitHub infrastructure        | GCP infrastructure       |
| **Authentication** | Workload Identity (no keys!) | Native (automatic)       |
| **Cost**           | Free for public repos        | Pay per build minute     |
| **Speed**          | Slower (external to GCP)     | Faster (internal to GCP) |
| **Flexibility**    | Very flexible                | Limited                  |
| **Vendor Lock-in** | None                         | GCP only                 |

**We chose GitHub Actions because:**

- ✅ Everything in one place (code + CI/CD)
- ✅ Better visibility in PRs
- ✅ More flexible workflows
- ✅ Familiar to most developers

## Manual Deployment

If you need to deploy manually (bypassing GitHub Actions):

```bash
./deploy.sh
```

This script works independently of GitHub Actions.

## Updating the Workflows

Workflow files are in `.github/workflows/`:

- `ci.yml` - Continuous Integration
- `deploy.yml` - Continuous Deployment

Edit these files to customize the CI/CD pipeline.

## Resources

- [GitHub Actions docs](https://docs.github.com/actions)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Cloud Run deployment](https://cloud.google.com/run/docs/deploying)
