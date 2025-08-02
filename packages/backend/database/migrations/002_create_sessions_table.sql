-- ============================================================================
-- DWAYBANK SMART WALLET - SESSIONS TABLE MIGRATION
-- ============================================================================
-- Migration: 002_create_sessions_table
-- Description: Create sessions table for JWT token management and user session tracking
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- Create sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User and Session Identification
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE, -- External session identifier
    
    -- Token Management
    refresh_token_hash VARCHAR(255) NOT NULL,
    token_family VARCHAR(255) NOT NULL, -- For token family validation
    access_token_jti VARCHAR(255), -- JWT ID for access token
    
    -- Session Metadata
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    device_fingerprint VARCHAR(255),
    
    -- Geographic and Device Information
    country_code VARCHAR(2),
    city VARCHAR(100),
    device_type VARCHAR(50), -- mobile, desktop, tablet, api
    browser VARCHAR(50),
    os VARCHAR(50),
    
    -- Session Status and Lifecycle
    status session_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Security Features
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Tracking
    login_method VARCHAR(50), -- password, mfa, sso, api_key
    scope TEXT[], -- JWT scopes/permissions
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoked_reason VARCHAR(100)
);

-- Create indexes for optimal performance
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX idx_sessions_token_family ON user_sessions(token_family);
CREATE INDEX idx_sessions_access_token_jti ON user_sessions(access_token_jti) WHERE access_token_jti IS NOT NULL;
CREATE INDEX idx_sessions_status ON user_sessions(status);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_last_used ON user_sessions(last_used);
CREATE INDEX idx_sessions_ip_address ON user_sessions(ip_address);
-- Full text search index for user agent (commented out for simplicity)
-- CREATE INDEX idx_sessions_user_agent ON user_sessions USING gin(to_tsvector('english', user_agent));
CREATE INDEX idx_sessions_device_fingerprint ON user_sessions(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX idx_sessions_created_at ON user_sessions(created_at);
CREATE INDEX idx_sessions_revoked_at ON user_sessions(revoked_at) WHERE revoked_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, status) 
WHERE status = 'active';

CREATE INDEX idx_sessions_cleanup ON user_sessions(expires_at, status) 
WHERE status IN ('expired', 'revoked');

CREATE INDEX idx_sessions_security ON user_sessions(user_id, ip_address, is_suspicious);

-- Partial index for active sessions
CREATE INDEX idx_sessions_active_by_user ON user_sessions(user_id, last_used) 
WHERE status = 'active';

-- Create triggers
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sessions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add constraints
ALTER TABLE user_sessions ADD CONSTRAINT sessions_session_id_not_empty 
    CHECK (LENGTH(TRIM(session_id)) > 0);

ALTER TABLE user_sessions ADD CONSTRAINT sessions_refresh_token_not_empty 
    CHECK (LENGTH(TRIM(refresh_token_hash)) > 0);

ALTER TABLE user_sessions ADD CONSTRAINT sessions_token_family_not_empty 
    CHECK (LENGTH(TRIM(token_family)) > 0);

ALTER TABLE user_sessions ADD CONSTRAINT sessions_expires_future 
    CHECK (expires_at > created_at);

ALTER TABLE user_sessions ADD CONSTRAINT sessions_last_used_valid 
    CHECK (last_used >= created_at);

