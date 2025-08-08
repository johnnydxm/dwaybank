#!/bin/bash

# DwayBank Security Validation Script
# Comprehensive security audit and compliance verification

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Security test results
SECURITY_SCORE=0
MAX_SCORE=0
ISSUES_FOUND=()

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║               DWAYBANK SECURITY VALIDATION                   ║${NC}"
    echo -e "${BLUE}║            PCI DSS Level 1 Compliance Check                 ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}\n"
}

print_section() {
    echo -e "\n${PURPLE}▶ $1${NC}"
    echo -e "${PURPLE}$(printf '─%.0s' {1..60})${NC}"
}

print_test() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    local points="$4"
    
    ((MAX_SCORE += points))
    
    if [[ "$actual" == "$expected" ]]; then
        echo -e "  ${GREEN}✓${NC} $test_name: ${GREEN}PASS${NC}"
        ((SECURITY_SCORE += points))
    else
        echo -e "  ${RED}✗${NC} $test_name: ${RED}FAIL${NC} (Expected: $expected, Got: $actual)"
        ISSUES_FOUND+=("$test_name")
    fi
}

print_info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_critical() {
    echo -e "  ${RED}🚨${NC} $1"
}

# Test 1: Authentication System Validation
test_authentication() {
    print_section "1. AUTHENTICATION SYSTEM VALIDATION"
    
    # Check if production server is running with proper security
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        local health_response=$(curl -s http://localhost:3000/health)
        
        # Check if JWT service is active
        if echo "$health_response" | grep -q "healthy"; then
            print_test "Production Server Health" "healthy" "healthy" 10
            
            # Test JWT endpoint exists
            local jwt_test=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/api/v1/auth/login)
            if [[ "$jwt_test" == "400" ]] || [[ "$jwt_test" == "401" ]]; then
                print_test "JWT Authentication Endpoint" "available" "available" 15
            else
                print_test "JWT Authentication Endpoint" "available" "unavailable" 15
            fi
            
        else
            print_test "Production Server Health" "healthy" "unhealthy" 10
        fi
    else
        print_test "Production Server Health" "running" "not_running" 10
        print_critical "Production server not accessible. Security validation cannot continue."
        return 1
    fi
    
    # Check for simple/insecure servers
    local insecure_servers=$(ps aux | grep -E "(simple-auth-server|quick-server)" | grep -v grep | wc -l)
    if [[ $insecure_servers -eq 0 ]]; then
        print_test "Insecure Server Processes" "0" "0" 20
    else
        print_test "Insecure Server Processes" "0" "$insecure_servers" 20
        print_critical "Found $insecure_servers insecure server processes running!"
    fi
}

# Test 2: JWT Security Configuration
test_jwt_security() {
    print_section "2. JWT SECURITY CONFIGURATION"
    
    # Test JWT configuration in environment
    if [[ -f ".env.development" ]]; then
        local jwt_algo=$(grep "JWT_ALGORITHM" .env.development | cut -d'=' -f2 | tr -d ' ')
        if [[ "$jwt_algo" == "HS384" ]] || [[ "$jwt_algo" == "RS256" ]]; then
            print_test "JWT Algorithm Security" "secure" "secure" 15
        else
            print_test "JWT Algorithm Security" "secure" "insecure" 15
        fi
        
        local jwt_secret_length=$(grep "JWT_SECRET" .env.development | cut -d'=' -f2 | wc -c)
        if [[ $jwt_secret_length -gt 32 ]]; then
            print_test "JWT Secret Length" "sufficient" "sufficient" 10
        else
            print_test "JWT Secret Length" "sufficient" "insufficient" 10
        fi
        
        local refresh_secret_length=$(grep "JWT_REFRESH_SECRET" .env.development | cut -d'=' -f2 | wc -c)
        if [[ $refresh_secret_length -gt 32 ]]; then
            print_test "JWT Refresh Secret Length" "sufficient" "sufficient" 10
        else
            print_test "JWT Refresh Secret Length" "sufficient" "insufficient" 10
        fi
    else
        print_test "Environment Configuration" "present" "missing" 35
        print_critical "Environment file not found!"
    fi
}

