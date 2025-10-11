# Democracy Online

A Next.js application for democratic participation, deployed on Google Cloud Platform.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL 15 (Cloud SQL)
- **Authentication**: Firebase Auth
- **Deployment**: Cloud Run (GCP)
- **Infrastructure**: Terraform
- **CI/CD**: GitHub Actions

## Getting Started

### Local Development

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Fill in your Firebase and database credentials.

3. **Start the development server:**

   ```bash
   pnpm dev
   ```

4. **Start the database (optional):**

   ```bash
   # Using the provided script
   bash src/scripts/postgres.sh
   ```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Deployment

### Prerequisites

- GCP account with billing enabled
- Terraform installed
- GitHub repository with Actions enabled

### Infrastructure Setup

1. **Deploy infrastructure with Terraform:**

   ```bash
   cd infra
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   terraform init
   terraform apply
   ```

2. **Configure GitHub Actions:**

   ```bash
   cd .github
   ./setup-workload-identity.sh
   ```

   Add the generated secrets to your GitHub repository.

### Deploying

**Automatic (via GitHub Actions):**

- Push to `master` branch to trigger deployment

**Manual:**

```bash
./deploy.sh
```

See [Infrastructure README](./infra/README.md) and [GitHub Actions README](./.github/README.md) for detailed documentation.

## Project Structure

```
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/             # Utilities and configurations
│   └── scripts/         # Helper scripts
├── infra/               # Terraform configuration
├── .github/
│   └── workflows/       # GitHub Actions CI/CD
├── dockerfile           # Docker build configuration
└── cloudbuild.yaml      # Cloud Build config (alternative to GitHub Actions)
```

## Documentation

- [Infrastructure Guide](./infra/README.md) - Terraform deployment
- [GitHub Actions Setup](./.github/README.md) - CI/CD configuration
- [Build Guide](./BUILD_GUIDE.md) - Docker build and environment variables
- [Deployment Guide](./DEPLOYMENT.md) - Quick start deployment

## Environment Variables

### Build-time (NEXT*PUBLIC*\*)

Required during Docker build, embedded in client-side code:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Runtime (Server-side only)

- `CONNECTION_STRING` - PostgreSQL connection string

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure CI passes
4. Create a pull request to `develop`
5. Merge to `master` to deploy

## License

[Add your license here]
