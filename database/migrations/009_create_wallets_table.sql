-- ================================================================
-- Migration: 009_create_wallets_table.sql
-- Description: Create wallets table for Smart Wallet MVP
-- Version: 1.0.0
-- Date: 2025-08-03
-- ================================================================

BEGIN;

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN ('apple_pay', 'google_pay', 'metamask', 'bank_account', 'crypto')),
    wallet_name VARCHAR(100) NOT NULL,
    
    -- Encrypted wallet data
    encrypted_credentials TEXT, -- Encrypted API keys, tokens, etc.
    public_address VARCHAR(255), -- For crypto wallets
    last_4_digits VARCHAR(4), -- For card/bank accounts
    
    -- Wallet metadata
    provider VARCHAR(100), -- Apple, Google, MetaMask, Chase Bank, etc.
    currency VARCHAR(10) DEFAULT 'USD',
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Balance information (cached)
    balance_amount DECIMAL(15,2) DEFAULT 0.00,
    balance_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Sync configuration
    auto_sync_enabled BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 60 CHECK (sync_frequency_minutes >= 5),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) DEFAULT 'pending' CHECK (last_sync_status IN ('success', 'failed', 'pending', 'syncing')),
    sync_error_message TEXT,
    
    -- Security
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'expired')),
    verification_data JSONB,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_type ON wallets(wallet_type);
CREATE INDEX idx_wallets_active ON wallets(is_active) WHERE is_active = true;
CREATE INDEX idx_wallets_primary ON wallets(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_wallets_sync_status ON wallets(last_sync_status);
CREATE INDEX idx_wallets_balance_updated ON wallets(balance_updated_at DESC);

-- Unique constraint: one primary wallet per user per type
CREATE UNIQUE INDEX idx_wallets_user_primary_type 
ON wallets(user_id, wallet_type) 
WHERE is_primary = true;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction identification
    external_transaction_id VARCHAR(255), -- ID from external provider
    transaction_hash VARCHAR(255), -- For blockchain transactions
    
    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'payment', 'refund', 'transfer_in', 'transfer_out', 
        'deposit', 'withdrawal', 'fee', 'reward'
    )),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    
    -- Transaction status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
    )),
    
    -- Counter-party information
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(100),
    recipient_address VARCHAR(255), -- For crypto transactions
    
    -- Transaction metadata
    description TEXT,
    transaction_data JSONB, -- Provider-specific data
    
    -- Fees
    fee_amount DECIMAL(15,2) DEFAULT 0.00,
    fee_currency VARCHAR(10) DEFAULT 'USD',
    
    -- Timestamps
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet_transactions
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_date ON wallet_transactions(transaction_date DESC);
CREATE INDEX idx_wallet_transactions_external_id ON wallet_transactions(external_transaction_id);
CREATE INDEX idx_wallet_transactions_hash ON wallet_transactions(transaction_hash);

-- Unique constraint for external transactions
CREATE UNIQUE INDEX idx_wallet_transactions_external_unique 
ON wallet_transactions(wallet_id, external_transaction_id) 
WHERE external_transaction_id IS NOT NULL;

-- Create wallet_sync_logs table for debugging
CREATE TABLE IF NOT EXISTS wallet_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) NOT NULL CHECK (sync_status IN ('started', 'completed', 'failed', 'timeout')),
    transactions_found INTEGER DEFAULT 0,
    transactions_processed INTEGER DEFAULT 0,
    transactions_new INTEGER DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER,
    api_calls_made INTEGER DEFAULT 0,
    
    -- Metadata
    sync_type VARCHAR(20) DEFAULT 'scheduled' CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
    sync_trigger VARCHAR(50), -- What triggered this sync
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet_sync_logs
CREATE INDEX idx_wallet_sync_logs_wallet_id ON wallet_sync_logs(wallet_id);
CREATE INDEX idx_wallet_sync_logs_status ON wallet_sync_logs(sync_status);
CREATE INDEX idx_wallet_sync_logs_started_at ON wallet_sync_logs(sync_started_at DESC);

-- Create trigger for wallet updated_at
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallet_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_updated_at();

-- Create trigger for wallet_transactions updated_at
CREATE OR REPLACE FUNCTION update_wallet_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallet_transaction_updated_at
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_transaction_updated_at();

-- Create function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(wallet_uuid UUID)
RETURNS VOID AS $$
DECLARE
    total_balance DECIMAL(15,2);
BEGIN
    -- Calculate balance from completed transactions
    SELECT COALESCE(SUM(
        CASE 
            WHEN transaction_type IN ('deposit', 'transfer_in', 'refund', 'reward') THEN amount
            WHEN transaction_type IN ('payment', 'withdrawal', 'transfer_out', 'fee') THEN -amount
            ELSE 0
        END
    ), 0.00) INTO total_balance
    FROM wallet_transactions 
    WHERE wallet_id = wallet_uuid 
    AND status = 'completed';
    
    -- Update wallet balance
    UPDATE wallets 
    SET balance_amount = total_balance,
        balance_updated_at = CURRENT_TIMESTAMP
    WHERE id = wallet_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update wallet balance when transactions change
CREATE OR REPLACE FUNCTION trigger_update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update balance for new/updated transactions
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_wallet_balance(NEW.wallet_id);
        RETURN NEW;
    END IF;
    
    -- Update balance for deleted transactions
    IF TG_OP = 'DELETE' THEN
        PERFORM update_wallet_balance(OLD.wallet_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallet_balance_update
    AFTER INSERT OR UPDATE OR DELETE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_wallet_balance();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON wallets TO dwaybank_prod_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_transactions TO dwaybank_prod_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_sync_logs TO dwaybank_prod_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dwaybank_prod_user;

-- Add comments for documentation
COMMENT ON TABLE wallets IS 'Stores user wallet connections and metadata for Smart Wallet MVP';
COMMENT ON TABLE wallet_transactions IS 'Stores transaction data synchronized from connected wallets';
COMMENT ON TABLE wallet_sync_logs IS 'Logs wallet synchronization operations for debugging and monitoring';
COMMENT ON FUNCTION update_wallet_balance(UUID) IS 'Updates wallet balance based on completed transactions';

COMMIT;