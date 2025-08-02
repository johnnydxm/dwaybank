#!/bin/bash

# DwayBank Blue-Green Deployment Script
# Zero-downtime deployment with automated rollback capability

set -euo pipefail

# ================================
# CONFIGURATION
# ================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_LOG="/tmp/dwaybank-deployment-${TIMESTAMP}.log"

# Environment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-dwaybank-${ENVIRONMENT}}"

# Blue-Green deployment configuration
BLUE_SERVICE="${BLUE_SERVICE_NAME:-dwaybank-backend-blue}"
GREEN_SERVICE="${GREEN_SERVICE_NAME:-dwaybank-backend-green}"
ALB_LISTENER_ARN="${ALB_LISTENER_ARN}"
BLUE_TARGET_GROUP_ARN="${BLUE_TARGET_GROUP_ARN}"
GREEN_TARGET_GROUP_ARN="${GREEN_TARGET_GROUP_ARN}"

# Application configuration
APP_IMAGE="${APP_IMAGE}"
APP_VERSION="${APP_VERSION:-latest}"
HEALTH_CHECK_PATH="${HEALTH_CHECK_PATH:-/api/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"

# Rollback configuration
ENABLE_AUTO_ROLLBACK="${ENABLE_AUTO_ROLLBACK:-true}"
ROLLBACK_THRESHOLD="${ROLLBACK_THRESHOLD:-5}"

# ================================
# LOGGING FUNCTIONS
# ================================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${DEPLOYMENT_LOG}"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${DEPLOYMENT_LOG}" >&2
}

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" | tee -a "${DEPLOYMENT_LOG}"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" | tee -a "${DEPLOYMENT_LOG}"
}

# ================================
# UTILITY FUNCTIONS
# ================================
cleanup() {
    local exit_code=$?
    log_info "Deployment script cleanup..."
    # Any cleanup operations can go here
    exit $exit_code
}

trap cleanup EXIT

send_notification() {
    local status=$1
    local message=$2
    local environment=$3
    
    # Send to Slack/Teams
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color="good"
        if [ "$status" != "SUCCESS" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"DwayBank Deployment ${status}\",
                    \"text\": \"${message}\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"${environment}\", \"short\": true},
                        {\"title\": \"Version\", \"value\": \"${APP_VERSION}\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$(date -u)\", \"short\": true}
                    ]
                }]
            }" "${SLACK_WEBHOOK_URL}" || true
    fi
    
    # Send to monitoring system
    if [ -n "${DATADOG_API_KEY:-}" ]; then
        curl -X POST "https://api.datadoghq.com/api/v1/events" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: ${DATADOG_API_KEY}" \
            -d "{
                \"title\": \"DwayBank Deployment ${status}\",
                \"text\": \"${message}\",
                \"tags\": [\"environment:${environment}\", \"version:${APP_VERSION}\", \"service:dwaybank\"]
            }" || true
    fi
}

