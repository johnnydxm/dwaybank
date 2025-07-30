-- ============================================================================
-- DWAYBANK SMART WALLET - KYC TABLE MIGRATION
-- ============================================================================
-- Migration: 004_create_kyc_table
-- Description: Create KYC/AML verification tables for compliance and identity verification
-- Author: DwayBank Development Team
-- Date: 2025-01-29

-- Create KYC records table
CREATE TABLE kyc_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Verification Status
    status kyc_status NOT NULL DEFAULT 'pending',
    
    -- Provider Information
    provider VARCHAR(50) NOT NULL, -- jumio, onfido, mock
    provider_reference VARCHAR(255) NOT NULL, -- External provider's reference ID
    provider_workflow_id VARCHAR(255), -- Provider's workflow/transaction ID
    
    -- Document Information
    document_type VARCHAR(50) NOT NULL, -- passport, drivers_license, national_id, etc.
    document_number VARCHAR(100),
    document_country VARCHAR(2), -- ISO country code
    document_expiry DATE,
    
    -- Personal Information (from document)
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    date_of_birth DATE,
    nationality VARCHAR(2), -- ISO country code
    gender VARCHAR(10),
    
    -- Address Information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2), -- ISO country code
    
    -- Verification Results (encrypted JSON)
    verification_result_encrypted TEXT,
    
    -- Risk Assessment
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) DEFAULT 'unknown', -- low, medium, high, very_high
    aml_status VARCHAR(20) DEFAULT 'pending', -- clear, review, reject
    
    -- Quality Scores
    document_quality_score INTEGER CHECK (document_quality_score >= 0 AND document_quality_score <= 100),
    face_match_score INTEGER CHECK (face_match_score >= 0 AND face_match_score <= 100),
    liveness_score INTEGER CHECK (liveness_score >= 0 AND liveness_score <= 100),
    
    -- Review Information
    rejection_reason VARCHAR(255),
    review_notes TEXT,
    manual_review_required BOOLEAN DEFAULT FALSE,
    
    -- Expiry and Renewal
    expires_at TIMESTAMP WITH TIME ZONE,
    renewal_required_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing Information
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- External URLs (encrypted)
    document_urls_encrypted TEXT, -- JSON array of document image URLs
    redirect_url_encrypted TEXT, -- Provider redirect URL for user
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create KYC document uploads table
CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    kyc_record_id UUID NOT NULL REFERENCES kyc_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Document Information
    document_type VARCHAR(50) NOT NULL, -- front, back, selfie, proof_of_address
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    
    -- Storage Information
    storage_path_encrypted TEXT NOT NULL, -- Encrypted file path
    file_hash VARCHAR(255) NOT NULL, -- File integrity check
    
    -- Processing Status
    upload_status VARCHAR(20) NOT NULL DEFAULT 'uploaded', -- uploaded, processing, processed, failed
    extraction_status VARCHAR(20) DEFAULT 'pending', -- pending, extracted, failed
    
    -- Extracted Data (encrypted JSON)
    extracted_data_encrypted TEXT,
    
    -- Quality Assessment
    image_quality_score INTEGER CHECK (image_quality_score >= 0 AND image_quality_score <= 100),
    blur_score INTEGER CHECK (blur_score >= 0 AND blur_score <= 100),
    glare_score INTEGER CHECK (glare_score >= 0 AND glare_score <= 100),
    
    -- Security
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    
    -- Processing Information
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create KYC compliance checks table
CREATE TABLE kyc_compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    kyc_record_id UUID NOT NULL REFERENCES kyc_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Check Information
    check_type VARCHAR(50) NOT NULL, -- sanctions, pep, adverse_media, id_verification
    check_provider VARCHAR(50) NOT NULL,
    check_reference VARCHAR(255),
    
    -- Results
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, clear, hit, error
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Details (encrypted JSON)
    check_details_encrypted TEXT,
    match_details_encrypted TEXT,
    
    -- Hit Information
    hit_count INTEGER DEFAULT 0,
    hit_severity VARCHAR(20), -- low, medium, high, critical
    
    -- Processing
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for kyc_records
CREATE INDEX idx_kyc_records_user_id ON kyc_records(user_id);
CREATE INDEX idx_kyc_records_status ON kyc_records(status);
CREATE INDEX idx_kyc_records_provider ON kyc_records(provider);
CREATE INDEX idx_kyc_records_provider_reference ON kyc_records(provider_reference);
CREATE INDEX idx_kyc_records_document_type ON kyc_records(document_type);
CREATE INDEX idx_kyc_records_document_country ON kyc_records(document_country);
CREATE INDEX idx_kyc_records_risk_score ON kyc_records(risk_score);
CREATE INDEX idx_kyc_records_risk_level ON kyc_records(risk_level);
CREATE INDEX idx_kyc_records_aml_status ON kyc_records(aml_status);
CREATE INDEX idx_kyc_records_manual_review ON kyc_records(manual_review_required) WHERE manual_review_required = TRUE;
CREATE INDEX idx_kyc_records_expires_at ON kyc_records(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_kyc_records_created_at ON kyc_records(created_at);
CREATE INDEX idx_kyc_records_verified_at ON kyc_records(verified_at) WHERE verified_at IS NOT NULL;

-- Composite indexes for kyc_records
CREATE INDEX idx_kyc_records_user_status ON kyc_records(user_id, status);
CREATE INDEX idx_kyc_records_provider_status ON kyc_records(provider, status);
CREATE INDEX idx_kyc_records_pending_review ON kyc_records(manual_review_required, created_at) 
WHERE manual_review_required = TRUE AND status = 'pending';

-- Create indexes for kyc_documents
CREATE INDEX idx_kyc_documents_kyc_record_id ON kyc_documents(kyc_record_id);
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_document_type ON kyc_documents(document_type);
CREATE INDEX idx_kyc_documents_upload_status ON kyc_documents(upload_status);
CREATE INDEX idx_kyc_documents_extraction_status ON kyc_documents(extraction_status);
CREATE INDEX idx_kyc_documents_file_hash ON kyc_documents(file_hash);
CREATE INDEX idx_kyc_documents_created_at ON kyc_documents(created_at);

-- Create indexes for kyc_compliance_checks
CREATE INDEX idx_kyc_compliance_kyc_record_id ON kyc_compliance_checks(kyc_record_id);
CREATE INDEX idx_kyc_compliance_user_id ON kyc_compliance_checks(user_id);
CREATE INDEX idx_kyc_compliance_check_type ON kyc_compliance_checks(check_type);
CREATE INDEX idx_kyc_compliance_status ON kyc_compliance_checks(status);
CREATE INDEX idx_kyc_compliance_hit_severity ON kyc_compliance_checks(hit_severity) WHERE hit_severity IS NOT NULL;
CREATE INDEX idx_kyc_compliance_created_at ON kyc_compliance_checks(created_at);

-- Create triggers
CREATE TRIGGER update_kyc_records_updated_at
    BEFORE UPDATE ON kyc_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at
    BEFORE UPDATE ON kyc_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_compliance_updated_at
    BEFORE UPDATE ON kyc_compliance_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit triggers
CREATE TRIGGER kyc_records_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kyc_records
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER kyc_documents_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kyc_documents
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER kyc_compliance_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kyc_compliance_checks
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

-- Add constraints
ALTER TABLE kyc_records ADD CONSTRAINT kyc_provider_reference_not_empty 
    CHECK (LENGTH(TRIM(provider_reference)) > 0);

ALTER TABLE kyc_records ADD CONSTRAINT kyc_document_country_format 
    CHECK (document_country IS NULL OR document_country ~* '^[A-Z]{2}$');

ALTER TABLE kyc_records ADD CONSTRAINT kyc_nationality_format 
    CHECK (nationality IS NULL OR nationality ~* '^[A-Z]{2}$');

ALTER TABLE kyc_records ADD CONSTRAINT kyc_country_format 
    CHECK (country IS NULL OR country ~* '^[A-Z]{2}$');

ALTER TABLE kyc_records ADD CONSTRAINT kyc_processing_timeline 
    CHECK (
        (submitted_at IS NULL OR submitted_at >= initiated_at) AND
        (processed_at IS NULL OR processed_at >= COALESCE(submitted_at, initiated_at)) AND
        (verified_at IS NULL OR verified_at >= COALESCE(processed_at, submitted_at, initiated_at))
    );

ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_file_size_positive 
    CHECK (file_size > 0);

ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_mime_type_not_empty 
    CHECK (LENGTH(TRIM(mime_type)) > 0);

ALTER TABLE kyc_compliance_checks ADD CONSTRAINT kyc_compliance_hit_count_non_negative 
    CHECK (hit_count >= 0);

-- Create function to get user's latest KYC record
CREATE OR REPLACE FUNCTION get_user_latest_kyc(target_user_id UUID)
RETURNS TABLE(
    kyc_id UUID,
    status kyc_status,
    provider VARCHAR(50),
    risk_score INTEGER,
    risk_level VARCHAR(20),
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kr.id,
        kr.status,
        kr.provider,
        kr.risk_score,
        kr.risk_level,
        kr.verified_at,
        kr.expires_at
    FROM kyc_records kr
    WHERE kr.user_id = target_user_id
    ORDER BY kr.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check KYC expiry
CREATE OR REPLACE FUNCTION check_kyc_expiry(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    kyc_record RECORD;
BEGIN
    SELECT status, expires_at INTO kyc_record
    FROM kyc_records
    WHERE user_id = target_user_id
    AND status = 'approved'
    ORDER BY verified_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE; -- No approved KYC found
    END IF;
    
    -- Check if KYC is expired
    IF kyc_record.expires_at IS NOT NULL AND kyc_record.expires_at < CURRENT_TIMESTAMP THEN
        -- Update user's KYC status to expired
        UPDATE users 
        SET kyc_status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE id = target_user_id;
        
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to initiate KYC verification
CREATE OR REPLACE FUNCTION initiate_kyc_verification(
    target_user_id UUID,
    kyc_provider VARCHAR(50),
    provider_ref VARCHAR(255),
    doc_type VARCHAR(50),
    doc_country VARCHAR(2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    kyc_id UUID;
BEGIN
    -- Insert new KYC record
    INSERT INTO kyc_records (
        user_id,
        provider,
        provider_reference,
        document_type,
        document_country,
        initiated_at
    ) VALUES (
        target_user_id,
        kyc_provider,
        provider_ref,
        doc_type,
        doc_country,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO kyc_id;
    
    -- Update user's KYC status to in_progress
    UPDATE users 
    SET kyc_status = 'in_progress', updated_at = CURRENT_TIMESTAMP
    WHERE id = target_user_id;
    
    -- Log KYC initiation
    INSERT INTO audit_log (table_name, operation, record_id, new_values)
    VALUES ('kyc_records', 'INITIATED', kyc_id, 
        jsonb_build_object(
            'user_id', target_user_id,
            'provider', kyc_provider,
            'document_type', doc_type
        ));
    
    RETURN kyc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to complete KYC verification
CREATE OR REPLACE FUNCTION complete_kyc_verification(
    target_kyc_id UUID,
    verification_status kyc_status,
    risk_score INTEGER DEFAULT NULL,
    risk_level VARCHAR(20) DEFAULT NULL,
    rejection_reason VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
    completion_successful BOOLEAN := FALSE;
BEGIN
    -- Get user ID and validate KYC record exists
    SELECT user_id INTO target_user_id
    FROM kyc_records
    WHERE id = target_kyc_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update KYC record
    UPDATE kyc_records 
    SET 
        status = verification_status,
        risk_score = COALESCE(complete_kyc_verification.risk_score, kyc_records.risk_score),
        risk_level = COALESCE(complete_kyc_verification.risk_level, kyc_records.risk_level),
        rejection_reason = complete_kyc_verification.rejection_reason,
        processed_at = CURRENT_TIMESTAMP,
        verified_at = CASE WHEN verification_status = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
        expires_at = CASE 
            WHEN verification_status = 'approved' THEN CURRENT_TIMESTAMP + INTERVAL '2 years'
            ELSE NULL 
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_kyc_id;
    
    GET DIAGNOSTICS completion_successful = FOUND;
    
    -- Update user's KYC status
    IF completion_successful THEN
        UPDATE users 
        SET kyc_status = verification_status, updated_at = CURRENT_TIMESTAMP
        WHERE id = target_user_id;
        
        -- Log KYC completion
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES ('kyc_records', 'COMPLETED', target_kyc_id, 
            jsonb_build_object(
                'status', verification_status,
                'risk_score', risk_score,
                'risk_level', risk_level,
                'rejection_reason', rejection_reason
            ));
    END IF;
    
    RETURN completion_successful;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON kyc_records TO dwaybank;
GRANT SELECT, INSERT, UPDATE, DELETE ON kyc_documents TO dwaybank;
GRANT SELECT, INSERT, UPDATE, DELETE ON kyc_compliance_checks TO dwaybank;

-- Create comments
COMMENT ON TABLE kyc_records IS 'KYC/AML verification records with compliance tracking';
COMMENT ON TABLE kyc_documents IS 'Uploaded KYC documents with secure storage references';
COMMENT ON TABLE kyc_compliance_checks IS 'Compliance checks including sanctions, PEP, and adverse media screening';
COMMENT ON COLUMN kyc_records.verification_result_encrypted IS 'Encrypted JSON of full verification results from provider';
COMMENT ON COLUMN kyc_records.document_urls_encrypted IS 'Encrypted URLs to document images stored with provider';
COMMENT ON COLUMN kyc_documents.storage_path_encrypted IS 'Encrypted file system or cloud storage path';
COMMENT ON COLUMN kyc_documents.extracted_data_encrypted IS 'Encrypted extracted document data (OCR results)';

-- Create view for KYC compliance summary
CREATE VIEW kyc_compliance_summary AS
SELECT 
    kr.user_id,
    kr.id as kyc_record_id,
    kr.status as kyc_status,
    kr.risk_score,
    kr.risk_level,
    kr.aml_status,
    COUNT(kcc.id) as total_checks,
    COUNT(CASE WHEN kcc.status = 'clear' THEN 1 END) as clear_checks,
    COUNT(CASE WHEN kcc.status = 'hit' THEN 1 END) as hit_checks,
    MAX(CASE WHEN kcc.hit_severity = 'critical' THEN 1 
             WHEN kcc.hit_severity = 'high' THEN 2
             WHEN kcc.hit_severity = 'medium' THEN 3
             WHEN kcc.hit_severity = 'low' THEN 4
             ELSE 5 END) as highest_severity_level,
    kr.verified_at,
    kr.expires_at
FROM kyc_records kr
LEFT JOIN kyc_compliance_checks kcc ON kr.id = kcc.kyc_record_id
GROUP BY kr.user_id, kr.id, kr.status, kr.risk_score, kr.risk_level, 
         kr.aml_status, kr.verified_at, kr.expires_at;

COMMENT ON VIEW kyc_compliance_summary IS 'Summary of KYC compliance status and checks per user';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "004_create_kyc_table", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 004_create_kyc_table completed successfully';
    RAISE NOTICE 'Created KYC tables with % indexes and % functions', 
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename LIKE 'kyc_%'),
        (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%kyc%');
END $$;