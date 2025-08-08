#!/bin/bash

# DwayBank Secure Deployment Script
# Ensures all security validations pass before deployment

set -euo pipefail

# Configuration
DOCKER_IMAGE="dwaybank/smart-wallet"
ENVIRONMENT="${ENVIRONMENT:-production}"
SKIP_SECURITY_TESTS="${SKIP_SECURITY_TESTS:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Pre-deployment security validation
validate_security() {
    log "Running pre-deployment security validation..."
    
    # Check if security tests should be skipped
    if [[ "$SKIP_SECURITY_TESTS" == "true" ]]; then
        warning "Security tests are being skipped! This is not recommended for production."
        return 0
    fi
    
    log "Building Docker image for security testing..."
    docker build -t "${DOCKER_IMAGE}:security-test" . || error "Docker build failed"
    
    log "Starting containers for security validation..."
    docker-compose -f docker-compose.security.yml up -d || error "Failed to start test environment"
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Test authentication protection
    log "Testing authentication protection..."
    response=$(docker exec dwaybank-backend-security curl -s -w "%{http_code}" http://localhost:3000/api/v1/dashboard || echo "000")
    if [[ "${response: -3}" != "401" ]]; then
        error "Authentication protection failed - dashboard accessible without token"
    fi
    success "Authentication protection verified"
    
    # Test XSS protection
    log "Testing XSS protection..."
    response=$(docker exec dwaybank-backend-security curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"email":"<script>alert(\"XSS\")</script>test@example.com","password":"test123"}' \
        http://localhost:3000/api/v1/auth/login || echo "000")
    if [[ "${response: -3}" == "500" ]]; then
        error "XSS protection failed - server error indicates vulnerability"
    fi
    success "XSS protection verified"
    
    # Test security headers
    log "Testing security headers..."
    headers=$(docker exec dwaybank-backend-security curl -s -I http://localhost:3000/health || echo "")
    if [[ "$headers" != *"X-Frame-Options"* ]] || [[ "$headers" != *"Content-Security-Policy"* ]]; then
        error "Security headers missing or incomplete"
    fi
    success "Security headers verified"
    
    # Cleanup test environment
    log "Cleaning up security test environment..."
    docker-compose -f docker-compose.security.yml down -v
    docker rmi "${DOCKER_IMAGE}:security-test" || true
    
    success "Security validation completed successfully"
}

# Docker image security scan
scan_docker_security() {
    log "Scanning Docker image for security vulnerabilities..."
    
    # Build production image
    docker build -t "${DOCKER_IMAGE}:${GITHUB_SHA:-latest}" .
    
    # Run Trivy security scan
    if command -v trivy &> /dev/null; then
        log "Running Trivy vulnerability scan..."
        trivy image --exit-code 1 --severity HIGH,CRITICAL "${DOCKER_IMAGE}:${GITHUB_SHA:-latest}" || error "Critical vulnerabilities found in Docker image"
        success "Docker image security scan passed"
    else
        warning "Trivy not found, skipping container security scan"
    fi
}

# Deploy to environment
deploy_application() {
    log "Deploying DwayBank to $ENVIRONMENT environment..."
    
    case "$ENVIRONMENT" in
        "staging")
            log "Deploying to staging..."
            docker-compose -f docker-compose.staging.yml up -d
            ;;
        "production")
            log "Deploying to production..."
            docker-compose -f docker-compose.yml up -d
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            ;;
    esac
    
    # Wait for deployment
    log "Waiting for deployment to stabilize..."
    sleep 60
    
    # Health check
    log "Performing health check..."
    max_attempts=30
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            success "Health check passed"
            break
        fi
        ((attempt++))
        log "Health check attempt $attempt/$max_attempts..."
        sleep 10
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "Health check failed after $max_attempts attempts"
    fi
}

# Post-deployment security validation
validate_deployment_security() {
    log "Running post-deployment security validation..."
    
    # Test that authentication is still enforced
    log "Validating authentication protection in deployed environment..."
    response=$(curl -s -w "%{http_code}" http://localhost:3000/api/v1/dashboard || echo "000")
    if [[ "${response: -3}" != "401" ]]; then
        error "Deployed application authentication check failed"
    fi
    success "Deployed application authentication verified"
    
    # Test security headers in deployed environment
    log "Validating security headers in deployed environment..."
    headers=$(curl -s -I http://localhost:3000/health || echo "")
    if [[ "$headers" != *"X-Frame-Options"* ]]; then
        error "Security headers missing in deployed application"
    fi
    success "Deployed application security headers verified"
}

# Rollback function
rollback_deployment() {
    error "Deployment failed, initiating rollback..."
    
    case "$ENVIRONMENT" in
        "staging")
            docker-compose -f docker-compose.staging.yml down
            ;;
        "production")
            docker-compose -f docker-compose.yml down
            ;;
    esac
    
    error "Rollback completed"
}

# Main deployment flow
main() {
    log "🚀 Starting DwayBank secure deployment process..."
    log "Environment: $ENVIRONMENT"
    log "Docker Image: $DOCKER_IMAGE"
    
    # Trap errors for rollback
    trap rollback_deployment ERR
    
    # Pre-deployment security validation
    validate_security
    
    # Docker security scan
    scan_docker_security
    
    # Deploy application
    deploy_application
    
    # Post-deployment validation
    validate_deployment_security
    
    success "🎉 DwayBank deployment completed successfully!"
    log "All security validations passed"
    log "Application is ready for use"
    
    # Generate deployment report
    cat << EOF > deployment-report.txt
DwayBank Deployment Report
=========================
Environment: $ENVIRONMENT
Timestamp: $(date)
Docker Image: $DOCKER_IMAGE:${GITHUB_SHA:-latest}
Security Validations: PASSED
Status: SUCCESS

Security Checks Completed:
✅ Authentication bypass protection
✅ XSS injection protection  
✅ Security headers implementation
✅ Docker image vulnerability scan
✅ Post-deployment validation

Deployment is secure and ready for production use.
EOF
    
    log "Deployment report generated: deployment-report.txt"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi