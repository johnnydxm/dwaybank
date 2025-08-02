# DwayBank Backend - Production Dockerfile
# Multi-stage build for optimal production image

FROM node:18-alpine AS base

# Install system dependencies and security updates
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    redis \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Development stage
FROM base AS development
# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/backend/tsconfig.json ./packages/backend/

# Install dependencies
RUN npm ci --workspace=@dwaybank/backend --include=dev

# Copy source code
COPY packages/backend ./packages/backend

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@dwaybank/backend"]

# Build stage
FROM base AS build

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/backend/tsconfig.json ./packages/backend/

# Install all dependencies for build
RUN npm ci --workspace=@dwaybank/backend --include=dev

# Copy source code
COPY packages/backend ./packages/backend

# Build the application
RUN npm run build --workspace=@dwaybank/backend

# Prune dev dependencies
RUN npm ci --workspace=@dwaybank/backend --only=production

# Production stage
FROM node:18-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    postgresql-client \
    redis \
    curl \
    dumb-init \
    ca-certificates \
    && addgroup -g 1001 -S dwaybank \
    && adduser -S dwaybank -u 1001 -G dwaybank \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application with proper ownership
COPY --from=build --chown=dwaybank:dwaybank /app/packages/backend/dist ./dist
COPY --from=build --chown=dwaybank:dwaybank /app/packages/backend/node_modules ./node_modules
COPY --from=build --chown=dwaybank:dwaybank /app/packages/backend/package*.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /tmp/dwaybank \
    && chown -R dwaybank:dwaybank /app/logs /app/uploads /tmp/dwaybank

# Security: Switch to non-root user
USER dwaybank

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="DwayBank Backend"
LABEL org.opencontainers.image.description="DwayBank Smart Wallet Backend API"
LABEL org.opencontainers.image.vendor="DwayBank"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/dwaybank/smart-wallet"