ALTER TABLE user_sessions ADD CONSTRAINT sessions_revoked_consistency 
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR 
           (revoked_at IS NOT NULL AND status = 'revoked'));

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Update expired sessions
    UPDATE user_sessions 
    SET 
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Log cleanup activity
    IF cleanup_count > 0 THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES ('user_sessions', 'CLEANUP', uuid_generate_v4(), 
            jsonb_build_object('expired_sessions', cleanup_count, 'timestamp', CURRENT_TIMESTAMP));
    END IF;
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke user sessions
CREATE OR REPLACE FUNCTION revoke_user_sessions(
    target_user_id UUID, 
    exclude_session_id VARCHAR DEFAULT NULL,
    revoke_reason VARCHAR DEFAULT 'user_logout'
)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET 
        status = 'revoked',
        revoked_at = CURRENT_TIMESTAMP,
        revoked_by = target_user_id,
        revoked_reason = revoke_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = target_user_id 
    AND status = 'active'
    AND (exclude_session_id IS NULL OR session_id != exclude_session_id);
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    
    -- Log revocation
    IF revoked_count > 0 THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES ('user_sessions', 'REVOKE', target_user_id, 
            jsonb_build_object(
                'revoked_sessions', revoked_count, 
                'reason', revoke_reason,
                'excluded_session', exclude_session_id
            ));
    END IF;
    
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to detect suspicious sessions
CREATE OR REPLACE FUNCTION detect_suspicious_session(
    target_user_id UUID,
    new_ip INET,
    new_user_agent TEXT,
    new_device_fingerprint VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    recent_sessions_count INTEGER;
    different_ip_count INTEGER;
    different_device_count INTEGER;
    is_suspicious BOOLEAN := FALSE;
BEGIN
    -- Count recent sessions (last 24 hours)
    SELECT COUNT(*) INTO recent_sessions_count
    FROM user_sessions
    WHERE user_id = target_user_id
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND status = 'active';
    
    -- Count different IPs in last 24 hours
    SELECT COUNT(DISTINCT ip_address) INTO different_ip_count
    FROM user_sessions
    WHERE user_id = target_user_id
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    -- Count different device fingerprints
    SELECT COUNT(DISTINCT device_fingerprint) INTO different_device_count
    FROM user_sessions
    WHERE user_id = target_user_id
    AND device_fingerprint IS NOT NULL
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    -- Determine if session is suspicious
    IF recent_sessions_count > 10 OR 
       different_ip_count > 5 OR 
       different_device_count > 3 THEN
        is_suspicious := TRUE;
    END IF;
    
    -- Log suspicious activity
    IF is_suspicious THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES ('user_sessions', 'SUSPICIOUS_ACTIVITY', target_user_id, 
            jsonb_build_object(
                'recent_sessions', recent_sessions_count,
                'different_ips', different_ip_count,
                'different_devices', different_device_count,
                'new_ip', new_ip,
                'risk_factors', jsonb_build_array(
                    CASE WHEN recent_sessions_count > 10 THEN 'high_session_frequency' END,
                    CASE WHEN different_ip_count > 5 THEN 'multiple_ip_addresses' END,
                    CASE WHEN different_device_count > 3 THEN 'multiple_devices' END
                )
            ));
    END IF;
    
    RETURN is_suspicious;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get active session count for user
CREATE OR REPLACE FUNCTION get_active_session_count(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    session_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO session_count
    FROM user_sessions
    WHERE user_id = target_user_id
    AND status = 'active'
    AND expires_at > CURRENT_TIMESTAMP;
    
    RETURN session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(
    target_session_id VARCHAR,
    new_access_token_jti VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    session_found BOOLEAN := FALSE;
BEGIN
    UPDATE user_sessions
    SET 
        last_used = CURRENT_TIMESTAMP,
        access_token_jti = COALESCE(new_access_token_jti, access_token_jti),
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = target_session_id
    AND status = 'active'
    AND expires_at > CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS session_found = ROW_COUNT;
    
    RETURN session_found > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO dwaybank;

-- Create comments
COMMENT ON TABLE user_sessions IS 'User session management with JWT token tracking';
COMMENT ON COLUMN user_sessions.session_id IS 'External session identifier for client reference';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'Hashed refresh token for security';
COMMENT ON COLUMN user_sessions.token_family IS 'Token family for refresh token rotation';
COMMENT ON COLUMN user_sessions.access_token_jti IS 'JWT ID of current access token';
COMMENT ON COLUMN user_sessions.device_fingerprint IS 'Unique device identifier';
COMMENT ON COLUMN user_sessions.is_suspicious IS 'Flag for suspicious session activity';
COMMENT ON COLUMN user_sessions.risk_score IS 'Session risk score (0-100)';
COMMENT ON COLUMN user_sessions.scope IS 'JWT scopes/permissions for this session';

-- Create view for active sessions
CREATE VIEW active_user_sessions AS
SELECT 
    s.id,
    s.user_id,
    s.session_id,
    s.ip_address,
    s.user_agent,
    s.device_type,
    s.browser,
    s.os,
    s.country_code,
    s.city,
    s.created_at,
    s.last_used,
    s.expires_at,
    s.is_suspicious,
    s.risk_score,
    s.mfa_verified,
    u.email,
    u.first_name,
    u.last_name
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'active' 
AND s.expires_at > CURRENT_TIMESTAMP
AND u.deleted_at IS NULL;

COMMENT ON VIEW active_user_sessions IS 'View of currently active user sessions with user details';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "002_create_sessions_table", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 002_create_sessions_table completed successfully';
    RAISE NOTICE 'Created user_sessions table with % indexes and % functions', 
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'user_sessions'),
        (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%session%');
END $$;