# Test 3: Database Security
test_database_security() {
    print_section "3. DATABASE SECURITY"
    
    # Check PostgreSQL configuration
    if command -v psql >/dev/null 2>&1; then
        # Test database connection encryption
        if psql "postgresql://dwaybank_user:dev_password_123@localhost:5432/dwaybank_dev" -c "SELECT version();" >/dev/null 2>&1; then
            print_test "Database Connectivity" "connected" "connected" 10
            
            # Check for encrypted connections
            local ssl_status=$(psql "postgresql://dwaybank_user:dev_password_123@localhost:5432/dwaybank_dev" -t -c "SHOW ssl;" 2>/dev/null | tr -d ' ' || echo "off")
            if [[ "$ssl_status" == "on" ]]; then
                print_test "Database SSL Encryption" "enabled" "enabled" 15
            else
                print_test "Database SSL Encryption" "enabled" "disabled" 15
                print_warning "Database SSL should be enabled for production"
            fi
        else
            print_test "Database Connectivity" "connected" "disconnected" 10
            print_info "Database may not be running or accessible"
        fi
    else
        print_info "PostgreSQL client not installed, skipping database tests"
    fi
}

# Test 4: Redis Session Security
test_redis_security() {
    print_section "4. REDIS SESSION SECURITY"
    
    if command -v redis-cli >/dev/null 2>&1; then
        # Test Redis authentication
        if redis-cli -a "redis_dev_password_123" ping >/dev/null 2>&1; then
            print_test "Redis Authentication" "required" "required" 15
            
            # Check for dangerous commands
            local dangerous_commands=$(redis-cli -a "redis_dev_password_123" config get "*command*" 2>/dev/null | grep -E "(flushall|flushdb|eval|debug)" | wc -l)
            if [[ $dangerous_commands -eq 0 ]]; then
                print_test "Redis Dangerous Commands" "disabled" "disabled" 10
            else
                print_test "Redis Dangerous Commands" "disabled" "enabled" 10
                print_warning "Consider disabling dangerous Redis commands in production"
            fi
        else
            # Try without password
            if redis-cli ping >/dev/null 2>&1; then
                print_test "Redis Authentication" "required" "not_required" 15
                print_critical "Redis is accessible without authentication!"
            else
                print_test "Redis Connectivity" "connected" "disconnected" 15
            fi
        fi
    else
        print_info "Redis CLI not installed, skipping Redis tests"
    fi
}

# Test 5: MFA Configuration
test_mfa_security() {
    print_section "5. MULTI-FACTOR AUTHENTICATION (MFA)"
    
    # Check MFA service files
    if [[ -f "src/services/mfa.service.ts" ]]; then
        print_test "MFA Service Implementation" "present" "present" 15
        
        # Check for TOTP implementation
        if grep -q "speakeasy\|authenticator" src/services/mfa.service.ts; then
            print_test "TOTP Implementation" "present" "present" 10
        else
            print_test "TOTP Implementation" "present" "missing" 10
        fi
        
        # Check for backup codes
        if grep -q "backup.*code" src/services/mfa.service.ts; then
            print_test "MFA Backup Codes" "implemented" "implemented" 10
        else
            print_test "MFA Backup Codes" "implemented" "missing" 10
        fi
    else
        print_test "MFA Service Implementation" "present" "missing" 35
        print_critical "MFA service not found!"
    fi
}

# Test 6: Encryption and Data Protection
test_encryption() {
    print_section "6. ENCRYPTION AND DATA PROTECTION"
    
    # Check encryption service
    if [[ -f "src/services/encryption.service.ts" ]]; then
        print_test "Encryption Service" "present" "present" 15
        
        # Check for AES-256-GCM
        if grep -q "aes-256-gcm" src/services/encryption.service.ts; then
            print_test "AES-256-GCM Encryption" "implemented" "implemented" 15
        else
            print_test "AES-256-GCM Encryption" "implemented" "missing" 15
        fi
    else
        print_test "Encryption Service" "present" "missing" 30
    fi
    
    # Check bcrypt configuration
    if [[ -f ".env.development" ]]; then
        local bcrypt_rounds=$(grep "BCRYPT_ROUNDS" .env.development | cut -d'=' -f2)
        if [[ $bcrypt_rounds -ge 12 ]]; then
            print_test "Bcrypt Security Level" "adequate" "adequate" 10
        else
            print_test "Bcrypt Security Level" "adequate" "weak" 10
        fi
    fi
}

