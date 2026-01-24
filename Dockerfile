# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Build the application
# =============================================================================
FROM node:24-alpine AS builder

# Set environment variables for build
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /usr/src/app

# Install pnpm using corepack (Node.js built-in package manager manager)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and config files
COPY . .

# Build arguments for client-side environment variables (VITE_* prefix)
ARG VITE_APP_TITLE
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID

# Set build-time environment variables
ENV VITE_APP_TITLE=${VITE_APP_TITLE}
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}
ENV VITE_FIREBASE_MEASUREMENT_ID=${VITE_FIREBASE_MEASUREMENT_ID}

# Mount Firebase Admin secrets at build time (for SSR)
RUN --mount=type=secret,id=firebase_project_id \
    --mount=type=secret,id=firebase_client_email \
    --mount=type=secret,id=firebase_private_key \
    FIREBASE_PROJECT_ID=$(cat /run/secrets/firebase_project_id 2>/dev/null || echo "") \
    FIREBASE_CLIENT_EMAIL=$(cat /run/secrets/firebase_client_email 2>/dev/null || echo "") \
    FIREBASE_PRIVATE_KEY=$(cat /run/secrets/firebase_private_key 2>/dev/null || echo "") \
    pnpm run build

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM node:24-alpine AS runner

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /usr/src/app

# Install pnpm for production dependency installation
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY --from=builder /usr/src/app/package.json /usr/src/app/pnpm-lock.yaml ./

# Install only production dependencies (needed for externalized packages like firebase-admin)
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
# TanStack Start with Nitro outputs to .output directory
COPY --from=builder /usr/src/app/.output ./.output

# Expose the application port (non-privileged port)
EXPOSE 3000

# Run the server
# Nitro outputs a self-contained server in .output/server/index.mjs
CMD ["node", ".output/server/index.mjs"]
