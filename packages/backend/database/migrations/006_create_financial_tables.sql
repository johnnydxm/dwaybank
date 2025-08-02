-- ============================================================================
-- DWAYBANK SMART WALLET - FINANCIAL TABLES MIGRATION
-- ============================================================================
-- Migration: 006_create_financial_tables
-- Description: Create accounts, transactions, budgets, goals, and payment methods tables
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Account Information
    account_number VARCHAR(16) NOT NULL UNIQUE,
    account_type account_type NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    institution_name VARCHAR(100),
    
    -- Balances (stored in cents for precision)
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Status and Flags
    status account_status NOT NULL DEFAULT 'active',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- External Account Details
    routing_number VARCHAR(9),
    external_bank_name VARCHAR(100),
    external_account_id VARCHAR(100),
    
    -- Account Limits
    daily_limit DECIMAL(15,2),
    monthly_limit DECIMAL(15,2),
    overdraft_limit DECIMAL(15,2) DEFAULT 0.00,
    
    -- Security and Compliance
    requires_additional_auth BOOLEAN NOT NULL DEFAULT FALSE,
    risk_level INTEGER DEFAULT 0 CHECK (risk_level >= 0 AND risk_level <= 100),
    
    -- Interest and Fees
    interest_rate DECIMAL(5,4) DEFAULT 0.0000,
    monthly_fee DECIMAL(8,2) DEFAULT 0.00,
    overdraft_fee DECIMAL(8,2) DEFAULT 0.00,
    
    -- Account Metadata
    account_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT accounts_balance_valid CHECK (balance >= -overdraft_limit),
    CONSTRAINT accounts_available_balance_valid CHECK (available_balance >= -overdraft_limit),
    CONSTRAINT accounts_currency_valid CHECK (LENGTH(currency) = 3),
    CONSTRAINT accounts_routing_number_valid CHECK (routing_number IS NULL OR LENGTH(routing_number) = 9),
    CONSTRAINT accounts_one_primary_per_user EXCLUDE (user_id WITH =) WHERE (is_primary = TRUE AND deleted_at IS NULL)
);

-- Create indexes for accounts
CREATE INDEX idx_accounts_user_id ON accounts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_account_number ON accounts(account_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_type ON accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_status ON accounts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_is_primary ON accounts(user_id, is_primary) WHERE is_primary = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_accounts_external ON accounts(external_account_id) WHERE external_account_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- TRANSACTION CATEGORIES TABLE
-- ============================================================================
CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Category Information
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'category',
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280', -- Hex color code
    description TEXT,
    
    -- Hierarchy
    parent_category_id UUID REFERENCES transaction_categories(id),
    category_path TEXT[], -- For efficient hierarchy queries
    
    -- Category Settings
    is_system_category BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    -- Budget Defaults
    default_budget_limit DECIMAL(10,2),
    
    -- Category Metadata
    category_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT transaction_categories_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT transaction_categories_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT transaction_categories_no_self_reference CHECK (id != parent_category_id)
);

-- Create indexes for transaction categories
CREATE INDEX idx_transaction_categories_name ON transaction_categories(name) WHERE is_active = TRUE;
CREATE INDEX idx_transaction_categories_parent ON transaction_categories(parent_category_id);
CREATE INDEX idx_transaction_categories_system ON transaction_categories(is_system_category);
CREATE INDEX idx_transaction_categories_path_gin ON transaction_categories USING GIN(category_path);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Account Reference
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Transaction Details
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    
    -- Transaction Information
    description TEXT NOT NULL,
    merchant_name VARCHAR(200),
    reference_id VARCHAR(32) UNIQUE DEFAULT generate_reference_id(),
    external_transaction_id VARCHAR(100),
    
    -- Category and Classification
    category_id UUID REFERENCES transaction_categories(id),
    tags TEXT[] DEFAULT '{}',
    
    -- Financial Details
    balance_after DECIMAL(15,2),
    fee_amount DECIMAL(8,2) DEFAULT 0.00,
    exchange_rate DECIMAL(10,6),
    original_amount DECIMAL(15,2),
    original_currency VARCHAR(3),
    
    -- Location Information
    location_latitude DECIMAL(10,8),
    location_longitude DECIMAL(11,8),
    location_address TEXT,
    
    -- Timing
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    posted_date TIMESTAMP WITH TIME ZONE,
    pending BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Related Transactions
    transfer_pair_id UUID, -- For internal transfers
    parent_transaction_id UUID REFERENCES transactions(id), -- For split transactions
    
    -- Security and Compliance
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Transaction Metadata
    transaction_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT transactions_currency_valid CHECK (LENGTH(currency) = 3),
    CONSTRAINT transactions_exchange_rate_positive CHECK (exchange_rate IS NULL OR exchange_rate > 0),
    CONSTRAINT transactions_fee_non_negative CHECK (fee_amount >= 0),
    CONSTRAINT transactions_location_valid CHECK (
        (location_latitude IS NULL AND location_longitude IS NULL) OR
        (location_latitude BETWEEN -90 AND 90 AND location_longitude BETWEEN -180 AND 180)
    ),
    CONSTRAINT transactions_no_self_reference CHECK (id != parent_transaction_id)
);

