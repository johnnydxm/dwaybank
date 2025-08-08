-- ============================================================================
-- DWAYBANK SMART WALLET - WALLET INTEGRATION TABLES MIGRATION
-- ============================================================================
-- Migration: 007_create_wallet_integration_tables
-- Description: Create wallet connections, payment methods, balances, and transaction tables for wallet aggregation
-- Author: DwayBank Backend Specialist
-- Date: 2025-01-31

-- ============================================================================
-- WALLET CONNECTIONS TABLE
-- ============================================================================
CREATE TABLE wallet_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Wallet Information
    wallet_type VARCHAR(20) NOT NULL CHECK (wallet_type IN ('apple_pay', 'google_pay', 'metamask', 'samsung_pay', 'paypal', 'manual')),
    external_wallet_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    
    -- Connection Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending_auth' CHECK (status IN ('connected', 'disconnected', 'syncing', 'error', 'pending_auth')),
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_frequency INTEGER DEFAULT 30, -- minutes
    sync_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Authentication
    access_token TEXT, -- encrypted
    refresh_token TEXT, -- encrypted  
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Settings
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT wallet_connections_display_name_not_empty CHECK (LENGTH(TRIM(display_name)) > 0),
    CONSTRAINT wallet_connections_external_wallet_id_not_empty CHECK (LENGTH(TRIM(external_wallet_id)) > 0),
    CONSTRAINT wallet_connections_sync_frequency_positive CHECK (sync_frequency > 0),
    CONSTRAINT wallet_connections_one_primary_per_user EXCLUDE (user_id WITH =) WHERE (is_primary = TRUE AND deleted_at IS NULL),
    CONSTRAINT wallet_connections_unique_external_id UNIQUE (wallet_type, external_wallet_id)
);

