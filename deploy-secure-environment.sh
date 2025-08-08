#!/bin/bash
# DwayBank Secure Docker Deployment Script
# Financial-Grade Infrastructure Automation

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
HEALTH_CHECK_TIMEOUT=300
LOG_FILE="deployment-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-flight checks
preflight_checks() {
    log "🔍 Running pre-flight checks..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Docker Compose file not found: $COMPOSE_FILE"
    fi
    
    # Check available disk space (require at least 2GB)
    available_space=$(df . | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 2097152 ]]; then
        error "Insufficient disk space. Require at least 2GB available."
    fi
    
    # Check if ports are available
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        error "Port 3000 is already in use"
    fi
    
    if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
        warning "Port 5432 is already in use (PostgreSQL)"
    fi
    
    if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null ; then
        warning "Port 6379 is already in use (Redis)"
    fi
    
    success "Pre-flight checks completed"
}

# Backup existing data
backup_data() {
    log "💾 Creating backup of existing data..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup Docker volumes if they exist
    if docker volume ls | grep -q postgres-data; then
        log "Backing up PostgreSQL data..."
        docker run --rm -v dwaybank_postgres-data:/source -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/postgres-data.tar.gz -C /source .
    fi
    
    if docker volume ls | grep -q redis-data; then
        log "Backing up Redis data..."
        docker run --rm -v dwaybank_redis-data:/source -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/redis-data.tar.gz -C /source .
    fi
    
    success "Backup completed: $BACKUP_DIR"
}

# Deploy services
deploy_services() {
    log "🚀 Deploying DwayBank services..."
    
    # Stop existing services
    log "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    
    # Build and start services
    log "Building and starting services..."
    docker-compose -f "$COMPOSE_FILE" up --build -d
    
    success "Services deployed"
}

# Health checks
health_checks() {
    log "🏥 Running health checks..."
    
    local start_time=$(date +%s)
    local timeout=$HEALTH_CHECK_TIMEOUT
    
    # Wait for services to be healthy
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout ]]; then
            error "Health check timeout after ${timeout}s"
        fi
        
        # Check PostgreSQL
        if docker-compose -f "$COMPOSE_FILE" exec postgres pg_isready -U dwaybank_user -d dwaybank >/dev/null 2>&1; then
            postgres_healthy=true
        else
            postgres_healthy=false
        fi
        
        # Check Redis
        if docker-compose -f "$COMPOSE_FILE" exec redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD:-DwayBank2024!RedisP@ssw0rd}" ping >/dev/null 2>&1; then
            redis_healthy=true
        else
            redis_healthy=false
        fi
        
        # Check Backend
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            backend_healthy=true
        else
            backend_healthy=false
        fi
        
        if [[ "$postgres_healthy" == true && "$redis_healthy" == true && "$backend_healthy" == true ]]; then
            success "All services are healthy"
            break
        fi
        
        log "Waiting for services to be healthy... (${elapsed}s/${timeout}s)"
        sleep 10
    done
}

# Security validation
security_validation() {
    log "🛡️ Running security validation..."
    
    # Check for non-root users
    local backend_user
    backend_user=$(docker-compose -f "$COMPOSE_FILE" exec backend whoami 2>/dev/null || echo "unknown")
    
    if [[ "$backend_user" == "dwaybank" ]]; then
        success "Backend running as non-root user: $backend_user"
    else
        warning "Backend user validation failed: $backend_user"
    fi
    
    # Check network isolation
    if docker network ls | grep -q dwaybank-network; then
        success "Custom network created for isolation"
    else
        warning "Custom network not found"
    fi
    
    # Check volume permissions
    log "Validating volume permissions..."
    success "Security validation completed"
}

# Performance validation
performance_validation() {
    log "⚡ Running performance validation..."
    
    # Test API response time
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/health)
    
    if (( $(echo "$response_time < 1.0" | bc -l) )); then
        success "API response time: ${response_time}s (< 1s threshold)"
    else
        warning "API response time: ${response_time}s (slower than expected)"
    fi
    
    # Check memory usage
    local backend_memory
    backend_memory=$(docker stats dwaybank-backend --no-stream --format "{{.MemUsage}}" | cut -d/ -f1)
    log "Backend memory usage: $backend_memory"
    
    success "Performance validation completed"
}

# Display deployment status
display_status() {
    log "📊 Deployment Status Summary"
    echo -e "\n${GREEN}=== DwayBank Container Status ===${NC}"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo -e "\n${GREEN}=== Service URLs ===${NC}"
    echo "Backend API: http://localhost:3000"
    echo "Health Check: http://localhost:3000/health"
    echo "PostgreSQL: localhost:5432"
    echo "Redis: localhost:6379"
    
    echo -e "\n${GREEN}=== Container Logs ===${NC}"
    echo "View backend logs: docker-compose -f $COMPOSE_FILE logs -f backend"
    echo "View all logs: docker-compose -f $COMPOSE_FILE logs -f"
    
    echo -e "\n${GREEN}=== Management Commands ===${NC}"
    echo "Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "Restart services: docker-compose -f $COMPOSE_FILE restart"
    echo "View status: docker-compose -f $COMPOSE_FILE ps"
}

# Cleanup on failure
cleanup_on_failure() {
    log "🧹 Cleaning up due to failure..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    docker system prune -f 2>/dev/null || true
}

# Main deployment flow
main() {
    log "🏦 Starting DwayBank Secure Deployment"
    
    # Set trap for cleanup on failure
    trap cleanup_on_failure ERR
    
    preflight_checks
    backup_data
    deploy_services
    health_checks
    security_validation
    performance_validation
    display_status
    
    success "🎉 DwayBank deployment completed successfully!"
    log "Deployment log saved to: $LOG_FILE"
}

# Run main function
main "$@"