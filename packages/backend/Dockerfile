# DwayBank Backend - Production-Grade Multi-Stage Dockerfile
# Financial Service Security Hardened

# Stage 1: Dependencies (Alpine for minimal attack surface)
FROM node:20.19.0-alpine AS deps
WORKDIR /app
RUN addgroup -g 1001 -S dwaybank && \
    adduser -S dwaybank -u 1001 -G dwaybank

# Copy package files (root and backend)
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci --workspace=packages/backend --only=production && npm cache clean --force

# Stage 2: Builder 
FROM node:20.19.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci

# Copy source code and build
COPY . .
WORKDIR /app/packages/backend
RUN npm run build

# Stage 3: Production Runtime
FROM node:20.19.0-alpine AS runner
WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S dwaybank && \
    adduser -S dwaybank -u 1001 -G dwaybank

# Install security updates and necessary packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package*.json ./

# Set ownership to non-root user
RUN chown -R dwaybank:dwaybank /app
USER dwaybank

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Security: Drop privileges and use init system
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Expose port (non-privileged)
EXPOSE 3000

# Start application
CMD ["node", "dist/server.js"]