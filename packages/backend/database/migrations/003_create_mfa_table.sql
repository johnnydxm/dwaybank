-- ============================================================================
-- DWAYBANK SMART WALLET - MFA TABLE MIGRATION
-- ============================================================================
-- Migration: 003_create_mfa_table
-- Description: Create MFA configurations and verification attempts tables
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- Create MFA configurations table
CREATE TABLE mfa_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User and Method Information
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method mfa_method NOT NULL,
    
    -- Configuration Status
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Method-Specific Data (encrypted)
    secret_encrypted TEXT, -- TOTP secret (encrypted)
    phone_number VARCHAR(20), -- SMS phone number
    email CITEXT, -- Email for email-based MFA
    
    -- TOTP-Specific Configuration
    totp_algorithm VARCHAR(10) DEFAULT 'SHA1', -- SHA1, SHA256, SHA512
    totp_digits INTEGER DEFAULT 6 CHECK (totp_digits IN (6, 8)),
    totp_period INTEGER DEFAULT 30 CHECK (totp_period > 0),
    
    -- Backup Codes (encrypted JSON array)
    backup_codes_encrypted TEXT,
    backup_codes_used INTEGER DEFAULT 0,
    
    -- Usage Statistics
    last_used TIMESTAMP WITH TIME ZONE,
    use_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Security
    device_binding_required BOOLEAN DEFAULT FALSE,
    allowed_devices TEXT[], -- Device fingerprints
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    disabled_at TIMESTAMP WITH TIME ZONE,
    disabled_reason VARCHAR(100),
    
    -- Ensure only one primary MFA per user
    CONSTRAINT mfa_one_primary_per_user EXCLUDE (user_id WITH =) WHERE (is_primary = TRUE)
);