check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check required tools
    local tools=("aws" "jq" "curl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Verify AWS CLI is configured
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS CLI not configured or not authenticated"
        exit 1
    fi
    
    # Check environment variables
    local required_vars=(
        "ALB_LISTENER_ARN"
        "BLUE_TARGET_GROUP_ARN"
        "GREEN_TARGET_GROUP_ARN"
        "APP_IMAGE"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable not set: $var"
            exit 1
        fi
    done
    
    log_success "All prerequisites satisfied"
}

# ================================
# BLUE-GREEN DEPLOYMENT FUNCTIONS
# ================================
get_current_environment() {
    log_info "Determining current active environment..."
    
    # Get current target group from ALB listener
    local current_target_group
    current_target_group=$(aws elbv2 describe-listeners \
        --listener-arns "${ALB_LISTENER_ARN}" \
        --query 'Listeners[0].DefaultActions[0].TargetGroupArn' \
        --output text \
        --region "${AWS_REGION}")
    
    if [ "$current_target_group" = "$BLUE_TARGET_GROUP_ARN" ]; then
        echo "blue"
    elif [ "$current_target_group" = "$GREEN_TARGET_GROUP_ARN" ]; then
        echo "green"
    else
        log_error "Unable to determine current environment"
        exit 1
    fi
}

get_inactive_environment() {
    local current_env=$1
    if [ "$current_env" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

get_service_name() {
    local environment=$1
    if [ "$environment" = "blue" ]; then
        echo "$BLUE_SERVICE"
    else
        echo "$GREEN_SERVICE"
    fi
}

get_target_group_arn() {
    local environment=$1
    if [ "$environment" = "blue" ]; then
        echo "$BLUE_TARGET_GROUP_ARN"
    else
        echo "$GREEN_TARGET_GROUP_ARN"
    fi
}

# ================================
# DEPLOYMENT FUNCTIONS
# ================================
update_service() {
    local service_name=$1
    local image=$2
    
    log_info "Updating ECS service: $service_name with image: $image"
    
    # Get current task definition
    local task_definition
    task_definition=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$service_name" \
        --query 'services[0].taskDefinition' \
        --output text \
        --region "${AWS_REGION}")
    
    # Get task definition details
    local task_def_json
    task_def_json=$(aws ecs describe-task-definition \
        --task-definition "$task_definition" \
        --region "${AWS_REGION}")
    
    # Update container image
    local new_task_def
    new_task_def=$(echo "$task_def_json" | jq --arg image "$image" '
        .taskDefinition |
        .containerDefinitions[0].image = $image |
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
    ')
    
    # Register new task definition
    local new_task_def_arn
    new_task_def_arn=$(echo "$new_task_def" | aws ecs register-task-definition \
        --region "${AWS_REGION}" \
        --cli-input-json file:///dev/stdin \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    log_info "Registered new task definition: $new_task_def_arn"
    
    # Update service
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$service_name" \
        --task-definition "$new_task_def_arn" \
        --region "${AWS_REGION}" \
        >/dev/null
    
    log_success "Service update initiated for $service_name"
}

wait_for_deployment() {
    local service_name=$1
    local timeout=${HEALTH_CHECK_TIMEOUT}
    
    log_info "Waiting for deployment to complete for service: $service_name"
    
    # Wait for service to stabilize
    if ! aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$service_name" \
        --region "${AWS_REGION}"; then
        log_error "Service failed to stabilize: $service_name"
        return 1
    fi
    
    log_success "Service deployment completed: $service_name"
}

health_check() {
    local target_group_arn=$1
    local timeout=${HEALTH_CHECK_TIMEOUT}
    local start_time=$(date +%s)
    
    log_info "Performing health check on target group: $(basename "$target_group_arn")"
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            log_error "Health check timeout after ${timeout} seconds"
            return 1
        fi
        
        # Check target group health
        local healthy_targets
        healthy_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --region "${AWS_REGION}" \
            --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]' \
            --output json | jq length)
        
        local total_targets
        total_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --region "${AWS_REGION}" \
            --query 'TargetHealthDescriptions' \
            --output json | jq length)
        
        log_info "Health check: $healthy_targets/$total_targets targets healthy"
        
        if [ "$healthy_targets" -gt 0 ] && [ "$healthy_targets" -eq "$total_targets" ]; then
            log_success "All targets are healthy"
            return 0
        fi
        
        sleep 10
    done
}

# ================================
# TRAFFIC SWITCHING
# ================================
switch_traffic() {
    local target_group_arn=$1
    
    log_info "Switching traffic to target group: $(basename "$target_group_arn")"
    
    # Update ALB listener to point to new target group
    aws elbv2 modify-listener \
        --listener-arn "$ALB_LISTENER_ARN" \
        --default-actions Type=forward,TargetGroupArn="$target_group_arn" \
        --region "${AWS_REGION}" \
        >/dev/null
    
    # Wait a moment for traffic to switch
    sleep 30
    
    # Verify traffic is flowing
    local health_check_url
    health_check_url=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns $(aws elbv2 describe-listeners \
            --listener-arns "$ALB_LISTENER_ARN" \
            --query 'Listeners[0].LoadBalancerArn' \
            --output text \
            --region "${AWS_REGION}") \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region "${AWS_REGION}")
    
    # Test the health check endpoint
    for i in {1..5}; do
        if curl -sf "http://${health_check_url}${HEALTH_CHECK_PATH}" >/dev/null; then
            log_success "Traffic successfully switched to new environment"
            return 0
        fi
        log_info "Waiting for traffic switch to complete... (attempt $i/5)"
        sleep 10
    done
    
    log_error "Failed to verify traffic switch"
    return 1
}

# ================================
# ROLLBACK FUNCTIONS
# ================================
rollback_deployment() {
    local rollback_env=$1
    local rollback_target_group_arn=$2
    
    log_error "Initiating automatic rollback to $rollback_env environment"
    
    # Switch traffic back
    if switch_traffic "$rollback_target_group_arn"; then
        log_success "Rollback completed successfully"
        send_notification "ROLLBACK_SUCCESS" "Deployment rolled back to $rollback_env environment" "$ENVIRONMENT"
    else
        log_error "Rollback failed - manual intervention required"
        send_notification "ROLLBACK_FAILED" "Automatic rollback failed - manual intervention required" "$ENVIRONMENT"
        exit 1
    fi
}

# ================================
# MONITORING FUNCTIONS
# ================================
monitor_deployment() {
    local target_group_arn=$1
    local monitor_duration=300  # 5 minutes
    local start_time=$(date +%s)
    local error_count=0
    
    log_info "Monitoring deployment for $monitor_duration seconds..."
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $monitor_duration ]; then
            log_success "Monitoring period completed successfully"
            return 0
        fi
        
        # Check for errors in the new environment
        local unhealthy_targets
        unhealthy_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --region "${AWS_REGION}" \
            --query 'TargetHealthDescriptions[?TargetHealth.State!=`healthy`]' \
            --output json | jq length)
        
        if [ "$unhealthy_targets" -gt 0 ]; then
            error_count=$((error_count + 1))
            log_error "Detected $unhealthy_targets unhealthy targets (error count: $error_count)"
            
            if [ "$error_count" -ge "$ROLLBACK_THRESHOLD" ]; then
                log_error "Error threshold reached ($ROLLBACK_THRESHOLD) - triggering rollback"
                return 1
            fi
        else
            # Reset error count on successful check
            error_count=0
        fi
        
        sleep 30
    done
}

# ================================
# MAIN DEPLOYMENT FUNCTION
# ================================
deploy() {
    log_info "Starting Blue-Green deployment for DwayBank"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image: $APP_IMAGE"
    log_info "Version: $APP_VERSION"
    
    # Check prerequisites
    check_prerequisites
    
    # Determine current and target environments
    local current_env
    current_env=$(get_current_environment)
    local target_env
    target_env=$(get_inactive_environment "$current_env")
    
    log_info "Current environment: $current_env"
    log_info "Target environment: $target_env"
    
    # Get service and target group details
    local target_service
    target_service=$(get_service_name "$target_env")
    local target_group_arn
    target_group_arn=$(get_target_group_arn "$target_env")
    local current_target_group_arn
    current_target_group_arn=$(get_target_group_arn "$current_env")
    
    # Send deployment start notification
    send_notification "STARTED" "Deployment started to $target_env environment" "$ENVIRONMENT"
    
    # Update the inactive environment
    if ! update_service "$target_service" "$APP_IMAGE"; then
        log_error "Failed to update service"
        send_notification "FAILED" "Service update failed" "$ENVIRONMENT"
        exit 1
    fi
    
    # Wait for deployment to complete
    if ! wait_for_deployment "$target_service"; then
        log_error "Deployment failed"
        send_notification "FAILED" "Deployment failed - service did not stabilize" "$ENVIRONMENT"
        exit 1
    fi
    
    # Perform health checks
    if ! health_check "$target_group_arn"; then
        log_error "Health check failed"
        send_notification "FAILED" "Health check failed" "$ENVIRONMENT"
        exit 1
    fi
    
    # Switch traffic to new environment
    if ! switch_traffic "$target_group_arn"; then
        log_error "Traffic switch failed"
        if [ "$ENABLE_AUTO_ROLLBACK" = "true" ]; then
            rollback_deployment "$current_env" "$current_target_group_arn"
        fi
        exit 1
    fi
    
    # Monitor the deployment
    if [ "$ENABLE_AUTO_ROLLBACK" = "true" ]; then
        if ! monitor_deployment "$target_group_arn"; then
            rollback_deployment "$current_env" "$current_target_group_arn"
            exit 1
        fi
    fi
    
    # Deployment successful
    log_success "Blue-Green deployment completed successfully"
    log_info "Active environment is now: $target_env"
    
    # Send success notification
    send_notification "SUCCESS" "Deployment completed successfully - active environment: $target_env" "$ENVIRONMENT"
    
    # Generate deployment report
    cat > "/tmp/deployment-report-${TIMESTAMP}.json" << EOF
{
    "deployment_id": "${TIMESTAMP}",
    "environment": "${ENVIRONMENT}",
    "previous_active": "${current_env}",
    "new_active": "${target_env}",
    "app_version": "${APP_VERSION}",
    "app_image": "${APP_IMAGE}",
    "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "SUCCESS"
}
EOF
    
    log_info "Deployment report saved: /tmp/deployment-report-${TIMESTAMP}.json"
}

# ================================
# SCRIPT EXECUTION
# ================================
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        current_env=$(get_current_environment)
        rollback_env=$(get_inactive_environment "$current_env")
        rollback_target_group_arn=$(get_target_group_arn "$rollback_env")
        rollback_deployment "$rollback_env" "$rollback_target_group_arn"
        ;;
    "status")
        current_env=$(get_current_environment)
        log_info "Current active environment: $current_env"
        ;;
    *)
        echo "Usage: $0 [deploy|rollback|status]"
        exit 1
        ;;
esac