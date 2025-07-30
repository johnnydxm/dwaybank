-- ============================================================================
-- DWAYBANK SMART WALLET - DATABASE INITIALIZATION
-- ============================================================================
-- This file initializes the PostgreSQL database with extensions and basic setup
-- Executed automatically when PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create custom types
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'closed');
CREATE TYPE kyc_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'expired');
CREATE TYPE mfa_method AS ENUM ('totp', 'sms', 'email', 'biometric');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');

-- Create audit trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE dwaybank_dev TO dwaybank;
GRANT USAGE ON SCHEMA public TO dwaybank;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dwaybank;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dwaybank;

-- Log initialization completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'INIT', uuid_generate_v4(), '{"message": "Database initialized successfully"}');

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'DwayBank database initialized successfully with extensions and audit system';
END $$;