-- ================================================================
-- Migration: 010_create_payment_methods.sql
-- Description: Create payment methods and notifications for Smart Wallet MVP
-- Version: 1.0.0
-- Date: 2025-08-03
-- ================================================================

BEGIN;

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    
    -- Payment method details
    method_type VARCHAR(50) NOT NULL CHECK (method_type IN (
        'apple_pay', 'google_pay', 'credit_card', 'debit_card', 
        'bank_account', 'crypto_wallet', 'paypal', 'venmo'
    )),
    provider VARCHAR(100) NOT NULL, -- Apple, Google, Visa, MasterCard, etc.
    
    -- Card/Account information (encrypted)
    encrypted_number TEXT, -- Encrypted card number or account number
    last_4_digits VARCHAR(4) NOT NULL,
    expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year INTEGER,
    cardholder_name VARCHAR(255),
    
    -- Bank account specific
    bank_name VARCHAR(255),
    account_type VARCHAR(20) CHECK (account_type IN ('checking', 'savings', 'credit')),
    routing_number VARCHAR(50),
    
    -- Crypto wallet specific
    blockchain_network VARCHAR(50), -- ethereum, polygon, bitcoin, etc.
    wallet_address VARCHAR(255),
    
    -- Status and verification
    is_verified BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'verified', 'failed', 'expired', 'requires_action')
    ),
    
    -- Security tokens
    payment_token TEXT, -- Tokenized payment data
    device_fingerprint VARCHAR(255),
    
    -- Risk assessment
    risk_score DECIMAL(3,2) DEFAULT 0.00 CHECK (risk_score BETWEEN 0.00 AND 1.00),
    risk_factors JSONB,
    
    -- Metadata
    metadata JSONB,
    external_id VARCHAR(255), -- ID from payment processor
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for payment_methods
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_wallet_id ON payment_methods(wallet_id);
CREATE INDEX idx_payment_methods_type ON payment_methods(method_type);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active) WHERE is_active = true;
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_payment_methods_last_4 ON payment_methods(last_4_digits);
CREATE INDEX idx_payment_methods_verification ON payment_methods(verification_status);

-- Unique constraint: one default payment method per user
CREATE UNIQUE INDEX idx_payment_methods_user_default 
ON payment_methods(user_id) 
WHERE is_default = true;

-- Create payment_attempts table for transaction processing
CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    
    -- Payment details
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    description TEXT,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'succeeded', 'failed', 'cancelled', 
        'requires_action', 'refunded', 'disputed'
    )),
    
    -- External payment processor data
    processor VARCHAR(50), -- stripe, square, paypal, etc.
    processor_payment_id VARCHAR(255),
    processor_response JSONB,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    decline_reason VARCHAR(100),
    
    -- Fraud detection
    fraud_score DECIMAL(3,2) DEFAULT 0.00 CHECK (fraud_score BETWEEN 0.00 AND 1.00),
    fraud_indicators JSONB,
    
    -- Fees
    platform_fee DECIMAL(15,2) DEFAULT 0.00,
    processor_fee DECIMAL(15,2) DEFAULT 0.00,
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for payment_attempts
CREATE INDEX idx_payment_attempts_user_id ON payment_attempts(user_id);
CREATE INDEX idx_payment_attempts_method_id ON payment_attempts(payment_method_id);
CREATE INDEX idx_payment_attempts_transaction_id ON payment_attempts(wallet_transaction_id);
CREATE INDEX idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX idx_payment_attempts_processor ON payment_attempts(processor);
CREATE INDEX idx_payment_attempts_processor_id ON payment_attempts(processor_payment_id);
CREATE INDEX idx_payment_attempts_initiated_at ON payment_attempts(initiated_at DESC);

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'wallet_connected', 'wallet_sync_failed', 'transaction_received', 
        'payment_completed', 'payment_failed', 'security_alert',
        'balance_low', 'large_transaction', 'new_device_login',
        'verification_required', 'account_locked'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Delivery channels
    channels JSONB NOT NULL DEFAULT '["in_app"]', -- in_app, email, sms, push
    
    -- Related entities
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    payment_attempt_id UUID REFERENCES payment_attempts(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'
    )),
    
    -- Priority and scheduling
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    delivery_errors JSONB,
    
    -- Metadata
    metadata JSONB,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user_notifications
CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_type ON user_notifications(notification_type);
CREATE INDEX idx_user_notifications_status ON user_notifications(status);
CREATE INDEX idx_user_notifications_priority ON user_notifications(priority);
CREATE INDEX idx_user_notifications_scheduled_at ON user_notifications(scheduled_at);
CREATE INDEX idx_user_notifications_wallet_id ON user_notifications(wallet_id);
CREATE INDEX idx_user_notifications_read_at ON user_notifications(read_at) WHERE read_at IS NULL;

-- Create user_preferences table for notification settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification preferences
    email_notifications_enabled BOOLEAN DEFAULT true,
    sms_notifications_enabled BOOLEAN DEFAULT false,
    push_notifications_enabled BOOLEAN DEFAULT true,
    
    -- Specific notification types
    transaction_notifications BOOLEAN DEFAULT true,
    security_notifications BOOLEAN DEFAULT true,
    marketing_notifications BOOLEAN DEFAULT false,
    wallet_sync_notifications BOOLEAN DEFAULT true,
    
    -- Thresholds
    large_transaction_threshold DECIMAL(15,2) DEFAULT 1000.00,
    low_balance_threshold DECIMAL(15,2) DEFAULT 100.00,
    
    -- Security preferences
    biometric_auth_enabled BOOLEAN DEFAULT false,
    two_factor_auth_required BOOLEAN DEFAULT false,
    auto_logout_minutes INTEGER DEFAULT 30 CHECK (auto_logout_minutes BETWEEN 5 AND 1440),
    
    -- Wallet sync preferences
    auto_sync_frequency_minutes INTEGER DEFAULT 60 CHECK (auto_sync_frequency_minutes >= 5),
    sync_all_wallets BOOLEAN DEFAULT true,
    
    -- UI preferences
    currency_display VARCHAR(10) DEFAULT 'USD',
    language_preference VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    theme_preference VARCHAR(20) DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'auto')),
    
    -- Privacy preferences
    data_sharing_analytics BOOLEAN DEFAULT true,
    data_sharing_marketing BOOLEAN DEFAULT false,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for user_preferences
CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Create triggers for updated_at fields
CREATE TRIGGER trigger_update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER trigger_update_payment_attempts_updated_at
    BEFORE UPDATE ON payment_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER trigger_update_user_notifications_updated_at
    BEFORE UPDATE ON user_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER trigger_update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

-- Create function to automatically create user preferences
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create default preferences for new users
CREATE TRIGGER trigger_create_default_user_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_preferences();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_methods TO dwaybank_prod_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_attempts TO dwaybank_prod_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_notifications TO dwaybank_prod_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO dwaybank_prod_user;

-- Add comments for documentation
COMMENT ON TABLE payment_methods IS 'Stores user payment methods for Smart Wallet transactions';
COMMENT ON TABLE payment_attempts IS 'Tracks payment processing attempts and results';
COMMENT ON TABLE user_notifications IS 'Manages user notifications across multiple channels';
COMMENT ON TABLE user_preferences IS 'Stores user preferences for notifications, security, and UI';

COMMIT;