-- Migration: Create KYC (Know Your Customer) Tables
-- Description: Creates tables for KYC verification, document storage, and compliance tracking

BEGIN;

-- Create KYC verification status enum
CREATE TYPE kyc_verification_status AS ENUM (
    'pending',
    'approved', 
    'rejected',
    'requires_review'
);

-- Create document type enum
CREATE TYPE kyc_document_type AS ENUM (
    'passport',
    'drivers_license', 
    'national_id'
);

-- Create risk level enum
CREATE TYPE kyc_risk_level AS ENUM (
    'low',
    'medium',
    'high'
);

-- Create sanctions/PEP check status enum  
CREATE TYPE kyc_check_status AS ENUM (
    'clear',
    'match',
    'potential_match'
);

-- Main KYC verifications table
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_type kyc_document_type NOT NULL,
    status kyc_verification_status DEFAULT 'pending',
    risk_level kyc_risk_level DEFAULT 'medium',
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    extracted_data JSONB, -- Encrypted personal information extracted from documents
    risk_flags JSONB DEFAULT '[]'::jsonb, -- Array of risk indicators
    verification_details JSONB, -- Technical verification results
    metadata JSONB DEFAULT '{}'::jsonb, -- Submission metadata (IP, user agent, etc.)
    reviewer_id UUID, -- Admin who reviewed the verification
    reviewer_notes TEXT,
    estimated_review_time VARCHAR(50),
    next_steps JSONB, -- Array of next steps for user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    expires_at TIMESTAMP, -- For temporary verification states
    
    -- Foreign key constraints
    CONSTRAINT fk_kyc_verifications_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_kyc_verifications_reviewer 
        FOREIGN KEY (reviewer_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- KYC documents table (encrypted storage)
CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'document_front', 'document_back', 'selfie', 'address_proof'
    encrypted_data JSONB NOT NULL, -- Encrypted base64 image data with IV and auth tag
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity verification
    file_size INTEGER, -- Original file size in bytes
    mime_type VARCHAR(50), -- Detected MIME type
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP, -- Last time document was accessed
    retention_expires_at TIMESTAMP, -- Data retention expiry (GDPR compliance)
    
    -- Foreign key constraint
    CONSTRAINT fk_kyc_documents_verification 
        FOREIGN KEY (verification_id) 
        REFERENCES kyc_verifications(id) 
        ON DELETE CASCADE
);

-- KYC provider references (for tracking external provider references)
CREATE TABLE IF NOT EXISTS kyc_provider_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'jumio', 'onfido', 'mock'
    provider_reference VARCHAR(255) NOT NULL, -- External provider's verification ID
    provider_status VARCHAR(50), -- Provider's status
    provider_callback_data JSONB, -- Webhook/callback data from provider
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_kyc_provider_refs_verification 
        FOREIGN KEY (verification_id) 
        REFERENCES kyc_verifications(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint for provider references
    CONSTRAINT uk_kyc_provider_reference 
        UNIQUE (provider, provider_reference)
);