# Test 7: Security Monitoring
test_security_monitoring() {
    print_section "7. SECURITY MONITORING AND AUDIT LOGGING"
    
    # Check security service
    if [[ -f "src/services/security.service.ts" ]]; then
        print_test "Security Service" "present" "present" 15
        
        # Check for threat detection
        if grep -q "threat\|suspicious\|risk" src/services/security.service.ts; then
            print_test "Threat Detection System" "implemented" "implemented" 15
        else
            print_test "Threat Detection System" "implemented" "missing" 15
        fi
        
        # Check for audit logging
        if grep -q "audit.*log" src/services/security.service.ts; then
            print_test "Audit Logging" "implemented" "implemented" 10
        else
            print_test "Audit Logging" "implemented" "missing" 10
        fi
    else
        print_test "Security Service" "present" "missing" 40
    fi
}

# Test 8: Rate Limiting and DDoS Protection
test_rate_limiting() {
    print_section "8. RATE LIMITING AND DDOS PROTECTION"
    
    # Check rate limiting configuration
    if [[ -f ".env.development" ]]; then
        local rate_limit_enabled=$(grep "RATE_LIMIT" .env.development | wc -l)
        if [[ $rate_limit_enabled -gt 0 ]]; then
            print_test "Rate Limiting Configuration" "present" "present" 15
            
            local max_requests=$(grep "RATE_LIMIT_MAX_REQUESTS" .env.development | cut -d'=' -f2)
            if [[ $max_requests -le 100 ]]; then
                print_test "Rate Limit Threshold" "appropriate" "appropriate" 10
            else
                print_test "Rate Limit Threshold" "appropriate" "too_high" 10
            fi
        else
            print_test "Rate Limiting Configuration" "present" "missing" 25
        fi
    fi
}

# Test 9: Docker Security Configuration
test_docker_security() {
    print_section "9. DOCKER SECURITY CONFIGURATION"
    
    # Check Docker Compose files
    if [[ -f "docker-compose.security.yml" ]]; then
        print_test "Secure Docker Configuration" "present" "present" 15
        
        # Check for security options
        if grep -q "no-new-privileges" docker-compose.security.yml; then
            print_test "Container Privilege Dropping" "configured" "configured" 10
        else
            print_test "Container Privilege Dropping" "configured" "missing" 10
        fi
        
        # Check for read-only containers
        if grep -q "read_only.*true" docker-compose.security.yml; then
            print_test "Read-Only Containers" "configured" "configured" 10
        else
            print_test "Read-Only Containers" "configured" "missing" 10
        fi
    else
        print_test "Secure Docker Configuration" "present" "missing" 35
    fi
}

# Test 10: PCI DSS Compliance Check
test_pci_compliance() {
    print_section "10. PCI DSS LEVEL 1 COMPLIANCE VERIFICATION"
    
    local pci_score=0
    local pci_requirements=0
    
    # PCI DSS Requirement 1: Firewall Configuration
    ((pci_requirements++))
    if [[ -f "docker-compose.security.yml" ]] && grep -q "127.0.0.1" docker-compose.security.yml; then
        print_test "PCI DSS Req 1: Network Segmentation" "implemented" "implemented" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 1: Network Segmentation" "implemented" "missing" 5
    fi
    
    # PCI DSS Requirement 2: Default passwords
    ((pci_requirements++))
    if [[ -f ".env.development" ]] && ! grep -q "password.*123\|secret.*dev" .env.development; then
        print_test "PCI DSS Req 2: No Default Passwords" "compliant" "compliant" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 2: No Default Passwords" "compliant" "non_compliant" 5
    fi
    
    # PCI DSS Requirement 3: Data Protection
    ((pci_requirements++))
    if [[ -f "src/services/encryption.service.ts" ]]; then
        print_test "PCI DSS Req 3: Data Encryption" "implemented" "implemented" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 3: Data Encryption" "implemented" "missing" 5
    fi
    
    # PCI DSS Requirement 4: Encrypted Transmission
    ((pci_requirements++))
    if grep -q "ssl.*true\|https" .env.development 2>/dev/null; then
        print_test "PCI DSS Req 4: Encrypted Transmission" "implemented" "implemented" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 4: Encrypted Transmission" "implemented" "missing" 5
    fi
    
    # PCI DSS Requirement 8: Access Control
    ((pci_requirements++))
    if [[ -f "src/services/auth.service.ts" ]] && [[ -f "src/services/mfa.service.ts" ]]; then
        print_test "PCI DSS Req 8: Strong Authentication" "implemented" "implemented" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 8: Strong Authentication" "implemented" "missing" 5
    fi
    
    # PCI DSS Requirement 10: Logging
    ((pci_requirements++))
    if [[ -f "src/services/security.service.ts" ]] && grep -q "audit" src/services/security.service.ts; then
        print_test "PCI DSS Req 10: Audit Logging" "implemented" "implemented" 5
        ((pci_score++))
    else
        print_test "PCI DSS Req 10: Audit Logging" "implemented" "missing" 5
    fi
    
    local pci_compliance_percentage=$((pci_score * 100 / pci_requirements))
    print_info "PCI DSS Compliance Score: $pci_compliance_percentage% ($pci_score/$pci_requirements requirements)"
    
    if [[ $pci_compliance_percentage -ge 80 ]]; then
        echo -e "  ${GREEN}✓${NC} PCI DSS Level 1 Compliance: ${GREEN}ACCEPTABLE${NC}"
    else
        echo -e "  ${RED}✗${NC} PCI DSS Level 1 Compliance: ${RED}INSUFFICIENT${NC}"
        print_critical "PCI DSS compliance below 80%. Immediate action required!"
    fi
}

