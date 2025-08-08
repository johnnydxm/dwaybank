#!/bin/bash

# ================================================================
# DwayBank Smart Wallet MVP - Production Deployment Script
# Automated deployment with safety checks and rollback capability
# ================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_VERSION="${APP_VERSION:-1.0.0}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Deployment cancelled by user"
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error "Do not run this script as root"
    fi
    
    # Check required files
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Docker compose file not found: $COMPOSE_FILE"
    fi
    
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    # Validate environment file
    if ! grep -q "NODE_ENV=production" "$ENV_FILE"; then
        error "Environment file is not configured for production"
    fi
    
    # Check required environment variables
    required_vars=(
        "DB_HOST" "DB_PASSWORD" "REDIS_HOST" "REDIS_PASSWORD"
        "JWT_SECRET" "ENCRYPTION_KEY" "SESSION_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE"; then
            error "Required environment variable $var not found in $ENV_FILE"
        fi
    done
    
    success "Pre-deployment checks passed"
}

# Database health check
check_database() {
    log "Checking database connectivity..."
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Test database connection
    if ! docker run --rm postgres:15-alpine pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        error "Cannot connect to database at $DB_HOST"
    fi
    
    success "Database connectivity verified"
}

# Redis health check
check_redis() {
    log "Checking Redis connectivity..."
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Test Redis connection
    if ! docker run --rm redis:7-alpine redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" -a "$REDIS_PASSWORD" ping &> /dev/null; then
        error "Cannot connect to Redis at $REDIS_HOST"
    fi
    
    success "Redis connectivity verified"
}

# Backup current state
backup_current_state() {
    log "Creating backup of current state..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup environment file
    cp "$ENV_FILE" "$BACKUP_DIR/"
    
    # Backup compose file
    cp "$COMPOSE_FILE" "$BACKUP_DIR/"
    
    # Export current container versions
    docker-compose -f "$COMPOSE_FILE" config > "$BACKUP_DIR/docker-compose-backup.yml"
    
    success "Backup created at $BACKUP_DIR"
}

