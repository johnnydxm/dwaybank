-- ============================================================================
-- DWAYBANK SMART WALLET - USERS TABLE MIGRATION
-- ============================================================================
-- Migration: 001_create_users_table
-- Description: Create users table with comprehensive security and audit features
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    email CITEXT NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    
    -- Status and Verification
    status user_status NOT NULL DEFAULT 'pending',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_status kyc_status NOT NULL DEFAULT 'pending',
    
    -- Security Fields
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Profile Information
    profile_picture TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    
    -- Security Preferences
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    login_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    security_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Compliance and Risk
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    compliance_level VARCHAR(20) DEFAULT 'basic',
    
    -- Metadata
    registration_ip INET,
    registration_user_agent TEXT,
    referral_code VARCHAR(50),
    referred_by UUID REFERENCES users(id),
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Create indexes for optimal query performance
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_kyc_status ON users(kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login) WHERE last_login IS NOT NULL;
CREATE INDEX idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL;

-- Partial index for active users (most common queries)
CREATE INDEX idx_users_active ON users(id, email, status) 
WHERE status = 'active' AND deleted_at IS NULL;

-- Composite index for authentication queries
CREATE INDEX idx_users_auth ON users(email, password_hash, status) 
WHERE deleted_at IS NULL;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add constraints for data integrity
ALTER TABLE users ADD CONSTRAINT users_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE users ADD CONSTRAINT users_phone_format 
    CHECK (phone_number IS NULL OR phone_number ~* '^\+?[1-9]\d{1,14}$');

ALTER TABLE users ADD CONSTRAINT users_names_not_empty 
    CHECK (LENGTH(TRIM(first_name)) > 0 AND LENGTH(TRIM(last_name)) > 0);

ALTER TABLE users ADD CONSTRAINT users_password_hash_not_empty 
    CHECK (LENGTH(password_hash) >= 60); -- bcrypt hash length

ALTER TABLE users ADD CONSTRAINT users_timezone_valid 
    CHECK (timezone IS NULL OR LENGTH(timezone) > 0);

ALTER TABLE users ADD CONSTRAINT users_locale_valid 
    CHECK (locale IS NULL OR locale ~* '^[a-z]{2}(-[A-Z]{2})?$');

-- Create function to check account lockout
CREATE OR REPLACE FUNCTION is_account_locked(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT locked_until, failed_login_attempts 
    INTO user_record 
    FROM users 
    WHERE id = user_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN TRUE; -- User not found, treat as locked
    END IF;
    
    -- Check if account is temporarily locked
    IF user_record.locked_until IS NOT NULL AND user_record.locked_until > CURRENT_TIMESTAMP THEN
        RETURN TRUE;
    END IF;
    
    -- Check if account has too many failed attempts
    IF user_record.failed_login_attempts >= 5 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle failed login attempts
CREATE OR REPLACE FUNCTION handle_failed_login(user_email CITEXT)
RETURNS VOID AS $$
DECLARE
    current_attempts INTEGER;
    lockout_duration INTERVAL;
BEGIN
    -- Get current failed attempts
    SELECT failed_login_attempts INTO current_attempts
    FROM users 
    WHERE email = user_email AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN; -- User not found
    END IF;
    
    -- Increment failed attempts
    current_attempts := current_attempts + 1;
    
    -- Calculate lockout duration (exponential backoff)
    lockout_duration := CASE 
        WHEN current_attempts >= 5 THEN INTERVAL '30 minutes'
        WHEN current_attempts >= 3 THEN INTERVAL '5 minutes'
        ELSE INTERVAL '0 minutes'
    END;
    
    -- Update user record
    UPDATE users 
    SET 
        failed_login_attempts = current_attempts,
        locked_until = CASE 
            WHEN lockout_duration > INTERVAL '0 minutes' 
            THEN CURRENT_TIMESTAMP + lockout_duration
            ELSE locked_until
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE email = user_email AND deleted_at IS NULL;
    
    -- Log security event
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    SELECT 'users', 'SECURITY_EVENT', id, jsonb_build_object(
        'event', 'failed_login',
        'email', user_email,
        'attempts', current_attempts,
        'locked_until', locked_until
    )
    FROM users 
    WHERE email = user_email AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle successful login
CREATE OR REPLACE FUNCTION handle_successful_login(user_email CITEXT, login_ip INET, user_agent TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET 
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE email = user_email AND deleted_at IS NULL;
    
    -- Log security event
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    SELECT 'users', 'SECURITY_EVENT', id, jsonb_build_object(
        'event', 'successful_login',
        'email', user_email,
        'ip_address', login_ip,
        'user_agent', user_agent
    )
    FROM users 
    WHERE email = user_email AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON users TO dwaybank;
GRANT USAGE ON SEQUENCE users_id_seq TO dwaybank;

-- Create comments for documentation
COMMENT ON TABLE users IS 'Core users table with security, compliance, and audit features';
COMMENT ON COLUMN users.id IS 'Primary key - UUID v4';
COMMENT ON COLUMN users.email IS 'User email address (case-insensitive, unique)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password';
COMMENT ON COLUMN users.status IS 'Account status: pending, active, suspended, closed';
COMMENT ON COLUMN users.kyc_status IS 'KYC verification status';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account lockout expiration timestamp';
COMMENT ON COLUMN users.risk_score IS 'User risk score (0-100, higher = more risk)';
COMMENT ON COLUMN users.compliance_level IS 'Compliance tier: basic, enhanced, premium';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "001_create_users_table", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_create_users_table completed successfully';
    RAISE NOTICE 'Created users table with % indexes and % triggers', 
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'users'),
        (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'users'::regclass);
END $$;