# Generate security report
generate_report() {
    print_section "SECURITY VALIDATION REPORT"
    
    local score_percentage=$((SECURITY_SCORE * 100 / MAX_SCORE))
    
    echo -e "\n${BLUE}Overall Security Score: ${score_percentage}% (${SECURITY_SCORE}/${MAX_SCORE} points)${NC}\n"
    
    if [[ $score_percentage -ge 90 ]]; then
        echo -e "${GREEN}🛡️  SECURITY STATUS: EXCELLENT${NC}"
        echo -e "   Your DwayBank deployment has excellent security posture."
    elif [[ $score_percentage -ge 75 ]]; then
        echo -e "${YELLOW}⚠️  SECURITY STATUS: GOOD${NC}"
        echo -e "   Your DwayBank deployment has good security but needs improvements."
    elif [[ $score_percentage -ge 60 ]]; then
        echo -e "${YELLOW}⚠️  SECURITY STATUS: FAIR${NC}"
        echo -e "   Your DwayBank deployment has moderate security risks."
    else
        echo -e "${RED}🚨 SECURITY STATUS: CRITICAL${NC}"
        echo -e "   Your DwayBank deployment has critical security vulnerabilities!"
    fi
    
    if [[ ${#ISSUES_FOUND[@]} -gt 0 ]]; then
        echo -e "\n${RED}Issues Found (${#ISSUES_FOUND[@]}):${NC}"
        for issue in "${ISSUES_FOUND[@]}"; do
            echo -e "  • $issue"
        done
        
        echo -e "\n${YELLOW}Recommended Actions:${NC}"
        echo -e "  1. Address all failed security tests immediately"
        echo -e "  2. Run './deploy-production-security.sh' for secure deployment"
        echo -e "  3. Enable all security features in production environment"
        echo -e "  4. Conduct regular security audits"
        echo -e "  5. Monitor security logs continuously"
    else
        echo -e "\n${GREEN}🎉 No critical security issues found!${NC}"
        echo -e "   Continue monitoring and maintain security best practices."
    fi
    
    echo -e "\n${BLUE}Security Validation Completed at: $(date)${NC}"
}

# Main execution
main() {
    print_header
    
    cd "$(dirname "$0")/packages/backend" 2>/dev/null || {
        echo -e "${RED}Error: Please run this script from the DwayBank project root directory${NC}"
        exit 1
    }
    
    # Run all security tests
    test_authentication
    test_jwt_security
    test_database_security
    test_redis_security
    test_mfa_security
    test_encryption
    test_security_monitoring
    test_rate_limiting
    test_docker_security
    test_pci_compliance
    
    # Generate final report
    generate_report
    
    # Exit with appropriate code
    if [[ $SECURITY_SCORE -eq $MAX_SCORE ]]; then
        exit 0
    elif [[ $((SECURITY_SCORE * 100 / MAX_SCORE)) -ge 75 ]]; then
        exit 1
    else
        exit 2
    fi
}

# Run main function
main "$@"