# Database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check if migrations directory exists
    if [[ ! -d "database/migrations" ]]; then
        warning "No migrations directory found, skipping migrations"
        return
    fi
    
    # Run migrations in order
    for migration in database/migrations/*.sql; do
        if [[ -f "$migration" ]]; then
            log "Running migration: $(basename "$migration")"
            
            # Use docker to run migration
            docker run --rm \
                -v "$(pwd)/database/migrations:/migrations:ro" \
                postgres:15-alpine \
                psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "/migrations/$(basename "$migration")" || {
                    error "Migration failed: $(basename "$migration")"
                }
        fi
    done
    
    success "Database migrations completed"
}

# Build and push images
build_and_push_images() {
    log "Building and pushing Docker images..."
    
    # Build backend
    log "Building backend image..."
    docker build -f docker/backend/Dockerfile --target production \
        -t "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend:$APP_VERSION" \
        -t "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend:latest" .
    
    # Build frontend
    log "Building frontend image..."
    docker build -f docker/frontend/Dockerfile --target production \
        -t "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend:$APP_VERSION" \
        -t "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend:latest" .
    
    # Push images
    if [[ "${SKIP_PUSH:-false}" != "true" ]]; then
        log "Pushing images to registry..."
        docker push "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend:$APP_VERSION"
        docker push "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend:latest"
        docker push "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend:$APP_VERSION"
        docker push "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend:latest"
    else
        warning "Skipping image push (SKIP_PUSH=true)"
    fi
    
    success "Images built and pushed successfully"
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    # Export version for docker-compose
    export APP_VERSION
    export DOCKER_REGISTRY
    
    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Deploy with rolling restart
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
    
    success "Services deployed"
}

# Health checks
health_checks() {
    log "Performing health checks..."
    
    # Source environment for URLs
    set -a
    source "$ENV_FILE"
    set +a
    
    # Wait for services to start
    sleep 30
    
    # Check backend health
    log "Checking backend health..."
    for i in {1..30}; do
        if curl -sf "${API_BASE_URL:-http://localhost:3000}/api/health" > /dev/null; then
            success "Backend health check passed"
            break
        fi
        
        if [[ $i -eq 30 ]]; then
            error "Backend health check failed after 30 attempts"
        fi
        
        sleep 10
    done
    
    # Check frontend
    log "Checking frontend..."
    for i in {1..30}; do
        if curl -sf "${CORS_ORIGIN:-http://localhost}/health" > /dev/null; then
            success "Frontend health check passed"
            break
        fi
        
        if [[ $i -eq 30 ]]; then
            error "Frontend health check failed after 30 attempts"
        fi
        
        sleep 10
    done
    
    # Check database connection from app
    log "Checking application database connectivity..."
    if ! docker-compose -f "$COMPOSE_FILE" exec -T backend node -e "
        const { Pool } = require('pg');
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });
        pool.query('SELECT 1').then(() => {
            console.log('Database connection successful');
            process.exit(0);
        }).catch(err => {
            console.error('Database connection failed:', err.message);
            process.exit(1);
        });
    "; then
        error "Application cannot connect to database"
    fi
    
    success "All health checks passed"
}

# Performance validation
performance_check() {
    log "Running performance validation..."
    
    # Source environment for URLs
    set -a
    source "$ENV_FILE"
    set +a
    
    # Test API response time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "${API_BASE_URL:-http://localhost:3000}/api/health")
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        warning "API response time is ${response_time}s (>2s threshold)"
    else
        success "API response time: ${response_time}s"
    fi
    
    # Test concurrent requests
    log "Testing concurrent API requests..."
    for i in {1..10}; do
        curl -sf "${API_BASE_URL:-http://localhost:3000}/api/health" > /dev/null &
    done
    wait
    
    success "Performance validation completed"
}

# Rollback function
rollback() {
    error "Deployment failed. Starting rollback..."
    
    if [[ -d "$BACKUP_DIR" ]]; then
        log "Rolling back to previous state..."
        
        # Restore previous compose state
        if [[ -f "$BACKUP_DIR/docker-compose-backup.yml" ]]; then
            docker-compose -f "$BACKUP_DIR/docker-compose-backup.yml" up -d
        fi
        
        warning "Rollback completed. Check logs for details."
    else
        error "No backup found for rollback"
    fi
    
    exit 1
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove old images (keep last 3 versions)
    docker images "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend" --format "table {{.Tag}}" | grep -v "latest" | tail -n +4 | xargs -r docker rmi "$DOCKER_REGISTRY/dwaybank/smart-wallet-backend:" || true
    docker images "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend" --format "table {{.Tag}}" | grep -v "latest" | tail -n +4 | xargs -r docker rmi "$DOCKER_REGISTRY/dwaybank/smart-wallet-frontend:" || true
    
    # Remove dangling images
    docker image prune -f
    
    success "Cleanup completed"
}

# Main deployment flow
main() {
    log "Starting DwayBank Smart Wallet MVP deployment (version: $APP_VERSION)"
    
    # Confirmation
    if [[ "${SKIP_CONFIRM:-false}" != "true" ]]; then
        confirm "Deploy DwayBank Smart Wallet MVP to production?"
    fi
    
    # Trap for rollback on failure
    trap rollback ERR
    
    # Deployment steps
    pre_deployment_checks
    check_database
    check_redis
    backup_current_state
    run_migrations
    build_and_push_images
    deploy_services
    health_checks
    performance_check
    cleanup
    
    # Remove trap
    trap - ERR
    
    success "Deployment completed successfully!"
    success "Backend: ${API_BASE_URL:-http://localhost:3000}"
    success "Frontend: ${CORS_ORIGIN:-http://localhost}"
    success "Monitoring: http://localhost:3001 (Grafana)"
    
    log "Monitor the application for the next 24 hours"
    log "Check deployment checklist: DEPLOYMENT_CHECKLIST.md"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi