# DwayBank Smart Wallet Backend - Production Dockerfile
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    redis \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
RUN npm ci --include=dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci --include=dev
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:18-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S dwaybank && \
    adduser -S dwaybank -u 1001

# Install production dependencies only
RUN apk add --no-cache \
    postgresql-client \
    redis \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application
COPY --from=build --chown=dwaybank:dwaybank /app/dist ./dist
COPY --from=build --chown=dwaybank:dwaybank /app/node_modules ./node_modules
COPY --from=build --chown=dwaybank:dwaybank /app/package*.json ./

# Switch to non-root user
USER dwaybank

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["npm", "start"]