-- Create indexes for transactions
CREATE INDEX idx_transactions_account_id ON transactions(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_type ON transactions(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_status ON transactions(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category_id ON transactions(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_date ON transactions(transaction_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_pending ON transactions(pending) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_reference_id ON transactions(reference_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_external_id ON transactions(external_transaction_id) WHERE external_transaction_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_transactions_transfer_pair ON transactions(transfer_pair_id) WHERE transfer_pair_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_transactions_parent ON transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;
CREATE INDEX idx_transactions_tags_gin ON transactions USING GIN(tags);
CREATE INDEX idx_transactions_metadata_gin ON transactions USING GIN(transaction_metadata);

-- Composite indexes for common queries
CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_account_status ON transactions(account_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- BUDGETS TABLE
-- ============================================================================
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User and Category
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES transaction_categories(id),
    
    -- Budget Details
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    spent DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    period budget_period NOT NULL,
    
    -- Budget Timeframe
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Notifications and Alerts
    alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    alert_threshold_percentage INTEGER DEFAULT 80 CHECK (alert_threshold_percentage BETWEEN 1 AND 100),
    last_alert_sent TIMESTAMP WITH TIME ZONE,
    
    -- Budget Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Budget Metadata
    budget_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT budgets_amount_positive CHECK (amount > 0),
    CONSTRAINT budgets_spent_non_negative CHECK (spent >= 0),
    CONSTRAINT budgets_date_range_valid CHECK (end_date >= start_date),
    CONSTRAINT budgets_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT budgets_unique_user_category_period UNIQUE (user_id, category_id, period, start_date)
);

-- Create indexes for budgets
CREATE INDEX idx_budgets_user_id ON budgets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_category_id ON budgets(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_period ON budgets(period, start_date, end_date) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_budgets_active ON budgets(user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_alerts ON budgets(alerts_enabled, alert_threshold_percentage) WHERE alerts_enabled = TRUE AND deleted_at IS NULL;

-- ============================================================================
-- GOALS TABLE
-- ============================================================================
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Goal Information
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    
    -- Goal Amounts
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    
    -- Goal Timeline
    target_date DATE,
    achieved_date DATE,
    
    -- Goal Status and Settings
    status goal_status NOT NULL DEFAULT 'active',
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Contribution Settings
    auto_contribute BOOLEAN NOT NULL DEFAULT FALSE,
    auto_contribute_amount DECIMAL(10,2),
    auto_contribute_frequency recurring_frequency,
    
    -- Goal Metadata
    goal_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT goals_target_amount_positive CHECK (target_amount > 0),
    CONSTRAINT goals_current_amount_non_negative CHECK (current_amount >= 0),
    CONSTRAINT goals_current_not_exceed_target CHECK (current_amount <= target_amount),
    CONSTRAINT goals_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT goals_auto_contribute_settings CHECK (
        (auto_contribute = FALSE) OR 
        (auto_contribute = TRUE AND auto_contribute_amount > 0 AND auto_contribute_frequency IS NOT NULL)
    )
);

-- Create indexes for goals
CREATE INDEX idx_goals_user_id ON goals(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_status ON goals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_category ON goals(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_target_date ON goals(target_date) WHERE target_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_goals_priority ON goals(priority, target_date) WHERE status = 'active' AND deleted_at IS NULL;

-- ============================================================================
-- PAYMENT METHODS TABLE
-- ============================================================================
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payment Method Information
    type payment_method_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Card/Account Details (encrypted)
    encrypted_number TEXT, -- Last 4 digits + encrypted full number
    last_four VARCHAR(4),
    expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year INTEGER CHECK (expiry_year >= EXTRACT(YEAR FROM CURRENT_DATE)),
    
    -- Bank Account Details
    routing_number VARCHAR(9),
    account_number_hash TEXT, -- Hashed for security
    
    -- Brand and Institution
    brand VARCHAR(50), -- Visa, Mastercard, etc.
    institution_name VARCHAR(100),
    
    -- Status and Settings
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Verification
    verification_amount_1 DECIMAL(4,2), -- Micro-deposit verification
    verification_amount_2 DECIMAL(4,2),
    verification_attempts INTEGER DEFAULT 0,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- External Integration
    external_payment_method_id VARCHAR(100),
    provider_name VARCHAR(50), -- Stripe, Plaid, etc.
    
    -- Payment Method Metadata
    payment_method_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT payment_methods_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT payment_methods_last_four_format CHECK (last_four IS NULL OR last_four ~* '^[0-9]{4}$'),
    CONSTRAINT payment_methods_routing_number_format CHECK (routing_number IS NULL OR LENGTH(routing_number) = 9),
    CONSTRAINT payment_methods_verification_amounts CHECK (
        (verification_amount_1 IS NULL AND verification_amount_2 IS NULL) OR
        (verification_amount_1 IS NOT NULL AND verification_amount_2 IS NOT NULL AND 
         verification_amount_1 != verification_amount_2 AND 
         verification_amount_1 BETWEEN 0.01 AND 0.99 AND 
         verification_amount_2 BETWEEN 0.01 AND 0.99)
    ),
    CONSTRAINT payment_methods_one_default_per_user EXCLUDE (user_id WITH =) WHERE (is_default = TRUE AND deleted_at IS NULL)
);

-- Create indexes for payment methods
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_type ON payment_methods(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_payment_methods_verified ON payment_methods(is_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_external_id ON payment_methods(external_payment_method_id) WHERE external_payment_method_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Content
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority NOT NULL DEFAULT 'medium',
    
    -- Notification Status
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Related Objects
    related_object_type VARCHAR(50), -- 'transaction', 'account', 'budget', etc.
    related_object_id UUID,
    action_url TEXT,
    
    -- Notification Metadata
    notification_metadata JSONB DEFAULT '{}',
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT notifications_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT notifications_message_not_empty CHECK (LENGTH(TRIM(message)) > 0)
);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_read ON notifications(user_id, read) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_priority ON notifications(priority, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_related_object ON notifications(related_object_type, related_object_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- SECURITY ALERTS TABLE
-- ============================================================================
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Alert Information
    type security_alert_type NOT NULL,
    severity security_alert_severity NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Alert Status
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    
    -- Related Information
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    location TEXT,
    
    -- Alert Metadata
    alert_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT security_alerts_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT security_alerts_description_not_empty CHECK (LENGTH(TRIM(description)) > 0)
);

-- Create indexes for security alerts
CREATE INDEX idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_type ON security_alerts(type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_resolved ON security_alerts(resolved, created_at);
CREATE INDEX idx_security_alerts_ip_address ON security_alerts(ip_address);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Add update timestamp triggers
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_categories_updated_at
    BEFORE UPDATE ON transaction_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_alerts_updated_at
    BEFORE UPDATE ON security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add audit triggers
CREATE TRIGGER accounts_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER transactions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER budgets_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER goals_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER payment_methods_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add transaction balance update trigger
CREATE TRIGGER transactions_balance_trigger
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance();

-- Insert default transaction categories
INSERT INTO transaction_categories (id, name, icon, color, is_system_category) VALUES
(uuid_generate_v4(), 'Food & Dining', 'utensils', '#F59E0B', TRUE),
(uuid_generate_v4(), 'Transportation', 'car', '#3B82F6', TRUE),
(uuid_generate_v4(), 'Shopping', 'shopping-bag', '#EC4899', TRUE),
(uuid_generate_v4(), 'Entertainment', 'film', '#8B5CF6', TRUE),
(uuid_generate_v4(), 'Bills & Utilities', 'receipt', '#EF4444', TRUE),
(uuid_generate_v4(), 'Healthcare', 'heart', '#10B981', TRUE),
(uuid_generate_v4(), 'Education', 'book-open', '#F97316', TRUE),
(uuid_generate_v4(), 'Travel', 'plane', '#06B6D4', TRUE),
(uuid_generate_v4(), 'Income', 'trending-up', '#22C55E', TRUE),
(uuid_generate_v4(), 'Transfers', 'arrow-right-left', '#6B7280', TRUE),
(uuid_generate_v4(), 'Other', 'folder', '#9CA3AF', TRUE);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dwaybank;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dwaybank;

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "006_create_financial_tables", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 006_create_financial_tables completed successfully';
    RAISE NOTICE 'Created financial tables: accounts, transactions, categories, budgets, goals, payment_methods, notifications, security_alerts';
    RAISE NOTICE 'Inserted % default transaction categories', 
        (SELECT COUNT(*) FROM transaction_categories WHERE is_system_category = TRUE);
END $$;