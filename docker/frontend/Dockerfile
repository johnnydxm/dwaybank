# DwayBank Frontend - Production Dockerfile
# Multi-stage build with Nginx for production serving

FROM node:18-alpine AS base

# Install system dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Development stage
FROM base AS development

# Copy package files
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/frontend/tsconfig.json ./packages/frontend/
COPY packages/frontend/vite.config.ts ./packages/frontend/
COPY packages/frontend/tailwind.config.js ./packages/frontend/

# Install dependencies
RUN npm ci --workspace=@dwaybank/frontend --include=dev

# Copy source code
COPY packages/frontend ./packages/frontend

EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=@dwaybank/frontend"]

# Build stage
FROM base AS build

# Copy package files
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/frontend/tsconfig.json ./packages/frontend/
COPY packages/frontend/vite.config.ts ./packages/frontend/
COPY packages/frontend/tailwind.config.js ./packages/frontend/
COPY packages/frontend/postcss.config.js ./packages/frontend/

# Install dependencies
RUN npm ci --workspace=@dwaybank/frontend --include=dev

# Copy source code
COPY packages/frontend ./packages/frontend

# Set build environment variables
ENV NODE_ENV=production
ENV VITE_API_URL=/api
ENV VITE_APP_NAME="DwayBank Smart Wallet"
ENV VITE_APP_VERSION="1.0.0"

# Build the application
RUN npm run build --workspace=@dwaybank/frontend

# Nginx stage for production
FROM nginx:1.25-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create nginx user if not exists and set up directories
RUN addgroup -g 1001 -S dwaybank \
    && adduser -S dwaybank -u 1001 -G dwaybank \
    && mkdir -p /var/cache/nginx /var/log/nginx /var/run/nginx \
    && chown -R dwaybank:dwaybank /var/cache/nginx /var/log/nginx /var/run/nginx \
    && chmod -R 755 /var/cache/nginx /var/log/nginx /var/run/nginx

# Copy built application
COPY --from=build --chown=dwaybank:dwaybank /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf
COPY docker/frontend/default.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.default

# Security headers and optimization
COPY docker/frontend/security-headers.conf /etc/nginx/conf.d/security-headers.conf

# Create a custom index.html with security meta tags if needed
RUN sed -i 's|<head>|<head>\n  <meta http-equiv="Content-Security-Policy" content="default-src '\''self'\''; script-src '\''self'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\''; connect-src '\''self'\'';">|' /usr/share/nginx/html/index.html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Switch to non-root user
USER dwaybank

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Labels for metadata
LABEL org.opencontainers.image.title="DwayBank Frontend"
LABEL org.opencontainers.image.description="DwayBank Smart Wallet Frontend Application"
LABEL org.opencontainers.image.vendor="DwayBank"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/dwaybank/smart-wallet"