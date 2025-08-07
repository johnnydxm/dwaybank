# DwayBank Frontend Next.js - Production Dockerfile
# Multi-stage build optimized for Next.js with security hardening

FROM node:18-alpine AS base

# Install system dependencies and security updates
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Development stage
FROM base AS development

# Copy package files
COPY packages/frontend-nextjs/package*.json ./

# Install dependencies (use npm install for development)
RUN npm install

# Copy configuration files
COPY packages/frontend-nextjs/next.config.ts ./
COPY packages/frontend-nextjs/tsconfig.json ./
COPY packages/frontend-nextjs/tailwind.config.js ./
COPY packages/frontend-nextjs/postcss.config.js ./
COPY packages/frontend-nextjs/eslint.config.mjs ./
COPY packages/frontend-nextjs/components.json ./

# Copy source code
COPY packages/frontend-nextjs/src ./src
COPY packages/frontend-nextjs/public ./public

# Create dwaybank user for security
RUN addgroup -g 1001 -S dwaybank \
    && adduser -S dwaybank -u 1001 -G dwaybank \
    && mkdir -p /app/.next \
    && chown -R dwaybank:dwaybank /app

# Switch to non-root user
USER dwaybank

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Copy package files
COPY packages/frontend-nextjs/package*.json ./

# Install dependencies
RUN npm install

# Copy configuration files
COPY packages/frontend-nextjs/next.config.ts ./
COPY packages/frontend-nextjs/tsconfig.json ./
COPY packages/frontend-nextjs/tailwind.config.js ./
COPY packages/frontend-nextjs/postcss.config.js ./
COPY packages/frontend-nextjs/eslint.config.mjs ./
COPY packages/frontend-nextjs/components.json ./

# Copy source code
COPY packages/frontend-nextjs/src ./src
COPY packages/frontend-nextjs/public ./public

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create dwaybank user for security
RUN addgroup -g 1001 -S dwaybank \
    && adduser -S dwaybank -u 1001 -G dwaybank

# Copy package.json for production dependencies
COPY packages/frontend-nextjs/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build --chown=dwaybank:dwaybank /app/.next/standalone ./
COPY --from=build --chown=dwaybank:dwaybank /app/.next/static ./.next/static
COPY --from=build --chown=dwaybank:dwaybank /app/public ./public

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Switch to non-root user
USER dwaybank

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Start Next.js application
CMD ["node", "server.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="DwayBank Frontend Next.js"
LABEL org.opencontainers.image.description="DwayBank Neo Banking Platform Frontend"
LABEL org.opencontainers.image.vendor="DwayBank"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/dwaybank/neo-banking-platform"