-- Create indexes for wallet connections
CREATE INDEX idx_wallet_connections_user_id ON wallet_connections(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_connections_wallet_type ON wallet_connections(wallet_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_connections_status ON wallet_connections(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_connections_sync_due ON wallet_connections(last_sync, sync_frequency) WHERE auto_sync_enabled = TRUE AND status = 'connected' AND deleted_at IS NULL;
CREATE INDEX idx_wallet_connections_external_id ON wallet_connections(external_wallet_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- WALLET PAYMENT METHODS TABLE
-- ============================================================================
CREATE TABLE wallet_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Wallet Connection Reference
    wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id) ON DELETE CASCADE,
    
    -- External Payment Method Reference
    external_method_id VARCHAR(255) NOT NULL,
    
    -- Payment Method Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit_card', 'debit_card', 'bank_account', 'crypto_wallet', 'digital_wallet')),
    display_name VARCHAR(100) NOT NULL,
    
    -- Card Details (for card types)
    last_four_digits VARCHAR(4),
    card_brand VARCHAR(20), -- visa, mastercard, amex, discover, etc.
    expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year INTEGER CHECK (expiry_year >= EXTRACT(YEAR FROM CURRENT_DATE)),
    
    -- Account Details
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT wallet_payment_methods_display_name_not_empty CHECK (LENGTH(TRIM(display_name)) > 0),
    CONSTRAINT wallet_payment_methods_external_method_id_not_empty CHECK (LENGTH(TRIM(external_method_id)) > 0),
    CONSTRAINT wallet_payment_methods_currency_valid CHECK (LENGTH(currency) = 3),
    CONSTRAINT wallet_payment_methods_last_four_format CHECK (last_four_digits IS NULL OR last_four_digits ~* '^[0-9]{4}$'),
    CONSTRAINT wallet_payment_methods_unique_external_id UNIQUE (wallet_connection_id, external_method_id)
);

-- Create indexes for wallet payment methods
CREATE INDEX idx_wallet_payment_methods_wallet_connection_id ON wallet_payment_methods(wallet_connection_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_payment_methods_type ON wallet_payment_methods(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_payment_methods_active ON wallet_payment_methods(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_payment_methods_external_id ON wallet_payment_methods(external_method_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_payment_methods_card_brand ON wallet_payment_methods(card_brand) WHERE card_brand IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- WALLET BALANCES TABLE
-- ============================================================================
CREATE TABLE wallet_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Payment Method Reference
    payment_method_id UUID NOT NULL REFERENCES wallet_payment_methods(id) ON DELETE CASCADE,
    
    -- Balance Information
    current_balance DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Exchange Rate (for non-USD currencies)
    exchange_rate_usd DECIMAL(18,8),
    balance_usd DECIMAL(18,8),
    
    -- Balance Source
    balance_source VARCHAR(10) NOT NULL DEFAULT 'api' CHECK (balance_source IN ('api', 'cache', 'manual')),
    
    -- Timestamps
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    api_response_time INTEGER, -- milliseconds
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT wallet_balances_currency_valid CHECK (LENGTH(currency) = 3),
    CONSTRAINT wallet_balances_exchange_rate_positive CHECK (exchange_rate_usd IS NULL OR exchange_rate_usd > 0),
    CONSTRAINT wallet_balances_api_response_time_positive CHECK (api_response_time IS NULL OR api_response_time >= 0)
);

-- Create indexes for wallet balances
CREATE INDEX idx_wallet_balances_payment_method_id ON wallet_balances(payment_method_id);
CREATE INDEX idx_wallet_balances_last_updated ON wallet_balances(last_updated);
CREATE INDEX idx_wallet_balances_currency ON wallet_balances(currency);
CREATE INDEX idx_wallet_balances_balance_source ON wallet_balances(balance_source);

-- ============================================================================
-- WALLET TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Wallet Connection Reference
    wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id) ON DELETE CASCADE,
    
    -- Payment Method Reference (optional for wallet-level transactions)
    payment_method_id UUID REFERENCES wallet_payment_methods(id) ON DELETE SET NULL,
    
    -- External Transaction Reference
    external_transaction_id VARCHAR(255) NOT NULL,
    
    -- Transaction Details
    amount DECIMAL(18,8) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    
    -- Merchant Information
    merchant_name VARCHAR(200),
    merchant_category VARCHAR(100),
    
    -- Transaction Classification
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'transfer', 'fee')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    
    -- Timing
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    posted_date TIMESTAMP WITH TIME ZONE,
    
    -- Exchange Rate (for non-USD currencies)
    exchange_rate_usd DECIMAL(18,8),
    amount_usd DECIMAL(18,8),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT wallet_transactions_description_not_empty CHECK (LENGTH(TRIM(description)) > 0),
    CONSTRAINT wallet_transactions_external_transaction_id_not_empty CHECK (LENGTH(TRIM(external_transaction_id)) > 0),
    CONSTRAINT wallet_transactions_currency_valid CHECK (LENGTH(currency) = 3),
    CONSTRAINT wallet_transactions_exchange_rate_positive CHECK (exchange_rate_usd IS NULL OR exchange_rate_usd > 0),
    CONSTRAINT wallet_transactions_unique_external_id UNIQUE (wallet_connection_id, external_transaction_id)
);

-- Create indexes for wallet transactions
CREATE INDEX idx_wallet_transactions_wallet_connection_id ON wallet_transactions(wallet_connection_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_payment_method_id ON wallet_transactions(payment_method_id) WHERE payment_method_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_transaction_date ON wallet_transactions(transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_external_id ON wallet_transactions(external_transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_merchant ON wallet_transactions(merchant_name) WHERE merchant_name IS NOT NULL AND deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_wallet_transactions_wallet_date ON wallet_transactions(wallet_connection_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallet_transactions_method_date ON wallet_transactions(payment_method_id, transaction_date DESC) WHERE payment_method_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- WALLET SYNC LOG TABLE (for debugging and monitoring)
-- ============================================================================
CREATE TABLE wallet_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Wallet Connection Reference
    wallet_connection_id UUID NOT NULL REFERENCES wallet_connections(id) ON DELETE CASCADE,
    
    -- Sync Information
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('manual', 'automatic', 'scheduled')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
    
    -- Sync Results
    payment_methods_found INTEGER DEFAULT 0,
    payment_methods_updated INTEGER DEFAULT 0,
    transactions_found INTEGER DEFAULT 0,
    transactions_updated INTEGER DEFAULT 0,
    balances_updated INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Error Information
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT wallet_sync_log_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT wallet_sync_log_counts_non_negative CHECK (
        payment_methods_found >= 0 AND payment_methods_updated >= 0 AND
        transactions_found >= 0 AND transactions_updated >= 0 AND balances_updated >= 0
    )
);

-- Create indexes for wallet sync log
CREATE INDEX idx_wallet_sync_log_wallet_connection_id ON wallet_sync_log(wallet_connection_id);
CREATE INDEX idx_wallet_sync_log_status ON wallet_sync_log(status);
CREATE INDEX idx_wallet_sync_log_started_at ON wallet_sync_log(started_at DESC);
CREATE INDEX idx_wallet_sync_log_sync_type ON wallet_sync_log(sync_type);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Add update timestamp triggers
CREATE TRIGGER update_wallet_connections_updated_at
    BEFORE UPDATE ON wallet_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_payment_methods_updated_at
    BEFORE UPDATE ON wallet_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate USD balance
CREATE OR REPLACE FUNCTION update_balance_usd()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exchange_rate_usd IS NOT NULL THEN
        NEW.balance_usd = NEW.current_balance * NEW.exchange_rate_usd;
    ELSIF NEW.currency = 'USD' THEN
        NEW.balance_usd = NEW.current_balance;
        NEW.exchange_rate_usd = 1.0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate USD balance
CREATE TRIGGER wallet_balances_calculate_usd
    BEFORE INSERT OR UPDATE ON wallet_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_balance_usd();

-- Function to calculate USD transaction amount
CREATE OR REPLACE FUNCTION update_transaction_amount_usd()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exchange_rate_usd IS NOT NULL THEN
        NEW.amount_usd = NEW.amount * NEW.exchange_rate_usd;
    ELSIF NEW.currency = 'USD' THEN
        NEW.amount_usd = NEW.amount;
        NEW.exchange_rate_usd = 1.0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate USD transaction amount
CREATE TRIGGER wallet_transactions_calculate_usd
    BEFORE INSERT OR UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_amount_usd();

-- Function to update wallet connection sync status
CREATE OR REPLACE FUNCTION update_wallet_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_sync and sync_count when sync completes successfully
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE wallet_connections 
        SET last_sync = NEW.completed_at,
            sync_count = sync_count + 1,
            status = 'connected',
            error_message = NULL
        WHERE id = NEW.wallet_connection_id;
    
    -- Update error status when sync fails
    ELSIF NEW.status = 'failed' THEN
        UPDATE wallet_connections 
        SET status = 'error',
            error_message = NEW.error_message
        WHERE id = NEW.wallet_connection_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update wallet connection status based on sync results
CREATE TRIGGER wallet_sync_log_update_connection_status
    AFTER INSERT OR UPDATE ON wallet_sync_log
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_sync_status();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for wallet dashboard data
CREATE VIEW wallet_dashboard_view AS
SELECT 
    wc.user_id,
    wc.id as wallet_connection_id,
    wc.wallet_type,
    wc.display_name as wallet_name,
    wc.status as wallet_status,
    wc.last_sync,
    COUNT(wpm.id) as payment_methods_count,
    COALESCE(SUM(wb.balance_usd), 0) as total_balance_usd,
    MAX(wt.transaction_date) as last_transaction_date
FROM wallet_connections wc
LEFT JOIN wallet_payment_methods wpm ON wc.id = wpm.wallet_connection_id AND wpm.deleted_at IS NULL
LEFT JOIN wallet_balances wb ON wpm.id = wb.payment_method_id
LEFT JOIN wallet_transactions wt ON wc.id = wt.wallet_connection_id AND wt.deleted_at IS NULL
WHERE wc.deleted_at IS NULL
GROUP BY wc.user_id, wc.id, wc.wallet_type, wc.display_name, wc.status, wc.last_sync;

-- View for payment methods with current balances
CREATE VIEW payment_methods_with_balances AS
SELECT 
    wpm.id,
    wpm.wallet_connection_id,
    wpm.external_method_id,
    wpm.type,
    wpm.display_name,
    wpm.last_four_digits,
    wpm.card_brand,
    wpm.currency,
    wpm.is_active,
    wb.current_balance,
    wb.available_balance,
    wb.pending_balance,
    wb.balance_usd,
    wb.last_updated as balance_last_updated,
    wb.balance_source
FROM wallet_payment_methods wpm
LEFT JOIN wallet_balances wb ON wpm.id = wb.payment_method_id
WHERE wpm.deleted_at IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dwaybank;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dwaybank;
GRANT SELECT ON wallet_dashboard_view TO dwaybank;
GRANT SELECT ON payment_methods_with_balances TO dwaybank;

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "007_create_wallet_integration_tables", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 007_create_wallet_integration_tables completed successfully';
    RAISE NOTICE 'Created wallet integration tables: wallet_connections, wallet_payment_methods, wallet_balances, wallet_transactions, wallet_sync_log';
    RAISE NOTICE 'Created views: wallet_dashboard_view, payment_methods_with_balances';
    RAISE NOTICE 'Added triggers for automatic USD calculations and sync status updates';
END $$;