-- KYC audit trail for compliance tracking
CREATE TABLE IF NOT EXISTS kyc_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'status_updated', 'document_accessed', 'reviewed'
    performed_by UUID, -- User who performed the action
    previous_status kyc_verification_status,
    new_status kyc_verification_status,
    details JSONB, -- Additional action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_kyc_audit_verification 
        FOREIGN KEY (verification_id) 
        REFERENCES kyc_verifications(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_kyc_audit_user 
        FOREIGN KEY (performed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- AML (Anti-Money Laundering) checks tracking
CREATE TABLE IF NOT EXISTS kyc_aml_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- 'sanctions', 'pep', 'adverse_media'
    check_status kyc_check_status NOT NULL,
    provider VARCHAR(50), -- AML data provider
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    match_details JSONB, -- Details of any matches found
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- When check results expire and need refresh
    
    -- Foreign key constraint
    CONSTRAINT fk_kyc_aml_verification 
        FOREIGN KEY (verification_id) 
        REFERENCES kyc_verifications(id) 
        ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id 
    ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status 
    ON kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_risk_level 
    ON kyc_verifications(risk_level);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_created_at 
    ON kyc_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_expires_at 
    ON kyc_verifications(expires_at) 
    WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_documents_verification_id 
    ON kyc_documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_retention_expires_at 
    ON kyc_documents(retention_expires_at) 
    WHERE retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_provider_refs_verification_id 
    ON kyc_provider_references(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_provider_refs_provider 
    ON kyc_provider_references(provider);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_verification_id 
    ON kyc_audit_trail(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_created_at 
    ON kyc_audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_action 
    ON kyc_audit_trail(action);

CREATE INDEX IF NOT EXISTS idx_kyc_aml_verification_id 
    ON kyc_aml_checks(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_aml_check_type 
    ON kyc_aml_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_kyc_aml_expires_at 
    ON kyc_aml_checks(expires_at) 
    WHERE expires_at IS NOT NULL;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status_risk 
    ON kyc_verifications(status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_status 
    ON kyc_verifications(user_id, status, created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kyc_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_kyc_verification_updated_at();

-- Trigger to create audit trail entries
CREATE OR REPLACE FUNCTION create_kyc_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert audit entry for status changes
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO kyc_audit_trail (
            verification_id,
            action,
            performed_by,
            previous_status,
            new_status,
            details
        ) VALUES (
            NEW.id,
            'status_updated',
            NEW.reviewer_id,
            OLD.status,
            NEW.status,
            jsonb_build_object(
                'confidence_score', NEW.confidence_score,
                'risk_level', NEW.risk_level,
                'has_reviewer_notes', (NEW.reviewer_notes IS NOT NULL)
            )
        );
    END IF;
    
    -- Insert audit entry for new verifications
    IF TG_OP = 'INSERT' THEN
        INSERT INTO kyc_audit_trail (
            verification_id,
            action,
            details
        ) VALUES (
            NEW.id,
            'created',
            jsonb_build_object(
                'document_type', NEW.document_type,
                'user_id', NEW.user_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kyc_audit_trail
    AFTER INSERT OR UPDATE ON kyc_verifications
    FOR EACH ROW
    EXECUTE FUNCTION create_kyc_audit_entry();

-- Data retention cleanup functions
CREATE OR REPLACE FUNCTION cleanup_expired_kyc_documents()
RETURNS void AS $$
BEGIN
    -- Delete expired documents (GDPR compliance)
    DELETE FROM kyc_documents 
    WHERE retention_expires_at IS NOT NULL 
      AND retention_expires_at < CURRENT_TIMESTAMP;
      
    -- Log cleanup activity
    INSERT INTO kyc_audit_trail (
        verification_id,
        action,
        details
    )
    SELECT 
        verification_id,
        'document_expired',
        jsonb_build_object('cleanup_timestamp', CURRENT_TIMESTAMP)
    FROM kyc_documents 
    WHERE retention_expires_at IS NOT NULL 
      AND retention_expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_kyc_verifications()
RETURNS void AS $$
BEGIN
    -- Update expired verifications to rejected status
    UPDATE kyc_verifications 
    SET 
        status = 'rejected',
        reviewer_notes = 'Automatically rejected due to expiration',
        updated_at = CURRENT_TIMESTAMP
    WHERE expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP 
      AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_trail ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their own verifications
CREATE POLICY kyc_verifications_user_policy ON kyc_verifications
    FOR ALL TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Policy for admins to access all verifications
CREATE POLICY kyc_verifications_admin_policy ON kyc_verifications
    FOR ALL TO dwaybank_admin
    USING (true);

-- Policy for documents access (linked to verification ownership)
CREATE POLICY kyc_documents_access_policy ON kyc_documents
    FOR ALL TO dwaybank_user, dwaybank_admin
    USING (
        verification_id IN (
            SELECT id FROM kyc_verifications 
            WHERE user_id = current_setting('app.current_user_id')::uuid
               OR current_setting('app.current_user_role') IN ('admin', 'super_admin', 'compliance_officer')
        )
    );

-- Policy for audit trail access
CREATE POLICY kyc_audit_trail_policy ON kyc_audit_trail
    FOR SELECT TO dwaybank_user, dwaybank_admin
    USING (
        verification_id IN (
            SELECT id FROM kyc_verifications 
            WHERE user_id = current_setting('app.current_user_id')::uuid
               OR current_setting('app.current_user_role') IN ('admin', 'super_admin', 'compliance_officer')
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON kyc_verifications TO dwaybank_user;
GRANT SELECT, INSERT ON kyc_documents TO dwaybank_user;
GRANT SELECT, INSERT ON kyc_provider_references TO dwaybank_user;
GRANT SELECT ON kyc_audit_trail TO dwaybank_user;
GRANT SELECT, INSERT ON kyc_aml_checks TO dwaybank_user;

GRANT ALL ON kyc_verifications TO dwaybank_admin;
GRANT ALL ON kyc_documents TO dwaybank_admin;
GRANT ALL ON kyc_provider_references TO dwaybank_admin;
GRANT ALL ON kyc_audit_trail TO dwaybank_admin;
GRANT ALL ON kyc_aml_checks TO dwaybank_admin;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dwaybank_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dwaybank_admin;

-- Add table comments for documentation
COMMENT ON TABLE kyc_verifications IS 'Main KYC verification records with status tracking and compliance data';
COMMENT ON TABLE kyc_documents IS 'Encrypted storage for KYC document images with retention policies';
COMMENT ON TABLE kyc_provider_references IS 'References to external KYC provider verification IDs';
COMMENT ON TABLE kyc_audit_trail IS 'Complete audit trail for all KYC operations for compliance reporting';
COMMENT ON TABLE kyc_aml_checks IS 'Anti-Money Laundering checks including sanctions and PEP screening';

-- Add column comments
COMMENT ON COLUMN kyc_verifications.confidence_score IS 'AI/ML confidence score (0-100) for verification accuracy';
COMMENT ON COLUMN kyc_verifications.extracted_data IS 'Encrypted personal data extracted from documents (PII)';
COMMENT ON COLUMN kyc_verifications.risk_flags IS 'Array of risk indicators flagged during verification';
COMMENT ON COLUMN kyc_verifications.verification_details IS 'Technical verification results and scores';
COMMENT ON COLUMN kyc_verifications.metadata IS 'Submission context (IP, user agent, device fingerprint)';
COMMENT ON COLUMN kyc_verifications.expires_at IS 'Expiration timestamp for pending verifications';

COMMENT ON COLUMN kyc_documents.encrypted_data IS 'AES-256 encrypted document data with IV and authentication tag';
COMMENT ON COLUMN kyc_documents.file_hash IS 'SHA-256 hash for document integrity verification';
COMMENT ON COLUMN kyc_documents.retention_expires_at IS 'GDPR data retention expiry timestamp';

COMMIT;