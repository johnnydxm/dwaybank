# Bank Integration Database Schema
**DwayBank - Canadian Bank Integration Database Design**

## Overview

This document defines the database schema extensions required to support Canadian bank integrations (CIBC, RBC, TD, BMO) within DwayBank's existing PostgreSQL database structure.

---

## 1. Schema Extension Overview

### 1.1 New Tables Summary

| Table | Purpose | Relationships | Key Features |
|-------|---------|---------------|---------------|
| `bank_connections` | Store encrypted bank connection details | → users | OAuth tokens, connection metadata |
| `bank_sync_logs` | Track synchronization activities | → bank_connections | Audit trail, performance monitoring |
| `bank_transactions` | Store bank-specific transaction data | → accounts, bank_connections | Raw bank data preservation |
| `transaction_mappings` | Map bank transactions to DwayBank transactions | → transactions, bank_transactions | Data lineage tracking |
| `balance_sync_history` | Track balance synchronization events | → accounts | Conflict resolution history |
| `bank_webhooks` | Manage webhook configurations | → bank_connections | Real-time sync setup |
| `compliance_reports` | Store regulatory compliance data | → users, transactions | FINTRAC, OSFI reporting |
| `integration_errors` | Log integration failures and resolutions | → bank_connections | Error tracking and analytics |

---

## 2. Database Schema Implementation

### 2.1 Bank Connections Table

```sql
-- Bank connection management
CREATE TABLE bank_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Bank identification
    bank_id VARCHAR(20) NOT NULL, -- 'rbc', 'td', 'bmo', 'cibc'
    bank_name VARCHAR(100) NOT NULL,
    connection_type VARCHAR(20) NOT NULL, -- 'oauth', 'aggregation', 'scraping'
    
    -- Connection credentials (encrypted)
    encrypted_credentials TEXT NOT NULL,
    encryption_key_id VARCHAR(100) NOT NULL,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    
    -- Token management
    token_expires_at TIMESTAMP WITH TIME ZONE,
    token_last_refreshed TIMESTAMP WITH TIME ZONE,
    
    -- Connection metadata
    connection_status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'disabled', 'error'
    scopes TEXT[], -- OAuth scopes granted
    
    -- Account linking
    linked_accounts_count INTEGER DEFAULT 0,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    last_sync_attempt TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    consecutive_failures INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    
    -- Compliance and audit
    consent_given_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consent_expires_at TIMESTAMP WITH TIME ZONE,
    data_retention_until TIMESTAMP WITH TIME ZONE,
    
    -- Standard fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    
    -- Constraints
    CONSTRAINT bank_connections_bank_id_check CHECK (
        bank_id IN ('rbc', 'td', 'bmo', 'cibc', 'aggregation')
    ),
    CONSTRAINT bank_connections_connection_type_check CHECK (
        connection_type IN ('oauth', 'aggregation', 'scraping', 'api')
    ),
    CONSTRAINT bank_connections_status_check CHECK (
        connection_status IN ('active', 'expired', 'disabled', 'error', 'maintenance')
    )
);

-- Indexes for performance
CREATE INDEX idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX idx_bank_connections_bank_id ON bank_connections(bank_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(connection_status);
CREATE INDEX idx_bank_connections_expires ON bank_connections(token_expires_at) WHERE token_expires_at IS NOT NULL;
CREATE UNIQUE INDEX idx_bank_connections_active_user_bank ON bank_connections(user_id, bank_id) 
    WHERE deleted_at IS NULL AND connection_status = 'active';

-- Audit trigger
CREATE TRIGGER bank_connections_audit_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON bank_connections
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- Automatic timestamp update
CREATE TRIGGER bank_connections_updated_at_trigger
    BEFORE UPDATE ON bank_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 Bank Synchronization Logs

```sql
-- Track all synchronization activities
CREATE TABLE bank_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_type VARCHAR(50) NOT NULL, -- 'initial', 'scheduled', 'manual', 'webhook', 'real_time'
    sync_operation VARCHAR(50) NOT NULL, -- 'accounts', 'transactions', 'balance', 'full'
    sync_status VARCHAR(20) NOT NULL, -- 'started', 'in_progress', 'completed', 'failed', 'partial'
    
    -- Performance metrics
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN completed_at IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ELSE NULL
        END
    ) STORED,
    
    -- Sync results
    accounts_processed INTEGER DEFAULT 0,
    accounts_imported INTEGER DEFAULT 0,
    accounts_updated INTEGER DEFAULT 0,
    transactions_processed INTEGER DEFAULT 0,
    transactions_imported INTEGER DEFAULT 0,
    transactions_duplicates INTEGER DEFAULT 0,
    
    -- Error handling
    errors_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    error_details JSONB,
    
    -- Additional metadata
    sync_metadata JSONB,
    
    -- Constraints
    CONSTRAINT bank_sync_logs_sync_type_check CHECK (
        sync_type IN ('initial', 'scheduled', 'manual', 'webhook', 'real_time', 'fallback')
    ),
    CONSTRAINT bank_sync_logs_sync_operation_check CHECK (
        sync_operation IN ('accounts', 'transactions', 'balance', 'full', 'connection_test')
    ),
    CONSTRAINT bank_sync_logs_sync_status_check CHECK (
        sync_status IN ('started', 'in_progress', 'completed', 'failed', 'partial', 'timeout')
    )
);

-- Indexes for performance and monitoring
CREATE INDEX idx_bank_sync_logs_connection_id ON bank_sync_logs(connection_id);
CREATE INDEX idx_bank_sync_logs_user_id ON bank_sync_logs(user_id);
CREATE INDEX idx_bank_sync_logs_status ON bank_sync_logs(sync_status);
CREATE INDEX idx_bank_sync_logs_started_at ON bank_sync_logs(started_at);
CREATE INDEX idx_bank_sync_logs_type_operation ON bank_sync_logs(sync_type, sync_operation);

-- Composite index for sync history queries
CREATE INDEX idx_bank_sync_logs_user_recent ON bank_sync_logs(user_id, started_at DESC) 
    WHERE sync_status = 'completed';

-- Partitioning by month for performance (optional for large volumes)
-- CREATE TABLE bank_sync_logs_y2024m01 PARTITION OF bank_sync_logs 
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2.3 Bank Transactions (Raw Data Storage)

```sql
-- Store original bank transaction data for audit and reconciliation
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Bank-specific identifiers
    bank_id VARCHAR(20) NOT NULL,
    external_transaction_id VARCHAR(255) NOT NULL,
    external_account_id VARCHAR(255) NOT NULL,
    
    -- Raw transaction data
    raw_data JSONB NOT NULL, -- Original JSON from bank API
    normalized_data JSONB NOT NULL, -- Transformed to standard format
    
    -- Core transaction details
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CAD',
    transaction_type VARCHAR(20) NOT NULL, -- 'debit', 'credit'
    transaction_date DATE NOT NULL,
    posted_date DATE,
    value_date DATE,
    
    -- Description and categorization
    raw_description TEXT,
    normalized_description TEXT,
    merchant_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Bank-specific codes
    transaction_code VARCHAR(50),
    bank_reference VARCHAR(255),
    
    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'imported', -- 'imported', 'processed', 'mapped', 'error'
    mapped_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Timestamps
    bank_created_at TIMESTAMP WITH TIME ZONE,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Standard audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT bank_transactions_bank_id_check CHECK (
        bank_id IN ('rbc', 'td', 'bmo', 'cibc', 'aggregation')
    ),
    CONSTRAINT bank_transactions_type_check CHECK (
        transaction_type IN ('debit', 'credit')
    ),
    CONSTRAINT bank_transactions_processing_status_check CHECK (
        processing_status IN ('imported', 'processed', 'mapped', 'error', 'duplicate')
    )
);

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX idx_bank_transactions_unique ON bank_transactions(
    bank_id, external_account_id, external_transaction_id
);

-- Performance indexes
CREATE INDEX idx_bank_transactions_account_id ON bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_connection_id ON bank_transactions(connection_id);
CREATE INDEX idx_bank_transactions_transaction_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_processing_status ON bank_transactions(processing_status);
CREATE INDEX idx_bank_transactions_mapped ON bank_transactions(mapped_transaction_id) 
    WHERE mapped_transaction_id IS NOT NULL;

-- JSONB indexes for raw data queries
CREATE INDEX idx_bank_transactions_raw_data_gin ON bank_transactions USING GIN(raw_data);
CREATE INDEX idx_bank_transactions_normalized_gin ON bank_transactions USING GIN(normalized_data);

-- Partitioning by transaction date for performance
CREATE TABLE bank_transactions_y2024 PARTITION OF bank_transactions 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_bank_transactions_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_name := 'bank_transactions_y' || EXTRACT(YEAR FROM partition_date) || 'm' || LPAD(EXTRACT(MONTH FROM partition_date)::TEXT, 2, '0');
    start_date := DATE_TRUNC('month', partition_date)::TEXT;
    end_date := (DATE_TRUNC('month', partition_date) + INTERVAL '1 month')::TEXT;
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF bank_transactions FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Transaction Mapping Table

```sql
-- Map bank transactions to DwayBank transactions for data lineage
CREATE TABLE transaction_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- DwayBank transaction reference
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    
    -- Bank transaction reference
    bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    
    -- Mapping details
    mapping_type VARCHAR(20) NOT NULL, -- 'automatic', 'manual', 'corrected'
    mapping_confidence DECIMAL(3,2), -- 0.00 to 1.00
    mapping_algorithm VARCHAR(50), -- Algorithm used for automatic mapping
    
    -- Reconciliation status
    reconciliation_status VARCHAR(20) DEFAULT 'matched', -- 'matched', 'discrepancy', 'unmatched'
    discrepancy_amount DECIMAL(15,2),
    discrepancy_reason TEXT,
    
    -- Manual review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT transaction_mappings_mapping_type_check CHECK (
        mapping_type IN ('automatic', 'manual', 'corrected', 'system_generated')
    ),
    CONSTRAINT transaction_mappings_reconciliation_status_check CHECK (
        reconciliation_status IN ('matched', 'discrepancy', 'unmatched', 'disputed')
    ),
    CONSTRAINT transaction_mappings_confidence_range CHECK (
        mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 1)
    )
);

-- Ensure one-to-one mapping between transactions and bank transactions
CREATE UNIQUE INDEX idx_transaction_mappings_transaction_id ON transaction_mappings(transaction_id);
CREATE UNIQUE INDEX idx_transaction_mappings_bank_transaction_id ON transaction_mappings(bank_transaction_id);

-- Performance indexes
CREATE INDEX idx_transaction_mappings_reconciliation_status ON transaction_mappings(reconciliation_status);
CREATE INDEX idx_transaction_mappings_mapping_type ON transaction_mappings(mapping_type);
CREATE INDEX idx_transaction_mappings_reviewed_by ON transaction_mappings(reviewed_by) 
    WHERE reviewed_by IS NOT NULL;
```

### 2.5 Balance Synchronization History

```sql
-- Track balance synchronization events and conflict resolution
CREATE TABLE balance_sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
    
    -- Balance data
    dway_balance_before DECIMAL(15,2) NOT NULL,
    bank_balance DECIMAL(15,2) NOT NULL,
    dway_balance_after DECIMAL(15,2) NOT NULL,
    
    -- Discrepancy analysis
    discrepancy_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        ABS(dway_balance_before - bank_balance)
    ) STORED,
    discrepancy_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN bank_balance = 0 THEN 0
            ELSE ROUND((ABS(dway_balance_before - bank_balance) / ABS(bank_balance)) * 100, 2)
        END
    ) STORED,
    
    -- Sync details
    sync_type VARCHAR(50) NOT NULL, -- 'scheduled', 'real_time', 'manual', 'webhook'
    sync_status VARCHAR(20) NOT NULL, -- 'synchronized', 'conflict_resolved', 'manual_review'
    resolution_method VARCHAR(50), -- 'accept_bank', 'keep_dway', 'manual_adjustment'
    
    -- Conflict resolution
    conflict_detected BOOLEAN DEFAULT FALSE,
    conflict_resolution_id UUID,
    resolution_confidence DECIMAL(3,2),
    resolution_reasoning TEXT,
    
    -- Review and approval
    requires_manual_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    sync_metadata JSONB,
    
    -- Timestamps
    sync_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT balance_sync_history_sync_type_check CHECK (
        sync_type IN ('scheduled', 'real_time', 'manual', 'webhook', 'initial')
    ),
    CONSTRAINT balance_sync_history_sync_status_check CHECK (
        sync_status IN ('synchronized', 'conflict_resolved', 'manual_review', 'error')
    ),
    CONSTRAINT balance_sync_history_resolution_method_check CHECK (
        resolution_method IS NULL OR resolution_method IN (
            'accept_bank', 'keep_dway', 'manual_adjustment', 'transaction_resync'
        )
    )
);

-- Performance indexes
CREATE INDEX idx_balance_sync_history_account_id ON balance_sync_history(account_id);
CREATE INDEX idx_balance_sync_history_sync_timestamp ON balance_sync_history(sync_timestamp);
CREATE INDEX idx_balance_sync_history_conflict ON balance_sync_history(conflict_detected) 
    WHERE conflict_detected = true;
CREATE INDEX idx_balance_sync_history_review ON balance_sync_history(requires_manual_review) 
    WHERE requires_manual_review = true;

-- Index for finding recent sync events
CREATE INDEX idx_balance_sync_history_recent ON balance_sync_history(account_id, sync_timestamp DESC);
```

### 2.6 Bank Webhooks Configuration

```sql
-- Manage webhook configurations for real-time updates
CREATE TABLE bank_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    
    -- Webhook configuration
    bank_id VARCHAR(20) NOT NULL,
    webhook_url TEXT NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL, -- Encrypted
    webhook_events TEXT[] NOT NULL,
    
    -- Status and validation
    webhook_status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'failed', 'pending'
    last_verification_at TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255),
    
    -- Event processing
    events_received INTEGER DEFAULT 0,
    last_event_at TIMESTAMP WITH TIME ZONE,
    last_successful_event_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Configuration metadata
    supported_events TEXT[], -- All events supported by the bank
    webhook_version VARCHAR(10),
    webhook_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT bank_webhooks_bank_id_check CHECK (
        bank_id IN ('rbc', 'td', 'bmo', 'cibc')
    ),
    CONSTRAINT bank_webhooks_status_check CHECK (
        webhook_status IN ('active', 'inactive', 'failed', 'pending', 'expired')
    )
);

-- Unique constraint - one webhook per connection
CREATE UNIQUE INDEX idx_bank_webhooks_connection_id ON bank_webhooks(connection_id);

-- Performance indexes
CREATE INDEX idx_bank_webhooks_bank_id ON bank_webhooks(bank_id);
CREATE INDEX idx_bank_webhooks_status ON bank_webhooks(webhook_status);
CREATE INDEX idx_bank_webhooks_expires_at ON bank_webhooks(expires_at) 
    WHERE expires_at IS NOT NULL;
```

### 2.7 Compliance Reports Table

```sql
-- Store regulatory compliance reports and data
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Report identification
    report_type VARCHAR(50) NOT NULL, -- 'FINTRAC_LCTR', 'FINTRAC_STR', 'OSFI_RISK', 'PRIVACY_AUDIT'
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    report_status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'submitted', 'accepted', 'rejected'
    
    -- FINTRAC specific
    fintrac_report_number VARCHAR(50),
    transaction_threshold_amount DECIMAL(15,2),
    suspicious_activity_indicators TEXT[],
    
    -- Report data
    report_data JSONB NOT NULL,
    report_summary JSONB,
    
    -- Submission tracking
    submitted_to VARCHAR(100),
    submission_method VARCHAR(50), -- 'electronic', 'manual', 'api'
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by UUID REFERENCES users(id),
    
    -- Response tracking
    acknowledgment_received_at TIMESTAMP WITH TIME ZONE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    response_status VARCHAR(50),
    response_data JSONB,
    
    -- Due dates and compliance
    due_date DATE NOT NULL,
    compliance_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'compliant', 'overdue', 'exempt'
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT compliance_reports_type_check CHECK (
        report_type IN ('FINTRAC_LCTR', 'FINTRAC_STR', 'OSFI_RISK', 'PRIVACY_AUDIT', 'PCI_DSS')
    ),
    CONSTRAINT compliance_reports_status_check CHECK (
        report_status IN ('draft', 'submitted', 'accepted', 'rejected', 'under_review')
    ),
    CONSTRAINT compliance_reports_compliance_status_check CHECK (
        compliance_status IN ('pending', 'compliant', 'overdue', 'exempt', 'non_compliant')
    )
);

-- Performance indexes
CREATE INDEX idx_compliance_reports_user_id ON compliance_reports(user_id);
CREATE INDEX idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX idx_compliance_reports_status ON compliance_reports(report_status);
CREATE INDEX idx_compliance_reports_due_date ON compliance_reports(due_date);
CREATE INDEX idx_compliance_reports_period ON compliance_reports(report_period_start, report_period_end);

-- Index for overdue reports
CREATE INDEX idx_compliance_reports_overdue ON compliance_reports(due_date) 
    WHERE compliance_status = 'overdue';
```

### 2.8 Integration Errors Table

```sql
-- Log integration errors and resolutions for monitoring and debugging
CREATE TABLE integration_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Error classification
    error_type VARCHAR(50) NOT NULL, -- 'authentication', 'network', 'rate_limit', 'server_error'
    error_severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    
    -- Context information
    operation_type VARCHAR(50), -- 'sync_accounts', 'sync_transactions', 'create_connection'
    bank_id VARCHAR(20),
    external_account_id VARCHAR(255),
    
    -- Error details
    error_details JSONB,
    stack_trace TEXT,
    request_data JSONB,
    response_data JSONB,
    
    -- Resolution tracking
    resolution_status VARCHAR(20) DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'ignored'
    resolution_method VARCHAR(50), -- 'automatic_retry', 'manual_fix', 'user_action'
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    
    -- Impact assessment
    affected_users_count INTEGER DEFAULT 0,
    business_impact VARCHAR(20), -- 'none', 'low', 'medium', 'high', 'critical'
    estimated_downtime_minutes INTEGER,
    
    -- Retry information
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    max_retries INTEGER DEFAULT 3,
    
    -- Notification tracking
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT integration_errors_type_check CHECK (
        error_type IN ('authentication', 'network', 'rate_limit', 'server_error', 'validation', 'timeout')
    ),
    CONSTRAINT integration_errors_severity_check CHECK (
        error_severity IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT integration_errors_resolution_status_check CHECK (
        resolution_status IN ('new', 'in_progress', 'resolved', 'ignored', 'escalated')
    ),
    CONSTRAINT integration_errors_business_impact_check CHECK (
        business_impact IN ('none', 'low', 'medium', 'high', 'critical')
    )
);

-- Performance indexes
CREATE INDEX idx_integration_errors_connection_id ON integration_errors(connection_id);
CREATE INDEX idx_integration_errors_user_id ON integration_errors(user_id);
CREATE INDEX idx_integration_errors_occurred_at ON integration_errors(occurred_at);
CREATE INDEX idx_integration_errors_resolution_status ON integration_errors(resolution_status);
CREATE INDEX idx_integration_errors_error_type ON integration_errors(error_type);
CREATE INDEX idx_integration_errors_severity ON integration_errors(error_severity);
CREATE INDEX idx_integration_errors_bank_id ON integration_errors(bank_id);

-- Composite indexes for common queries
CREATE INDEX idx_integration_errors_unresolved ON integration_errors(error_severity, occurred_at) 
    WHERE resolution_status IN ('new', 'in_progress');
CREATE INDEX idx_integration_errors_retry ON integration_errors(next_retry_at) 
    WHERE next_retry_at IS NOT NULL AND resolution_status = 'new';
