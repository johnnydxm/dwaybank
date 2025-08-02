#!/bin/bash

# DwayBank Automated Backup Script
# Comprehensive backup system for financial data with encryption and compliance

set -euo pipefail

# ================================
# CONFIGURATION
# ================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
LOG_FILE="${BACKUP_DIR}/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ENVIRONMENT="${NODE_ENV:-production}"

# Database configuration
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-dwaybank}"
DB_USER="${POSTGRES_USER:-dwaybank_user}"
DB_PASSWORD="${PGPASSWORD}"

# AWS S3 configuration
S3_BUCKET="${S3_BACKUP_BUCKET}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Backup retention
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ARCHIVE_RETENTION_DAYS="${ARCHIVE_RETENTION_DAYS:-365}"

# Encryption
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-backup@dwaybank.com}"

# ================================
# LOGGING FUNCTIONS
# ================================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${LOG_FILE}" >&2
}

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" | tee -a "${LOG_FILE}"
}

# ================================
# UTILITY FUNCTIONS
# ================================
cleanup() {
    local exit_code=$?
    log_info "Cleaning up temporary files..."
    rm -f "${BACKUP_DIR}"/tmp_*
    exit $exit_code
}

trap cleanup EXIT

send_notification() {
    local status=$1
    local message=$2
    
    # Send to monitoring system
    if command -v curl &> /dev/null && [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"DwayBank Backup ${status}: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
    
    # Log to system
    if [ "$status" = "SUCCESS" ]; then
        log_info "$message"
    else
        log_error "$message"
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("pg_dump" "aws" "gzip" "openssl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency not found: $dep"
            exit 1
        fi
    done
    
    # Check GPG if encryption is enabled
    if [ -n "${GPG_RECIPIENT:-}" ] && ! command -v gpg &> /dev/null; then
        log_error "GPG not found but encryption is enabled"
        exit 1
    fi
    
    log_info "All dependencies satisfied"
}

# ================================
# DATABASE BACKUP FUNCTIONS
# ================================
backup_database() {
    log_info "Starting database backup for ${DB_NAME}..."
    
    local backup_file="${BACKUP_DIR}/dwaybank_db_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.enc"
    
    # Create database dump
    log_info "Creating database dump..."
    if ! PGPASSWORD="${DB_PASSWORD}" pg_dump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="${backup_file}"; then
        log_error "Database dump failed"
        return 1
    fi
    
    # Compress the backup
    log_info "Compressing backup..."
    if ! gzip "${backup_file}"; then
        log_error "Backup compression failed"
        return 1
    fi
    
    # Encrypt the backup
    if [ -n "${ENCRYPTION_KEY:-}" ]; then
        log_info "Encrypting backup..."
        if ! openssl enc -aes-256-cbc -salt -in "${compressed_file}" -out "${encrypted_file}" -pass "pass:${ENCRYPTION_KEY}"; then
            log_error "Backup encryption failed"
            return 1
        fi
        rm -f "${compressed_file}"
        backup_file="${encrypted_file}"
    else
        backup_file="${compressed_file}"
    fi
    
    # Verify backup integrity
    log_info "Verifying backup integrity..."
    if [ ! -f "${backup_file}" ] || [ ! -s "${backup_file}" ]; then
        log_error "Backup file is missing or empty"
        return 1
    fi
    
    # Calculate checksums
    local checksum=$(sha256sum "${backup_file}" | awk '{print $1}')
    echo "${checksum}  $(basename "${backup_file}")" > "${backup_file}.sha256"
    
    log_info "Database backup completed: $(basename "${backup_file}")"
    echo "${backup_file}"
}

# ================================
# APPLICATION DATA BACKUP
# ================================
backup_application_data() {
    log_info "Starting application data backup..."
    
    local app_backup_file="${BACKUP_DIR}/dwaybank_app_${TIMESTAMP}.tar.gz"
    local encrypted_file="${app_backup_file}.enc"
    
    # Create application data archive
    log_info "Creating application data archive..."
    
    # Define paths to backup (adjust as needed)
    local backup_paths=(
        "/app/uploads"
        "/app/logs"
        "/app/config"
    )
    
    # Filter existing paths
    local existing_paths=()
    for path in "${backup_paths[@]}"; do
        if [ -d "$path" ] || [ -f "$path" ]; then
            existing_paths+=("$path")
        fi
    done
    
    if [ ${#existing_paths[@]} -eq 0 ]; then
        log_info "No application data to backup"
        return 0
    fi
    
    if ! tar -czf "${app_backup_file}" "${existing_paths[@]}" 2>/dev/null; then
        log_error "Application data backup failed"
        return 1
    fi
    
    # Encrypt if encryption is enabled
    if [ -n "${ENCRYPTION_KEY:-}" ]; then
        log_info "Encrypting application data backup..."
        if ! openssl enc -aes-256-cbc -salt -in "${app_backup_file}" -out "${encrypted_file}" -pass "pass:${ENCRYPTION_KEY}"; then
            log_error "Application data encryption failed"
            return 1
        fi
        rm -f "${app_backup_file}"
        app_backup_file="${encrypted_file}"
    fi
    
    # Calculate checksums
    local checksum=$(sha256sum "${app_backup_file}" | awk '{print $1}')
    echo "${checksum}  $(basename "${app_backup_file}")" > "${app_backup_file}.sha256"
    
    log_info "Application data backup completed: $(basename "${app_backup_file}")"
    echo "${app_backup_file}"
}

# ================================
# CLOUD STORAGE FUNCTIONS
# ================================
upload_to_s3() {
    local file_path=$1
    local s3_key="backups/${ENVIRONMENT}/$(date +%Y/%m/%d)/$(basename "${file_path}")"
    
    log_info "Uploading $(basename "${file_path}") to S3..."
    
    if ! aws s3 cp "${file_path}" "s3://${S3_BUCKET}/${s3_key}" \
        --region "${AWS_REGION}" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "environment=${ENVIRONMENT},backup-date=${TIMESTAMP}"; then
        log_error "S3 upload failed for $(basename "${file_path}")"
        return 1
    fi
    
    # Upload checksum file as well
    if [ -f "${file_path}.sha256" ]; then
        aws s3 cp "${file_path}.sha256" "s3://${S3_BUCKET}/${s3_key}.sha256" \
            --region "${AWS_REGION}" \
            --server-side-encryption AES256 || true
    fi
    
    log_info "Successfully uploaded to S3: s3://${S3_BUCKET}/${s3_key}"
}

# ================================
# CLEANUP FUNCTIONS
# ================================
cleanup_old_backups() {
    log_info "Cleaning up old local backups (older than ${RETENTION_DAYS} days)..."
    
    find "${BACKUP_DIR}" -name "dwaybank_*" -type f -mtime +${RETENTION_DAYS} -delete || true
    
    log_info "Cleaning up old S3 backups..."
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
    
    # List and delete old S3 objects
    aws s3api list-objects-v2 \
        --bucket "${S3_BUCKET}" \
        --prefix "backups/${ENVIRONMENT}/" \
        --query "Contents[?LastModified<='${cutoff_date}'].Key" \
        --output text | \
    while read -r key; do
        if [ -n "$key" ] && [ "$key" != "None" ]; then
            log_info "Deleting old backup: $key"
            aws s3 rm "s3://${S3_BUCKET}/${key}" || true
        fi
    done
}

# ================================
# HEALTH CHECK FUNCTIONS
# ================================
test_database_connection() {
    log_info "Testing database connection..."
    
    if ! PGPASSWORD="${DB_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --command="SELECT 1;" \
        --quiet &>/dev/null; then
        log_error "Database connection test failed"
        return 1
    fi
    
    log_info "Database connection test successful"
}

test_s3_access() {
    log_info "Testing S3 access..."
    
    local test_file="${BACKUP_DIR}/test_${TIMESTAMP}"
    echo "test" > "${test_file}"
    
    if ! aws s3 cp "${test_file}" "s3://${S3_BUCKET}/test/" &>/dev/null; then
        log_error "S3 access test failed"
        rm -f "${test_file}"
        return 1
    fi
    
    # Clean up test file
    aws s3 rm "s3://${S3_BUCKET}/test/test_${TIMESTAMP}" &>/dev/null || true
    rm -f "${test_file}"
    
    log_info "S3 access test successful"
}

# ================================
# BACKUP VERIFICATION
# ================================
verify_backup() {
    local backup_file=$1
    log_info "Verifying backup: $(basename "${backup_file}")"
    
    # Check file exists and has content
    if [ ! -f "${backup_file}" ] || [ ! -s "${backup_file}" ]; then
        log_error "Backup file is missing or empty"
        return 1
    fi
    
    # Verify checksum if available
    if [ -f "${backup_file}.sha256" ]; then
        log_info "Verifying checksum..."
        if ! sha256sum -c "${backup_file}.sha256" &>/dev/null; then
            log_error "Checksum verification failed"
            return 1
        fi
        log_info "Checksum verification successful"
    fi
    
    # For encrypted files, test decryption
    if [[ "${backup_file}" == *.enc ]] && [ -n "${ENCRYPTION_KEY:-}" ]; then
        log_info "Testing decryption..."
        local test_decrypt="${BACKUP_DIR}/test_decrypt_${TIMESTAMP}"
        if ! openssl enc -aes-256-cbc -d -in "${backup_file}" -out "${test_decrypt}" -pass "pass:${ENCRYPTION_KEY}" &>/dev/null; then
            log_error "Decryption test failed"
            rm -f "${test_decrypt}"
            return 1
        fi
        rm -f "${test_decrypt}"
        log_info "Decryption test successful"
    fi
    
    log_info "Backup verification completed successfully"
}

# ================================
# MAIN BACKUP FUNCTION
# ================================
main() {
    log_info "Starting DwayBank backup process (Environment: ${ENVIRONMENT})"
    
    # Create backup directory
    mkdir -p "${BACKUP_DIR}"
    
    # Validate configuration
    if [ -z "${DB_PASSWORD:-}" ]; then
        log_error "Database password not provided"
        exit 1
    fi
    
    if [ -z "${S3_BUCKET:-}" ]; then
        log_error "S3 bucket not configured"
        exit 1
    fi
    
    # Check dependencies
    check_dependencies
    
    # Test connections
    test_database_connection
    test_s3_access
    
    local backup_files=()
    local backup_success=true
    
    # Perform database backup
    if db_backup_file=$(backup_database); then
        backup_files+=("${db_backup_file}")
        verify_backup "${db_backup_file}"
    else
        backup_success=false
        log_error "Database backup failed"
    fi
    
    # Perform application data backup
    if app_backup_file=$(backup_application_data); then
        if [ -n "${app_backup_file}" ]; then
            backup_files+=("${app_backup_file}")
            verify_backup "${app_backup_file}"
        fi
    else
        backup_success=false
        log_error "Application data backup failed"
    fi
    
    # Upload to S3
    for backup_file in "${backup_files[@]}"; do
        if ! upload_to_s3 "${backup_file}"; then
            backup_success=false
        fi
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate backup report
    local total_size=0
    for backup_file in "${backup_files[@]}"; do
        if [ -f "${backup_file}" ]; then
            local file_size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo 0)
            total_size=$((total_size + file_size))
        fi
    done
    
    local size_mb=$((total_size / 1024 / 1024))
    
    if [ "$backup_success" = true ]; then
        local message="Backup completed successfully. Files: ${#backup_files[@]}, Size: ${size_mb}MB"
        send_notification "SUCCESS" "$message"
        log_info "$message"
    else
        local message="Backup completed with errors. Check logs for details."
        send_notification "FAILURE" "$message"
        log_error "$message"
        exit 1
    fi
}

# ================================
# CRON SETUP
# ================================
setup_cron() {
    cat > /etc/cron.d/dwaybank-backup << EOF
# DwayBank Automated Backup
# Run daily at 2:00 AM
0 2 * * * root ${SCRIPT_DIR}/backup.sh >> ${LOG_FILE} 2>&1

# Run weekly full backup on Sunday at 3:00 AM
0 3 * * 0 root FULL_BACKUP=true ${SCRIPT_DIR}/backup.sh >> ${LOG_FILE} 2>&1
EOF
    
    log_info "Cron job installed for automated backups"
}

# ================================
# SCRIPT EXECUTION
# ================================
if [ "$#" -eq 0 ]; then
    main
elif [ "$1" = "setup-cron" ]; then
    setup_cron
elif [ "$1" = "test" ]; then
    check_dependencies
    test_database_connection
    test_s3_access
    log_info "All tests passed"
else
    echo "Usage: $0 [setup-cron|test]"
    exit 1
fi