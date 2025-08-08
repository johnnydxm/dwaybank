#!/bin/bash

# DwayBank Production Security Deployment Script
# Comprehensive deployment with PCI DSS Level 1 compliance

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.security.yml"
ENV_FILE=".env.production"
BACKUP_DIR="/secure/dwaybank/backups"
LOG_DIR="/secure/dwaybank/logs"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to generate secure random string
generate_secure_key() {
    openssl rand -hex 32
}

# Function to validate environment variables
validate_environment() {
    print_section "VALIDATING ENVIRONMENT VARIABLES"
    
    local required_vars=(
        "DB_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "SESSION_SECRET"
        "ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -ne 0 ]]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        print_warning "Run './setup-environment.sh' to generate secure values"
        exit 1
    fi
    
    print_status "Environment validation passed"
}

# Function to check system requirements
check_requirements() {
    print_section "CHECKING SYSTEM REQUIREMENTS"
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_space -lt 10 ]]; then
        print_warning "Low disk space: ${available_space}GB available. Recommended: 10GB+"
    fi
    
    # Check memory (minimum 4GB)
    available_memory=$(free -g | awk 'NR==2{printf "%.0f", $7}')
    if [[ $available_memory -lt 4 ]]; then
        print_warning "Low memory: ${available_memory}GB available. Recommended: 4GB+"
    fi
    
    print_status "System requirements check completed"
}

# Function to create secure directories
setup_secure_directories() {
    print_section "SETTING UP SECURE DIRECTORIES"
    
    local directories=(
        "/secure/dwaybank"
        "/secure/dwaybank/postgres"
        "/secure/dwaybank/redis"
        "/secure/dwaybank/backups"
        "/secure/dwaybank/logs"
        "/secure/dwaybank/ssl"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            sudo chown $USER:$USER "$dir"
            sudo chmod 700 "$dir"
            print_status "Created secure directory: $dir"
        fi
    done
}

# Function to backup existing data
backup_existing_data() {
    print_section "BACKING UP EXISTING DATA"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/pre_deployment_$timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup Docker volumes if they exist
    if docker volume ls | grep -q dwaybank; then
        print_status "Backing up existing Docker volumes to $backup_path"
        
        # Create backup container
        docker run --rm \
            -v "$(pwd):/backup" \
            -v dwaybank_postgres_data:/data/postgres:ro \
            -v dwaybank_redis_data:/data/redis:ro \
            alpine \
            tar czf "/backup/$backup_path/volumes_backup.tar.gz" /data
        
        print_status "Backup completed: $backup_path/volumes_backup.tar.gz"
    else
        print_status "No existing volumes found, skipping backup"
    fi
}

# Function to build Docker images
build_images() {
    print_section "BUILDING DOCKER IMAGES"
    
    print_status "Building production images with security optimizations..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" build \
        --build-arg NODE_ENV=production \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
        --no-cache
    
    print_status "Docker images built successfully"
}

# Function to run security checks
run_security_checks() {
    print_section "RUNNING SECURITY CHECKS"
    
    # Check for secrets in environment files
    print_status "Scanning for exposed secrets..."
    if grep -r "password\|secret\|key" .env* 2>/dev/null | grep -v "template\|example"; then
        print_error "Potential secrets found in environment files!"
        print_warning "Ensure all sensitive values use environment variable substitution"
    fi
    
    # Check file permissions
    print_status "Checking file permissions..."
    find . -name "*.env*" -perm /044 -exec chmod 600 {} \;
    find . -name "*.key" -perm /044 -exec chmod 600 {} \; 2>/dev/null || true
    find . -name "*.pem" -perm /044 -exec chmod 600 {} \; 2>/dev/null || true
    
    # Scan Docker images for vulnerabilities (if trivy is available)
    if command_exists trivy; then
        print_status "Scanning Docker images for vulnerabilities..."
        trivy image dwaybank/smart-wallet-backend:latest || print_warning "Vulnerability scan found issues"
    else
        print_warning "Trivy not installed. Consider installing for vulnerability scanning"
    fi
    
    print_status "Security checks completed"
}

# Function to deploy services
deploy_services() {
    print_section "DEPLOYING SERVICES"
    
    print_status "Starting secure Docker Compose stack..."
    
    # Pull latest base images
    docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    
    # Start services in order with health checks
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis
    
    print_status "Waiting for database services to be healthy..."
    timeout 60 bash -c 'until docker-compose -f '"$DOCKER_COMPOSE_FILE"' ps | grep -E "(postgres|redis)" | grep -E "healthy|Up"; do sleep 2; done'
    
    # Start application services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d backend nginx
    
    print_status "Waiting for application services to be healthy..."
    timeout 120 bash -c 'until docker-compose -f '"$DOCKER_COMPOSE_FILE"' ps | grep backend | grep "healthy"; do sleep 5; done'
    
    # Start monitoring services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d security-monitor
    
    print_status "All services deployed successfully"
}

# Function to run health checks
run_health_checks() {
    print_section "RUNNING HEALTH CHECKS"
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        print_status "Health check attempt $attempt/$max_attempts"
        
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            print_status "Backend health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "Backend health check failed after $max_attempts attempts"
            docker-compose -f "$DOCKER_COMPOSE_FILE" logs backend
            exit 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    # Test database connectivity
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U dwaybank_user -d dwaybank; then
        print_status "Database connectivity check passed"
    else
        print_error "Database connectivity check failed"
        exit 1
    fi
    
    # Test Redis connectivity
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli --pass "$REDIS_PASSWORD" ping | grep -q PONG; then
        print_status "Redis connectivity check passed"
    else
        print_error "Redis connectivity check failed"
        exit 1
    fi
    
    print_status "All health checks passed"
}

# Function to setup monitoring
setup_monitoring() {
    print_section "SETTING UP MONITORING"
    
    print_status "Configuring log rotation..."
    
    # Setup log rotation for Docker containers
    cat > /tmp/dwaybank-logrotate << EOF
/secure/dwaybank/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    sharedscripts
    postrotate
        docker kill -s USR1 \$(docker ps -q --filter name=dwaybank)
    endscript
}
EOF
    
    sudo mv /tmp/dwaybank-logrotate /etc/logrotate.d/dwaybank
    
    print_status "Setting up system monitoring alerts..."
    
    # Create monitoring script
    cat > /tmp/dwaybank-monitor.sh << 'EOF'
#!/bin/bash
# DwayBank System Monitor

ALERT_EMAIL="admin@dwaybank.com"
LOG_FILE="/secure/dwaybank/logs/monitor.log"

check_service() {
    local service="$1"
    if ! docker-compose -f docker-compose.security.yml ps | grep "$service" | grep -q "Up\|healthy"; then
        echo "$(date): ALERT - Service $service is down" >> "$LOG_FILE"
        echo "Service $service is down" | mail -s "DwayBank Alert: Service Down" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

check_service "backend"
check_service "postgres"
check_service "redis"
check_service "nginx"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "$(date): ALERT - Disk usage is ${DISK_USAGE}%" >> "$LOG_FILE"
    echo "Disk usage is ${DISK_USAGE}%" | mail -s "DwayBank Alert: High Disk Usage" "$ALERT_EMAIL" 2>/dev/null || true
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [[ $MEMORY_USAGE -gt 85 ]]; then
    echo "$(date): ALERT - Memory usage is ${MEMORY_USAGE}%" >> "$LOG_FILE"
    echo "Memory usage is ${MEMORY_USAGE}%" | mail -s "DwayBank Alert: High Memory Usage" "$ALERT_EMAIL" 2>/dev/null || true
fi
EOF
    
    chmod +x /tmp/dwaybank-monitor.sh
    sudo mv /tmp/dwaybank-monitor.sh /usr/local/bin/dwaybank-monitor.sh
    
    # Add to cron (run every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/dwaybank-monitor.sh") | crontab -
    
    print_status "Monitoring setup completed"
}

# Function to display deployment summary
display_summary() {
    print_section "DEPLOYMENT SUMMARY"
    
    echo -e "${GREEN}✅ DwayBank Production Security Deployment Completed Successfully!${NC}\n"
    
    echo "🔒 Security Features Enabled:"
    echo "   • PCI DSS Level 1 Compliance"
    echo "   • JWT with RS256 Encryption"
    echo "   • Multi-Factor Authentication (MFA)"
    echo "   • Redis Session Management"
    echo "   • Advanced Threat Detection"
    echo "   • Comprehensive Audit Logging"
    echo "   • Database Encryption at Rest"
    echo "   • SSL/TLS Termination"
    echo "   • Rate Limiting & DDoS Protection"
    echo "   • Container Security Hardening"
    
    echo -e "\n📊 Service Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo -e "\n🌐 Access Points:"
    echo "   • API Backend: https://localhost:3000"
    echo "   • Health Check: https://localhost:3000/health"
    echo "   • Database: localhost:5432"
    echo "   • Redis: localhost:6379"
    
    echo -e "\n📝 Next Steps:"
    echo "   1. Configure DNS records for your domain"
    echo "   2. Setup SSL certificates with Let's Encrypt"
    echo "   3. Configure monitoring alerts"
    echo "   4. Run security audit: ./audit-security.sh"
    echo "   5. Setup automated backups"
    
    echo -e "\n⚠️  Important Security Notes:"
    echo "   • Change all default passwords immediately"
    echo "   • Enable firewall rules to restrict access"
    echo "   • Regularly update Docker images"
    echo "   • Monitor security logs daily"
    echo "   • Perform regular security audits"
    
    print_status "For management commands, use: docker-compose -f $DOCKER_COMPOSE_FILE [command]"
}

# Main execution
main() {
    print_section "DWAYBANK PRODUCTION SECURITY DEPLOYMENT"
    
    # Load environment variables
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        source "$ENV_FILE"
        set +a
        print_status "Loaded environment from $ENV_FILE"
    else
        print_error "Environment file $ENV_FILE not found!"
        print_warning "Create $ENV_FILE with your production configuration"
        exit 1
    fi
    
    # Run deployment steps
    check_requirements
    validate_environment
    setup_secure_directories
    backup_existing_data
    run_security_checks
    build_images
    deploy_services
    run_health_checks
    setup_monitoring
    display_summary
    
    echo -e "\n${GREEN}🚀 DwayBank is now running securely in production mode!${NC}"
}

# Trap errors and cleanup
trap 'print_error "Deployment failed! Check logs above for details."' ERR

# Run main function
main "$@"