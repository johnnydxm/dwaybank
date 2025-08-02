-- ============================================================================
-- DWAYBANK SMART WALLET - DATABASE SETUP MIGRATION
-- ============================================================================
-- Migration: 000_setup_database
-- Description: Create database extensions, types, enums, and base functions
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- Extensions should be created by database administrator
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "citext";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- CREATE EXTENSION IF NOT EXISTS "btree_gin";
-- CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types and enums
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE mfa_method AS ENUM ('totp', 'sms', 'email', 'backup_codes', 'hardware_key');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('checking', 'savings', 'investment', 'credit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('bank_account', 'credit_card', 'debit_card', 'digital_wallet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('transaction', 'security', 'budget', 'goal', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE security_alert_type AS ENUM ('suspicious_login', 'unusual_transaction', 'location_change', 'device_change');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE security_alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE goal_status AS ENUM ('active', 'completed', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE device_type AS ENUM ('mobile', 'desktop', 'tablet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE insight_type AS ENUM ('spending_pattern', 'saving_opportunity', 'budget_alert', 'investment_tip');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE insight_impact AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create audit log table for all database changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(64) NOT NULL,
    operation VARCHAR(16) NOT NULL, -- INSERT, UPDATE, DELETE, SECURITY_EVENT
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_session_id ON audit_log(session_id);

-- Create GIN index for JSON searches
CREATE INDEX idx_audit_log_old_values_gin ON audit_log USING GIN(old_values);
CREATE INDEX idx_audit_log_new_values_gin ON audit_log USING GIN(new_values);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[] := '{}';
    field_name TEXT;
BEGIN
    -- Determine operation and data
    IF TG_OP = 'DELETE' THEN
        old_data = row_to_json(OLD)::JSONB;
        new_data = NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_data = NULL;
        new_data = row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data = row_to_json(OLD)::JSONB;
        new_data = row_to_json(NEW)::JSONB;
        
        -- Find changed fields
        FOR field_name IN SELECT jsonb_object_keys(new_data) LOOP
            IF old_data->field_name IS DISTINCT FROM new_data->field_name THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;
    END IF;

    -- Insert audit record
    INSERT INTO audit_log (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        changed_fields,
        user_id,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        changed_fields,
        COALESCE(NEW.updated_by, OLD.updated_by),
        CURRENT_TIMESTAMP
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely convert text to UUID
CREATE OR REPLACE FUNCTION safe_uuid(input_text TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN input_text::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate account numbers
CREATE OR REPLACE FUNCTION generate_account_number(account_type_param account_type)
RETURNS VARCHAR(16) AS $$
DECLARE
    prefix VARCHAR(2);
    random_part VARCHAR(12);
    checksum INTEGER;
    account_number VARCHAR(16);
BEGIN
    -- Determine prefix based on account type
    prefix := CASE account_type_param
        WHEN 'checking' THEN '10'
        WHEN 'savings' THEN '20'
        WHEN 'investment' THEN '30'
        WHEN 'credit' THEN '40'
        ELSE '00'
    END;
    
    -- Generate random 12-digit number
    random_part := LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
    
    -- Calculate simple checksum (sum of digits mod 10)
    checksum := 0;
    FOR i IN 1..14 LOOP
        checksum := checksum + SUBSTRING(prefix || random_part, i, 1)::INTEGER;
    END LOOP;
    checksum := (10 - (checksum % 10)) % 10;
    
    account_number := prefix || random_part || checksum::TEXT;
    
    RETURN account_number;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to validate email format
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate phone number format
CREATE OR REPLACE FUNCTION is_valid_phone(phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN phone ~* '^\+?[1-9]\d{1,14}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate risk score based on transaction patterns
CREATE OR REPLACE FUNCTION calculate_risk_score(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    large_transactions INTEGER;
    failed_logins INTEGER;
    recent_location_changes INTEGER;
BEGIN
    -- Check for large transactions in last 30 days
    SELECT COUNT(*) INTO large_transactions
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.user_id = user_id_param
    AND t.amount > 10000
    AND t.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    risk_score := risk_score + (large_transactions * 10);
    
    -- Check for failed login attempts in last 24 hours
    SELECT failed_login_attempts INTO failed_logins
    FROM users
    WHERE id = user_id_param;
    
    risk_score := risk_score + (COALESCE(failed_logins, 0) * 5);
    
    -- Check for recent location changes
    SELECT COUNT(DISTINCT ip_address) INTO recent_location_changes
    FROM audit_log
    WHERE user_id = user_id_param
    AND operation = 'SECURITY_EVENT'
    AND new_values->>'event' = 'successful_login'
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    IF recent_location_changes > 3 THEN
        risk_score := risk_score + 15;
    END IF;
    
    -- Cap risk score at 100
    RETURN LEAST(risk_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate reference ID for transactions
CREATE OR REPLACE FUNCTION generate_reference_id()
RETURNS VARCHAR(32) AS $$
DECLARE
    timestamp_part VARCHAR(8);
    random_part VARCHAR(8);
    checksum VARCHAR(2);
    reference_id VARCHAR(32);
BEGIN
    -- Use current timestamp in hex
    timestamp_part := UPPER(TO_HEX(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT));
    
    -- Generate random part
    random_part := UPPER(TO_HEX(FLOOR(RANDOM() * 4294967295)::BIGINT));
    
    -- Simple checksum
    checksum := UPPER(TO_HEX((LENGTH(timestamp_part || random_part) % 256)::INTEGER));
    
    reference_id := 'TXN' || timestamp_part || random_part || LPAD(checksum, 2, '0');
    
    RETURN reference_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to check account balance
CREATE OR REPLACE FUNCTION get_account_balance(account_id_param UUID)
RETURNS TABLE(current_balance DECIMAL(15,2), available_balance DECIMAL(15,2), pending_balance DECIMAL(15,2)) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.balance as current_balance,
        a.available_balance,
        COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'pending' AND t.type = 'credit'), 0) -
        COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'pending' AND t.type = 'debit'), 0) as pending_balance
    FROM accounts a
    LEFT JOIN transactions t ON a.id = t.account_id
    WHERE a.id = account_id_param
    AND a.deleted_at IS NULL
    GROUP BY a.id, a.balance, a.available_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update account balance after transaction
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    balance_change DECIMAL(15,2);
    account_record RECORD;
BEGIN
    -- Determine balance change
    IF TG_OP = 'INSERT' THEN
        balance_change := CASE 
            WHEN NEW.type = 'credit' THEN NEW.amount
            WHEN NEW.type = 'debit' THEN -NEW.amount
            ELSE 0
        END;
        
        -- Only update balance for completed transactions
        IF NEW.status = 'completed' THEN
            -- Get current account info
            SELECT balance, available_balance INTO account_record
            FROM accounts WHERE id = NEW.account_id;
            
            -- Update account balance
            UPDATE accounts 
            SET 
                balance = balance + balance_change,
                available_balance = available_balance + balance_change,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.account_id;
            
            -- Update balance_after in transaction
            NEW.balance_after := account_record.balance + balance_change;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status != NEW.status THEN
            balance_change := CASE 
                WHEN NEW.type = 'credit' THEN NEW.amount
                WHEN NEW.type = 'debit' THEN -NEW.amount
                ELSE 0
            END;
            
            IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
                -- Transaction completed, add to balance
                UPDATE accounts 
                SET 
                    balance = balance + balance_change,
                    available_balance = available_balance + balance_change,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.account_id;
                
            ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
                -- Transaction reversed, subtract from balance
                UPDATE accounts 
                SET 
                    balance = balance - balance_change,
                    available_balance = available_balance - balance_change,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.account_id;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create role for application
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dwaybank') THEN
        CREATE ROLE dwaybank WITH LOGIN PASSWORD 'dwaybank_secure_2024';
    END IF;
END $$;

-- Grant permissions to application role
GRANT USAGE ON SCHEMA public TO dwaybank;
GRANT CREATE ON SCHEMA public TO dwaybank;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dwaybank;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dwaybank;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dwaybank;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dwaybank;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dwaybank;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO dwaybank;

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "000_setup_database", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 000_setup_database completed successfully';
    RAISE NOTICE 'Created % custom types, % functions, and base infrastructure', 
        (SELECT COUNT(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'),
        (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace);
END $$;