-- Create MFA verification attempts table
CREATE TABLE mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference Information
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mfa_config_id UUID REFERENCES mfa_configs(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    
    -- Attempt Details
    method mfa_method NOT NULL,
    code_provided VARCHAR(20) NOT NULL,
    is_backup_code BOOLEAN DEFAULT FALSE,
    
    -- Result
    is_successful BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    
    -- Security Context
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    device_fingerprint VARCHAR(255),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Geographic Information
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for mfa_configs
CREATE INDEX idx_mfa_configs_user_id ON mfa_configs(user_id);
CREATE INDEX idx_mfa_configs_method ON mfa_configs(method);
CREATE INDEX idx_mfa_configs_is_primary ON mfa_configs(is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_mfa_configs_is_enabled ON mfa_configs(is_enabled);
CREATE INDEX idx_mfa_configs_phone_number ON mfa_configs(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_mfa_configs_email ON mfa_configs(email) WHERE email IS NOT NULL;
CREATE INDEX idx_mfa_configs_last_used ON mfa_configs(last_used) WHERE last_used IS NOT NULL;
CREATE INDEX idx_mfa_configs_created_at ON mfa_configs(created_at);
CREATE INDEX idx_mfa_configs_verified_at ON mfa_configs(verified_at) WHERE verified_at IS NOT NULL;

-- Composite indexes for mfa_configs
CREATE INDEX idx_mfa_configs_user_enabled ON mfa_configs(user_id, method) WHERE is_enabled = TRUE;
CREATE INDEX idx_mfa_configs_user_primary ON mfa_configs(user_id, method) WHERE is_primary = TRUE;

-- Create indexes for mfa_verification_attempts
CREATE INDEX idx_mfa_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX idx_mfa_attempts_config_id ON mfa_verification_attempts(mfa_config_id);
CREATE INDEX idx_mfa_attempts_session_id ON mfa_verification_attempts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_mfa_attempts_method ON mfa_verification_attempts(method);
CREATE INDEX idx_mfa_attempts_successful ON mfa_verification_attempts(is_successful);
CREATE INDEX idx_mfa_attempts_ip_address ON mfa_verification_attempts(ip_address);
CREATE INDEX idx_mfa_attempts_created_at ON mfa_verification_attempts(created_at);
CREATE INDEX idx_mfa_attempts_verified_at ON mfa_verification_attempts(verified_at) WHERE verified_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_mfa_attempts_user_recent ON mfa_verification_attempts(user_id, created_at DESC);
CREATE INDEX idx_mfa_attempts_security ON mfa_verification_attempts(user_id, ip_address, is_successful);
CREATE INDEX idx_mfa_attempts_device ON mfa_verification_attempts(device_fingerprint, created_at) WHERE device_fingerprint IS NOT NULL;

-- Create triggers
CREATE TRIGGER update_mfa_configs_updated_at
    BEFORE UPDATE ON mfa_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER mfa_configs_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON mfa_configs
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER mfa_attempts_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON mfa_verification_attempts
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add constraints for mfa_configs
ALTER TABLE mfa_configs ADD CONSTRAINT mfa_phone_format 
    CHECK (phone_number IS NULL OR phone_number ~* '^\+?[1-9]\d{1,14}$');

ALTER TABLE mfa_configs ADD CONSTRAINT mfa_email_format 
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE mfa_configs ADD CONSTRAINT mfa_totp_algorithm_valid 
    CHECK (totp_algorithm IN ('SHA1', 'SHA256', 'SHA512'));

ALTER TABLE mfa_configs ADD CONSTRAINT mfa_method_data_consistency
    CHECK (
        (method = 'totp' AND secret_encrypted IS NOT NULL) OR
        (method = 'sms' AND phone_number IS NOT NULL) OR
        (method = 'email' AND email IS NOT NULL) OR
        (method = 'biometric')
    );

-- Add constraints for mfa_verification_attempts
ALTER TABLE mfa_verification_attempts ADD CONSTRAINT mfa_attempts_code_not_empty 
    CHECK (LENGTH(TRIM(code_provided)) > 0);

-- Create function to get user's MFA methods
CREATE OR REPLACE FUNCTION get_user_mfa_methods(target_user_id UUID)
RETURNS TABLE(
    config_id UUID,
    method mfa_method,
    is_primary BOOLEAN,
    is_enabled BOOLEAN,
    last_used TIMESTAMP WITH TIME ZONE,
    phone_number VARCHAR(20),
    email CITEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.method,
        mc.is_primary,
        mc.is_enabled,
        mc.last_used,
        mc.phone_number,
        mc.email
    FROM mfa_configs mc
    WHERE mc.user_id = target_user_id
    AND mc.is_enabled = TRUE
    ORDER BY mc.is_primary DESC, mc.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate MFA attempt rate limiting
CREATE OR REPLACE FUNCTION check_mfa_rate_limit(
    target_user_id UUID,
    client_ip INET,
    window_minutes INTEGER DEFAULT 15,
    max_attempts INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    -- Count failed attempts in the time window
    SELECT COUNT(*) INTO attempt_count
    FROM mfa_verification_attempts
    WHERE user_id = target_user_id
    AND ip_address = client_ip
    AND is_successful = FALSE
    AND created_at > CURRENT_TIMESTAMP - (window_minutes || ' minutes')::INTERVAL;
    
    RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record MFA attempt
CREATE OR REPLACE FUNCTION record_mfa_attempt(
    target_user_id UUID,
    target_mfa_config_id UUID,
    attempt_method mfa_method,
    provided_code VARCHAR,
    is_backup BOOLEAN,
    is_success BOOLEAN,
    client_ip INET,
    client_user_agent TEXT,
    client_device_fingerprint VARCHAR DEFAULT NULL,
    failure_reason VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    attempt_id UUID;
BEGIN
    -- Insert verification attempt
    INSERT INTO mfa_verification_attempts (
        user_id,
        mfa_config_id,
        method,
        code_provided,
        is_backup_code,
        is_successful,
        failure_reason,
        ip_address,
        user_agent,
        device_fingerprint,
        verified_at
    ) VALUES (
        target_user_id,
        target_mfa_config_id,
        attempt_method,
        provided_code,
        is_backup,
        is_success,
        failure_reason,
        client_ip,
        client_user_agent,
        client_device_fingerprint,
        CASE WHEN is_success THEN CURRENT_TIMESTAMP ELSE NULL END
    ) RETURNING id INTO attempt_id;
    
    -- Update MFA config statistics if successful
    IF is_success THEN
        UPDATE mfa_configs 
        SET 
            last_used = CURRENT_TIMESTAMP,
            use_count = use_count + 1,
            success_count = success_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = target_mfa_config_id;
        
        -- If backup code was used, increment counter
        IF is_backup THEN
            UPDATE mfa_configs 
            SET backup_codes_used = backup_codes_used + 1
            WHERE id = target_mfa_config_id;
        END IF;
    ELSE
        -- Update failure count
        UPDATE mfa_configs 
        SET 
            failure_count = failure_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = target_mfa_config_id;
    END IF;
    
    RETURN attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate backup codes (placeholder - actual generation in application)
CREATE OR REPLACE FUNCTION generate_backup_codes_placeholder(target_mfa_config_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- This function would be called after backup codes are generated in the application
    UPDATE mfa_configs 
    SET 
        backup_codes_used = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_mfa_config_id;
    
    -- Log backup codes regeneration
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    VALUES ('mfa_configs', 'BACKUP_CODES_REGENERATED', target_mfa_config_id, 
        jsonb_build_object('timestamp', CURRENT_TIMESTAMP));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to disable MFA method
CREATE OR REPLACE FUNCTION disable_mfa_method(
    target_mfa_config_id UUID,
    disable_reason VARCHAR DEFAULT 'user_request'
)
RETURNS BOOLEAN AS $$
DECLARE
    config_found BOOLEAN := FALSE;
BEGIN
    UPDATE mfa_configs 
    SET 
        is_enabled = FALSE,
        is_primary = FALSE,
        disabled_at = CURRENT_TIMESTAMP,
        disabled_reason = disable_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_mfa_config_id;
    
    GET DIAGNOSTICS config_found = FOUND;
    
    IF config_found THEN
        -- Log MFA method disabled
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES ('mfa_configs', 'DISABLED', target_mfa_config_id, 
            jsonb_build_object('reason', disable_reason, 'timestamp', CURRENT_TIMESTAMP));
    END IF;
    
    RETURN config_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_configs TO dwaybank;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_verification_attempts TO dwaybank;

-- Create comments
COMMENT ON TABLE mfa_configs IS 'Multi-factor authentication method configurations';
COMMENT ON TABLE mfa_verification_attempts IS 'MFA verification attempt log with security tracking';
COMMENT ON COLUMN mfa_configs.secret_encrypted IS 'Encrypted TOTP secret key';
COMMENT ON COLUMN mfa_configs.backup_codes_encrypted IS 'Encrypted JSON array of backup codes';
COMMENT ON COLUMN mfa_configs.device_binding_required IS 'Whether MFA requires specific device';
COMMENT ON COLUMN mfa_configs.allowed_devices IS 'Array of allowed device fingerprints';
COMMENT ON COLUMN mfa_verification_attempts.risk_score IS 'Risk score for this verification attempt';

-- Create view for MFA statistics
CREATE VIEW mfa_user_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(mc.id) as total_methods,
    COUNT(CASE WHEN mc.is_enabled THEN 1 END) as enabled_methods,
    COUNT(CASE WHEN mc.is_primary THEN 1 END) as primary_methods,
    ARRAY_AGG(DISTINCT mc.method) FILTER (WHERE mc.is_enabled) as active_methods,
    MAX(mc.last_used) as last_mfa_used,
    SUM(mc.success_count) as total_success_count,
    SUM(mc.failure_count) as total_failure_count
FROM users u
LEFT JOIN mfa_configs mc ON u.id = mc.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email;

COMMENT ON VIEW mfa_user_stats IS 'MFA statistics and status per user';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "003_create_mfa_table", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 003_create_mfa_table completed successfully';
    RAISE NOTICE 'Created MFA tables with % indexes and % functions', 
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename LIKE 'mfa_%'),
        (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%mfa%');
END $$;