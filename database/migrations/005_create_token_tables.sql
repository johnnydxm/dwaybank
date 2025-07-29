-- Migration: Create password reset and email verification token tables
-- Version: 005
-- Description: Add token management tables for authentication workflows

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_password_reset_user UNIQUE (user_id), -- One active token per user
    CONSTRAINT ck_password_reset_expires CHECK (expires_at > created_at)
);

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_email_verification_user UNIQUE (user_id), -- One active token per user
    CONSTRAINT ck_email_verification_expires CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);

-- Add password_changed_at column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Create cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- Cleanup expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Cleanup expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL;
    
    GET DIAGNOSTICS expired_count = expired_count + ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled cleanup job (if pg_cron is available)
-- This would typically be set up manually or via external scheduling
-- SELECT cron.schedule('cleanup-tokens', '0 */6 * * *', 'SELECT cleanup_expired_tokens();');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO dwaybank_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_verification_tokens TO dwaybank_app;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO dwaybank_app;

-- Add comments for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores temporary tokens for password reset functionality';
COMMENT ON TABLE email_verification_tokens IS 'Stores temporary tokens for email verification functionality';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired and used authentication tokens';

-- Log migration completion
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES (5, 'Create password reset and email verification token tables', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;