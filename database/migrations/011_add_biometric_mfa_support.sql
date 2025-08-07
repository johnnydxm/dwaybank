-- Migration: Add Biometric MFA Support
-- Description: Adds support for biometric authentication (TouchID/FaceID)

BEGIN;

-- Add biometric challenge storage table
CREATE TABLE IF NOT EXISTS biometric_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL,
    challenge_id UUID NOT NULL UNIQUE,
    challenge_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to MFA config
    CONSTRAINT fk_biometric_challenges_config 
        FOREIGN KEY (config_id) 
        REFERENCES mfa_configs(id) 
        ON DELETE CASCADE
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_biometric_challenges_config_id 
    ON biometric_challenges(config_id);
CREATE INDEX IF NOT EXISTS idx_biometric_challenges_expires_at 
    ON biometric_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_biometric_challenges_challenge_id 
    ON biometric_challenges(challenge_id);

-- Update MFA configs table to support biometric method if not already present
DO $$
BEGIN
    -- Check if biometric is already in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'biometric' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'mfa_method'
        )
    ) THEN
        -- Add biometric to the enum if it doesn't exist
        ALTER TYPE mfa_method ADD VALUE 'biometric';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- If enum doesn't exist, create it with all values
    CREATE TYPE mfa_method AS ENUM ('totp', 'sms', 'email', 'biometric');
END $$;

-- Ensure MFA configs table exists with proper structure
CREATE TABLE IF NOT EXISTS mfa_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    method mfa_method NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    encrypted_secret TEXT, -- For TOTP secret storage
    backup_codes JSONB, -- For backup codes storage
    backup_codes_used INTEGER DEFAULT 0,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_mfa_configs_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT chk_mfa_sms_phone 
        CHECK (method != 'sms' OR phone_number IS NOT NULL),
    CONSTRAINT chk_mfa_email_address 
        CHECK (method != 'email' OR email IS NOT NULL),
    CONSTRAINT chk_mfa_totp_secret 
        CHECK (method != 'totp' OR encrypted_secret IS NOT NULL)
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_mfa_configs_user_id 
    ON mfa_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_configs_method 
    ON mfa_configs(method);
CREATE INDEX IF NOT EXISTS idx_mfa_configs_primary 
    ON mfa_configs(user_id, is_primary) 
    WHERE is_primary = true;

-- Ensure temp_verification_codes table exists
CREATE TABLE IF NOT EXISTS temp_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL,
    code VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attempts INTEGER DEFAULT 0,
    
    -- Foreign key to MFA config
    CONSTRAINT fk_temp_codes_config 
        FOREIGN KEY (config_id) 
        REFERENCES mfa_configs(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate codes per config
    CONSTRAINT uk_temp_codes_config 
        UNIQUE (config_id)
);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_temp_verification_codes_expires_at 
    ON temp_verification_codes(expires_at);

-- Create cleanup function for expired biometric challenges
CREATE OR REPLACE FUNCTION cleanup_expired_biometric_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM biometric_challenges 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM temp_verification_codes 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON biometric_challenges TO dwaybank_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON temp_verification_codes TO dwaybank_user;
GRANT USAGE ON SCHEMA public TO dwaybank_user;

-- Add comments for documentation
COMMENT ON TABLE biometric_challenges IS 'Temporary storage for biometric authentication challenges';
COMMENT ON COLUMN biometric_challenges.challenge_data IS 'JSON data containing challenge, algorithm, and verification parameters';
COMMENT ON COLUMN biometric_challenges.expires_at IS 'Challenge expiration timestamp (typically 5 minutes)';

COMMENT ON TABLE temp_verification_codes IS 'Temporary storage for SMS and Email verification codes';
COMMENT ON COLUMN temp_verification_codes.code IS 'Verification code sent to user';
COMMENT ON COLUMN temp_verification_codes.method IS 'Delivery method: sms or email';

COMMIT;