```

---

## 3. Database Functions and Stored Procedures

### 3.1 Bank Connection Management Functions

```sql
-- Function to validate bank connection status
CREATE OR REPLACE FUNCTION validate_bank_connection(connection_id UUID)
RETURNS TABLE (
    is_valid BOOLEAN,
    status VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    needs_refresh BOOLEAN,
    last_error TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN bc.connection_status = 'active' 
                AND (bc.token_expires_at IS NULL OR bc.token_expires_at > CURRENT_TIMESTAMP)
                AND bc.consecutive_failures < 5
            THEN TRUE 
            ELSE FALSE 
        END as is_valid,
        bc.connection_status as status,
        bc.token_expires_at as expires_at,
        CASE 
            WHEN bc.token_expires_at IS NOT NULL 
                AND bc.token_expires_at < (CURRENT_TIMESTAMP + INTERVAL '1 hour')
            THEN TRUE 
            ELSE FALSE 
        END as needs_refresh,
        bc.last_error_message as last_error
    FROM bank_connections bc
    WHERE bc.id = connection_id
      AND bc.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's bank connections with health status
CREATE OR REPLACE FUNCTION get_user_bank_connections(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    bank_id VARCHAR(20),
    bank_name VARCHAR(100),
    connection_status VARCHAR(20),
    linked_accounts_count INTEGER,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    health_score INTEGER,
    needs_attention BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bc.id as connection_id,
        bc.bank_id,
        bc.bank_name,
        bc.connection_status,
        bc.linked_accounts_count,
        bc.last_successful_sync,
        -- Health score calculation (0-100)
        CASE
            WHEN bc.connection_status != 'active' THEN 0
            WHEN bc.consecutive_failures >= 5 THEN 10
            WHEN bc.consecutive_failures >= 3 THEN 30
            WHEN bc.last_successful_sync < (CURRENT_TIMESTAMP - INTERVAL '7 days') THEN 50
            WHEN bc.last_successful_sync < (CURRENT_TIMESTAMP - INTERVAL '1 day') THEN 70
            ELSE 100
        END as health_score,
        -- Needs attention flag
        CASE
            WHEN bc.connection_status != 'active' 
                OR bc.consecutive_failures >= 3
                OR bc.token_expires_at < (CURRENT_TIMESTAMP + INTERVAL '7 days')
                OR bc.last_successful_sync < (CURRENT_TIMESTAMP - INTERVAL '2 days')
            THEN TRUE
            ELSE FALSE
        END as needs_attention
    FROM bank_connections bc
    WHERE bc.user_id = p_user_id
      AND bc.deleted_at IS NULL
    ORDER BY bc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.2 Synchronization Management Functions

```sql
-- Function to record sync attempt and results
CREATE OR REPLACE FUNCTION record_sync_attempt(
    p_connection_id UUID,
    p_sync_type VARCHAR(50),
    p_sync_operation VARCHAR(50),
    p_accounts_processed INTEGER DEFAULT 0,
    p_accounts_imported INTEGER DEFAULT 0,
    p_transactions_processed INTEGER DEFAULT 0,
    p_transactions_imported INTEGER DEFAULT 0,
    p_errors_count INTEGER DEFAULT 0,
    p_error_details JSONB DEFAULT NULL,
    p_sync_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    sync_log_id UUID;
    connection_user_id UUID;
BEGIN
    -- Get user_id from connection
    SELECT user_id INTO connection_user_id 
    FROM bank_connections 
    WHERE id = p_connection_id;
    
    -- Insert sync log
    INSERT INTO bank_sync_logs (
        connection_id,
        user_id,
        sync_type,
        sync_operation,
        sync_status,
        accounts_processed,
        accounts_imported,
        accounts_updated,
        transactions_processed,
        transactions_imported,
        errors_count,
        error_details,
        sync_metadata,
        started_at
    ) VALUES (
        p_connection_id,
        connection_user_id,
        p_sync_type,
        p_sync_operation,
        'started',
        p_accounts_processed,
        p_accounts_imported,
        p_accounts_imported, -- accounts_updated = accounts_imported for now
        p_transactions_processed,
        p_transactions_imported,
        p_errors_count,
        p_error_details,
        p_sync_metadata,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO sync_log_id;
    
    RETURN sync_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete sync attempt
CREATE OR REPLACE FUNCTION complete_sync_attempt(
    p_sync_log_id UUID,
    p_sync_status VARCHAR(20),
    p_final_results JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE bank_sync_logs 
    SET 
        sync_status = p_sync_status,
        completed_at = CURRENT_TIMESTAMP,
        sync_metadata = CASE 
            WHEN p_final_results IS NOT NULL THEN 
                COALESCE(sync_metadata, '{}'::jsonb) || p_final_results
            ELSE sync_metadata
        END
    WHERE id = p_sync_log_id;
    
    -- Update connection last sync timestamp if successful
    IF p_sync_status = 'completed' THEN
        UPDATE bank_connections bc
        SET 
            last_successful_sync = CURRENT_TIMESTAMP,
            consecutive_failures = 0,
            last_error_message = NULL,
            last_error_at = NULL
        FROM bank_sync_logs bsl
        WHERE bsl.id = p_sync_log_id 
          AND bc.id = bsl.connection_id;
    ELSIF p_sync_status = 'failed' THEN
        UPDATE bank_connections bc
        SET consecutive_failures = consecutive_failures + 1
        FROM bank_sync_logs bsl
        WHERE bsl.id = p_sync_log_id 
          AND bc.id = bsl.connection_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 Balance Reconciliation Functions

```sql
-- Function to record balance sync event
CREATE OR REPLACE FUNCTION record_balance_sync(
    p_account_id UUID,
    p_connection_id UUID,
    p_dway_balance_before DECIMAL(15,2),
    p_bank_balance DECIMAL(15,2),
    p_dway_balance_after DECIMAL(15,2),
    p_sync_type VARCHAR(50),
    p_resolution_method VARCHAR(50) DEFAULT NULL,
    p_requires_review BOOLEAN DEFAULT FALSE,
    p_sync_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    sync_history_id UUID;
    conflict_detected BOOLEAN;
    discrepancy_threshold DECIMAL(15,2) := 0.01; -- 1 cent threshold
BEGIN
    -- Determine if conflict detected
    conflict_detected := ABS(p_dway_balance_before - p_bank_balance) > discrepancy_threshold;
    
    -- Insert balance sync history
    INSERT INTO balance_sync_history (
        account_id,
        connection_id,
        dway_balance_before,
        bank_balance,
        dway_balance_after,
        sync_type,
        sync_status,
        resolution_method,
        conflict_detected,
        requires_manual_review,
        sync_metadata,
        sync_timestamp
    ) VALUES (
        p_account_id,
        p_connection_id,
        p_dway_balance_before,
        p_bank_balance,
        p_dway_balance_after,
        p_sync_type,
        CASE 
            WHEN conflict_detected AND p_requires_review THEN 'manual_review'
            WHEN conflict_detected THEN 'conflict_resolved'
            ELSE 'synchronized'
        END,
        p_resolution_method,
        conflict_detected,
        p_requires_review,
        p_sync_metadata,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO sync_history_id;
    
    RETURN sync_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get balance sync statistics
CREATE OR REPLACE FUNCTION get_balance_sync_stats(
    p_account_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    total_syncs INTEGER,
    conflicts_detected INTEGER,
    conflicts_resolved INTEGER,
    manual_reviews INTEGER,
    avg_discrepancy DECIMAL(15,2),
    max_discrepancy DECIMAL(15,2),
    last_sync TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_syncs,
        COUNT(CASE WHEN bsh.conflict_detected THEN 1 END)::INTEGER as conflicts_detected,
        COUNT(CASE WHEN bsh.sync_status = 'conflict_resolved' THEN 1 END)::INTEGER as conflicts_resolved,
        COUNT(CASE WHEN bsh.requires_manual_review THEN 1 END)::INTEGER as manual_reviews,
        ROUND(AVG(bsh.discrepancy_amount), 2) as avg_discrepancy,
        MAX(bsh.discrepancy_amount) as max_discrepancy,
        MAX(bsh.sync_timestamp) as last_sync
    FROM balance_sync_history bsh
    WHERE bsh.account_id = p_account_id
      AND bsh.sync_timestamp >= (CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Views for Reporting and Analytics

### 4.1 Bank Integration Health View

```sql
-- View for monitoring bank integration health
CREATE VIEW bank_integration_health AS
SELECT 
    bc.id as connection_id,
    bc.user_id,
    bc.bank_id,
    bc.bank_name,
    bc.connection_status,
    bc.linked_accounts_count,
    bc.last_successful_sync,
    bc.consecutive_failures,
    
    -- Health metrics
    CASE
        WHEN bc.connection_status != 'active' THEN 0
        WHEN bc.consecutive_failures >= 5 THEN 10
        WHEN bc.consecutive_failures >= 3 THEN 30
        WHEN bc.last_successful_sync < (CURRENT_TIMESTAMP - INTERVAL '7 days') THEN 50
        WHEN bc.last_successful_sync < (CURRENT_TIMESTAMP - INTERVAL '1 day') THEN 70
        ELSE 100
    END as health_score,
    
    -- Recent sync statistics
    recent_stats.sync_count_7d,
    recent_stats.error_count_7d,
    recent_stats.avg_sync_duration_ms,
    
    -- Token status
    CASE 
        WHEN bc.token_expires_at IS NULL THEN 'no_expiry'
        WHEN bc.token_expires_at < CURRENT_TIMESTAMP THEN 'expired'
        WHEN bc.token_expires_at < (CURRENT_TIMESTAMP + INTERVAL '7 days') THEN 'expiring_soon'
        ELSE 'valid'
    END as token_status,
    
    bc.created_at,
    bc.updated_at
    
FROM bank_connections bc
LEFT JOIN (
    SELECT 
        bsl.connection_id,
        COUNT(*) as sync_count_7d,
        COUNT(CASE WHEN bsl.sync_status = 'failed' THEN 1 END) as error_count_7d,
        AVG(bsl.duration_ms) as avg_sync_duration_ms
    FROM bank_sync_logs bsl
    WHERE bsl.started_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days')
    GROUP BY bsl.connection_id
) recent_stats ON bc.id = recent_stats.connection_id
WHERE bc.deleted_at IS NULL;

-- Grant access to appropriate roles
GRANT SELECT ON bank_integration_health TO readonly_role;
```

### 4.2 Transaction Reconciliation View

```sql
-- View for transaction reconciliation reporting
CREATE VIEW transaction_reconciliation_status AS
SELECT 
    a.id as account_id,
    a.user_id,
    a.account_name,
    a.external_bank_name,
    
    -- Transaction counts
    COUNT(bt.*) as total_bank_transactions,
    COUNT(tm.*) as mapped_transactions,
    COUNT(bt.*) - COUNT(tm.*) as unmapped_transactions,
    
    -- Amount reconciliation
    COALESCE(SUM(bt.amount), 0) as total_bank_amount,
    COALESCE(SUM(CASE WHEN tm.id IS NOT NULL THEN t.amount ELSE 0 END), 0) as total_mapped_amount,
    COALESCE(SUM(bt.amount), 0) - COALESCE(SUM(CASE WHEN tm.id IS NOT NULL THEN t.amount ELSE 0 END), 0) as reconciliation_difference,
    
    -- Mapping statistics
    COUNT(CASE WHEN tm.mapping_type = 'automatic' THEN 1 END) as automatic_mappings,
    COUNT(CASE WHEN tm.mapping_type = 'manual' THEN 1 END) as manual_mappings,
    COUNT(CASE WHEN tm.reconciliation_status = 'discrepancy' THEN 1 END) as discrepancies,
    
    -- Date range
    MIN(bt.transaction_date) as earliest_transaction,
    MAX(bt.transaction_date) as latest_transaction,
    MAX(bt.imported_at) as last_import
    
FROM accounts a
LEFT JOIN bank_transactions bt ON a.id = bt.account_id
LEFT JOIN transaction_mappings tm ON bt.id = tm.bank_transaction_id
LEFT JOIN transactions t ON tm.transaction_id = t.id
WHERE a.is_external = true
  AND a.deleted_at IS NULL
GROUP BY a.id, a.user_id, a.account_name, a.external_bank_name;

-- Grant access to appropriate roles
GRANT SELECT ON transaction_reconciliation_status TO readonly_role;
```

---

## 5. Data Migration Scripts

### 5.1 Migration Script Template

```sql
-- Migration: Add bank integration tables
-- Version: 001
-- Date: 2024-XX-XX

BEGIN;

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add new columns to existing accounts table for bank integration
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS external_bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_accounts_external_bank ON accounts(external_bank_name) 
    WHERE external_bank_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_external_id ON accounts(external_account_id) 
    WHERE external_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_sync_enabled ON accounts(sync_enabled) 
    WHERE sync_enabled = true;

-- Update existing accounts to set sync_enabled based on is_external
UPDATE accounts 
SET sync_enabled = is_external 
WHERE is_external IS NOT NULL;

-- Add bank integration specific columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS external_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS import_source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS transaction_metadata JSONB;

-- Create indexes on new transaction columns
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_transaction_id) 
    WHERE external_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_import_source ON transactions(import_source);
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin ON transactions USING GIN(transaction_metadata) 
    WHERE transaction_metadata IS NOT NULL;

-- Create all new tables (as defined in sections 2.1-2.8 above)
-- ... (Include all CREATE TABLE statements from above)

-- Create all functions and views
-- ... (Include all function and view definitions from above)

-- Insert initial configuration data
INSERT INTO system_config (key, value, description) VALUES
('bank_integration_enabled', 'true', 'Enable bank integration features'),
('sync_frequency_hours', '4', 'Default synchronization frequency in hours'),
('balance_discrepancy_threshold', '1.00', 'Balance discrepancy threshold in CAD'),
('max_sync_retries', '3', 'Maximum number of sync retries before failure')
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

### 5.2 Data Cleanup and Maintenance

```sql
-- Scheduled maintenance procedures

-- Function to clean up old sync logs (older than 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM bank_sync_logs 
    WHERE started_at < (CURRENT_TIMESTAMP - INTERVAL '1 year');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO system_logs (level, message, metadata)
    VALUES ('INFO', 'Cleaned up old sync logs', jsonb_build_object('deleted_count', deleted_count));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old bank transactions (older than 7 years for compliance)
CREATE OR REPLACE FUNCTION archive_old_bank_transactions()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move old transactions to archive table
    INSERT INTO bank_transactions_archive 
    SELECT * FROM bank_transactions 
    WHERE transaction_date < (CURRENT_DATE - INTERVAL '7 years');
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Delete from main table
    DELETE FROM bank_transactions 
    WHERE transaction_date < (CURRENT_DATE - INTERVAL '7 years');
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance jobs (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sync-logs', '0 2 * * 0', 'SELECT cleanup_old_sync_logs();');
-- SELECT cron.schedule('archive-transactions', '0 3 1 1 *', 'SELECT archive_old_bank_transactions();');
```

This comprehensive database schema provides the foundation for secure, scalable, and compliant bank integration within DwayBank's existing infrastructure, with proper audit trails, performance optimization, and regulatory compliance support.