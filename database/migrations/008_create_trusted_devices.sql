-- ============================================================================
-- DWAYBANK SMART WALLET - TRUSTED DEVICES MIGRATION
-- ============================================================================
-- Migration: 008_create_trusted_devices
-- Description: Create trusted devices tables for MFA bypass functionality
-- Author: DwayBank Security Team
-- Date: 2025-01-29

-- Create trust level enum
CREATE TYPE trust_level AS ENUM ('low', 'medium', 'high');

-- Create trusted devices table
CREATE TABLE trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Device identification
    device_fingerprint TEXT NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet', etc.
    
    -- Network information
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    
    -- Trust settings
    trust_level trust_level NOT NULL DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Security settings
    expires_at TIMESTAMP WITH TIME ZONE,
    max_ip_changes INTEGER DEFAULT 5,
    require_reauth_after_days INTEGER DEFAULT 30,
    
    -- Metadata
    notes TEXT,
    created_by UUID,
    revoked_by UUID,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trusted device usage log table
CREATE TABLE trusted_device_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES trusted_devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Access details
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    session_id VARCHAR(255),
    
    -- Security context
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create IP threat database table
CREATE TABLE ip_threat_database (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL UNIQUE,
    
    -- Threat information
    threat_level VARCHAR(20) NOT NULL CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
    threat_type VARCHAR(100) NOT NULL, -- 'malware', 'botnet', 'tor_exit', 'vpn', etc.
    confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Source information
    source VARCHAR(100) NOT NULL, -- 'internal', 'abuseipdb', 'virustotal', etc.
    source_reference TEXT,
    
    -- Temporal data
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal query performance
CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id) WHERE is_active = true;
CREATE INDEX idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint) WHERE is_active = true;
CREATE INDEX idx_trusted_devices_user_fingerprint ON trusted_devices(user_id, device_fingerprint) WHERE is_active = true;
CREATE INDEX idx_trusted_devices_expires_at ON trusted_devices(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_trusted_devices_last_used ON trusted_devices(last_used_at) WHERE last_used_at IS NOT NULL;

CREATE INDEX idx_trusted_device_usage_device_id ON trusted_device_usage(device_id);
CREATE INDEX idx_trusted_device_usage_user_id ON trusted_device_usage(user_id);
CREATE INDEX idx_trusted_device_usage_created_at ON trusted_device_usage(created_at);
CREATE INDEX idx_trusted_device_usage_ip_address ON trusted_device_usage(ip_address);

CREATE INDEX idx_ip_threat_database_ip ON ip_threat_database(ip_address);
CREATE INDEX idx_ip_threat_database_threat_level ON ip_threat_database(threat_level);
CREATE INDEX idx_ip_threat_database_expires_at ON ip_threat_database(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ip_threat_database_last_seen ON ip_threat_database(last_seen);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_trusted_devices_updated_at
    BEFORE UPDATE ON trusted_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ip_threat_database_updated_at
    BEFORE UPDATE ON ip_threat_database
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit triggers
CREATE TRIGGER trusted_devices_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON trusted_devices
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trusted_device_usage_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON trusted_device_usage
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add constraints for data integrity
ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_unique_user_fingerprint 
    UNIQUE (user_id, device_fingerprint);

ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_device_name_not_empty 
    CHECK (LENGTH(TRIM(device_name)) > 0);

ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_fingerprint_not_empty 
    CHECK (LENGTH(TRIM(device_fingerprint)) > 0);

ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_usage_count_non_negative 
    CHECK (usage_count >= 0);

ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_valid_ip_changes 
    CHECK (max_ip_changes IS NULL OR max_ip_changes >= 0);

ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_valid_reauth_days 
    CHECK (require_reauth_after_days IS NULL OR require_reauth_after_days >= 1);

-- Create function to clean up expired trusted devices
CREATE OR REPLACE FUNCTION cleanup_expired_trusted_devices()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark expired devices as inactive
    UPDATE trusted_devices 
    SET is_active = false,
        updated_at = CURRENT_TIMESTAMP,
        revoked_reason = 'expired'
    WHERE is_active = true 
    AND expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log cleanup action
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    VALUES ('trusted_devices', 'CLEANUP', uuid_generate_v4(), 
        jsonb_build_object('expired_devices', expired_count, 'timestamp', CURRENT_TIMESTAMP));
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke trusted device
CREATE OR REPLACE FUNCTION revoke_trusted_device(
    device_id UUID,
    revoked_by_user UUID,
    reason TEXT DEFAULT 'user_request'
)
RETURNS BOOLEAN AS $$
DECLARE
    device_exists BOOLEAN;
BEGIN
    -- Check if device exists and is active
    SELECT EXISTS(
        SELECT 1 FROM trusted_devices 
        WHERE id = device_id AND is_active = true
    ) INTO device_exists;
    
    IF NOT device_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Revoke the device
    UPDATE trusted_devices 
    SET is_active = false,
        revoked_by = revoked_by_user,
        revoked_at = CURRENT_TIMESTAMP,
        revoked_reason = reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = device_id;
    
    -- Log revocation
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    VALUES ('trusted_devices', 'REVOKE', device_id, 
        jsonb_build_object(
            'revoked_by', revoked_by_user,
            'reason', reason,
            'timestamp', CURRENT_TIMESTAMP
        ));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's trusted devices summary
CREATE OR REPLACE FUNCTION get_user_trusted_devices_summary(user_uuid UUID)
RETURNS TABLE (
    total_devices INTEGER,
    active_devices INTEGER,
    expired_devices INTEGER,
    last_used TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_devices,
        COUNT(CASE WHEN is_active = true THEN 1 END)::INTEGER as active_devices,
        COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END)::INTEGER as expired_devices,
        MAX(last_used_at) as last_used
    FROM trusted_devices
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for trusted device summary
CREATE VIEW trusted_device_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(td.id) as total_trusted_devices,
    COUNT(CASE WHEN td.is_active = true THEN 1 END) as active_trusted_devices,
    COUNT(CASE WHEN td.expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_devices,
    MAX(td.last_used_at) as last_device_usage,
    COUNT(tdu.id) as total_usage_events,
    AVG(tdu.risk_score) as avg_risk_score
FROM users u
LEFT JOIN trusted_devices td ON u.id = td.user_id
LEFT JOIN trusted_device_usage tdu ON td.id = tdu.device_id 
    AND tdu.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON trusted_devices TO dwaybank;
GRANT SELECT, INSERT ON trusted_device_usage TO dwaybank;
GRANT SELECT, INSERT, UPDATE ON ip_threat_database TO dwaybank;
GRANT SELECT ON trusted_device_summary TO dwaybank;

-- Add comments for documentation
COMMENT ON TABLE trusted_devices IS 'Devices trusted for MFA bypass with security controls';
COMMENT ON TABLE trusted_device_usage IS 'Log of trusted device usage for monitoring';
COMMENT ON TABLE ip_threat_database IS 'Internal threat intelligence database for IP addresses';

COMMENT ON COLUMN trusted_devices.device_fingerprint IS 'Unique device fingerprint for identification';
COMMENT ON COLUMN trusted_devices.trust_level IS 'Trust level: low, medium, high';
COMMENT ON COLUMN trusted_devices.max_ip_changes IS 'Maximum allowed IP changes before requiring reauth';
COMMENT ON COLUMN trusted_devices.require_reauth_after_days IS 'Days after which device requires fresh authentication';

COMMENT ON FUNCTION cleanup_expired_trusted_devices() IS 'Clean up expired trusted devices (run periodically)';
COMMENT ON FUNCTION revoke_trusted_device(UUID, UUID, TEXT) IS 'Revoke a trusted device with audit trail';
COMMENT ON VIEW trusted_device_summary IS 'Summary of trusted device usage by user';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "008_create_trusted_devices", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 008_create_trusted_devices completed successfully';
    RAISE NOTICE 'Created trusted devices system with % tables and % functions', 
        3,
        (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%trusted_device%');
END $$;