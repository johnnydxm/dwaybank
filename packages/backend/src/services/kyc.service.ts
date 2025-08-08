/**
 * KYC (Know Your Customer) Service for DwayBank
 * Handles identity verification, document processing, and AML compliance
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import crypto from 'crypto';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';

/**
 * KYC Request Interface
 */
export interface KYCRequest {
  user_id: string;
  document_type: 'passport' | 'drivers_license' | 'national_id';
  document_front: string; // base64 encoded image
  document_back?: string; // base64 encoded image (for drivers license)
  selfie_image: string; // base64 encoded selfie
  address_proof?: string; // base64 encoded address document
  metadata?: {
    ip_address: string;
    user_agent: string;
    device_fingerprint?: string;
    submission_source: 'web' | 'mobile';
  };
}

/**
 * Address Information
 */
export interface Address {
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country_code: string; // ISO 3166-1 alpha-2
}

/**
 * KYC Verification Result
 */
export interface KYCResult {
  verification_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'requires_review';
  confidence_score: number; // 0-100
  extracted_data: {
    full_name: string;
    date_of_birth: string;
    document_number: string;
    address: Address;
    nationality?: string;
    gender?: string;
    expiry_date?: string;
  };
  risk_flags: string[];
  verification_details: {
    document_authenticity: number; // 0-100
    biometric_match: number; // 0-100
    data_consistency: number; // 0-100
    sanctions_check: 'clear' | 'match' | 'potential_match';
    pep_check: 'clear' | 'match' | 'potential_match';
  };
  estimated_review_time?: string;
  next_steps?: string[];
}

/**
 * KYC Status Update
 */
export interface KYCStatusUpdate {
  verification_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'requires_review';
  reviewer_notes?: string;
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Jumio API Response Interface
 */
interface JumioVerificationResponse {
  verificationId: string;
  status: 'PENDING' | 'DONE_SUCCESS' | 'DONE_FAILURE' | 'ERROR';
  verification: {
    mrzCheck: string;
    faceMatch: string;
    documentValidation: string;
  };
  document: {
    type: string;
    country: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    documentNumber: string;
    expiryDate: string;
  };
  biometrics: {
    faceMatch: number;
    livenessCheck: string;
  };
}

export class KYCService {
  private db: Pool;
  private encryptionKey: Buffer;
  private jumioConfig: {
    apiToken: string;
    apiSecret: string;
    baseUrl: string;
  };

  constructor(database: Pool) {
    this.db = database;
    this.encryptionKey = Buffer.from(config.security.encryptionKey, 'hex');
    
    this.jumioConfig = {
      apiToken: config.kyc.jumio.apiToken,
      apiSecret: config.kyc.jumio.apiSecret,
      baseUrl: config.kyc.jumio.baseUrl,
    };

    logger.info('KYC Service initialized', {
      provider: config.kyc.provider,
      jumioConfigured: !!this.jumioConfig.apiToken,
    });
  }

  /**
   * Submit KYC verification request
   */
  async submitVerification(request: KYCRequest): Promise<KYCResult> {
    const verificationId = uuidv4();
    
    logger.info('KYC verification submitted', {
      verificationId,
      userId: request.user_id,
      documentType: request.document_type,
      hasAddressProof: !!request.address_proof,
    });

    try {
      // Store initial verification record
      await this.storeVerificationRecord(verificationId, request);

      // Process verification based on configured provider
      let result: KYCResult;
      
      switch (config.kyc.provider) {
        case 'jumio':
          result = await this.processWithJumio(verificationId, request);
          break;
        case 'onfido':
          result = await this.processWithOnfido(verificationId, request);
          break;
        default:
          result = await this.processWithMockProvider(verificationId, request);
      }

      // Update verification record with results
      await this.updateVerificationRecord(verificationId, result);

      // Check sanctions and PEP lists
      await this.performAMLChecks(result);

      auditLogger.info('KYC verification completed', {
        verificationId,
        userId: request.user_id,
        status: result.status,
        confidenceScore: result.confidence_score,
        riskFlags: result.risk_flags.length,
      });

      return result;

    } catch (error) {
      logger.error('KYC verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId,
        userId: request.user_id,
      });

      // Store error state
      await this.updateVerificationStatusInternal(verificationId, 'rejected', {
        error: error instanceof Error ? error.message : 'Verification failed',
      });

      throw error;
    }
  }

  /**
   * Process verification with Jumio
   */
  private async processWithJumio(verificationId: string, request: KYCRequest): Promise<KYCResult> {
    logger.info('Processing KYC with Jumio', { verificationId });

    try {
      // Prepare Jumio request
      const jumioRequest = {
        customerInternalReference: verificationId,
        userReference: request.user_id,
        workflowId: await this.getJumioWorkflowId(request.document_type),
        documentFront: request.document_front,
        documentBack: request.document_back,
        selfie: request.selfie_image,
        callbackUrl: `${process.env.API_BASE_URL}/webhook/kyc/jumio`,
      };

      // Submit to Jumio API
      const jumioResponse = await this.callJumioAPI('/v1/initiate', 'POST', jumioRequest);
      
      // Store Jumio verification reference
      await this.storeJumioReference(verificationId, jumioResponse.verificationReference);

      // For synchronous processing, poll for results
      // In production, this would be handled via webhooks
      const verificationResult = await this.pollJumioResults(jumioResponse.verificationReference);

      return this.mapJumioResponseToKYCResult(verificationId, verificationResult, request);

    } catch (error) {
      logger.error('Jumio processing failed', { error, verificationId });
      throw new Error(`Jumio verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process verification with Onfido (placeholder)
   */
  private async processWithOnfido(verificationId: string, request: KYCRequest): Promise<KYCResult> {
    logger.info('Processing KYC with Onfido', { verificationId });
    
    // TODO: Implement Onfido integration
    throw new Error('Onfido integration not yet implemented');
  }

  /**
   * Process verification with mock provider (development)
   */
  private async processWithMockProvider(verificationId: string, request: KYCRequest): Promise<KYCResult> {
    logger.info('Processing KYC with mock provider', { verificationId });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock extracted data
    const mockData = this.generateMockKYCData(request);

    return {
      verification_id: verificationId,
      status: mockData.confidence_score >= 95 ? 'approved' : 
              mockData.confidence_score >= 70 ? 'requires_review' : 'rejected',
      confidence_score: mockData.confidence_score,
      extracted_data: mockData.extracted_data,
      risk_flags: mockData.risk_flags,
      verification_details: mockData.verification_details,
      estimated_review_time: mockData.confidence_score < 95 ? '24-48 hours' : undefined,
      next_steps: mockData.confidence_score < 95 ? [
        'Manual review by compliance team',
        'Additional documents may be requested',
      ] : undefined,
    };
  }

  /**
   * Generate mock KYC data for development
   */
  private generateMockKYCData(request: KYCRequest) {
    // Generate realistic mock data based on request
    const baseScore = Math.random() * 40 + 60; // 60-100 range
    const hasAddressProof = !!request.address_proof;
    const confidenceBonus = hasAddressProof ? 10 : 0;
    const confidence_score = Math.min(100, baseScore + confidenceBonus);

    const risk_flags: string[] = [];
    if (confidence_score < 80) risk_flags.push('LOW_DOCUMENT_QUALITY');
    if (confidence_score < 70) risk_flags.push('BIOMETRIC_MISMATCH');
    if (Math.random() < 0.1) risk_flags.push('SANCTIONS_CHECK_PENDING');

    return {
      confidence_score,
      risk_flags,
      extracted_data: {
        full_name: 'John Michael Doe',
        date_of_birth: '1990-01-15',
        document_number: `${request.document_type.toUpperCase()}123456789`,
        nationality: 'US',
        gender: 'M',
        expiry_date: '2028-01-15',
        address: {
          street_address: '123 Main Street, Apt 4B',
          city: 'New York',
          state_province: 'NY',
          postal_code: '10001',
          country_code: 'US',
        },
      },
      verification_details: {
        document_authenticity: confidence_score,
        biometric_match: Math.max(0, confidence_score - 5),
        data_consistency: Math.max(0, confidence_score - 3),
        sanctions_check: risk_flags.includes('SANCTIONS_CHECK_PENDING') ? 'potential_match' : 'clear',
        pep_check: 'clear',
      },
    };
  }

  /**
   * Call Jumio API
   */
  private async callJumioAPI(endpoint: string, method: string, data?: any): Promise<any> {
    const auth = Buffer.from(`${this.jumioConfig.apiToken}:${this.jumioConfig.apiSecret}`).toString('base64');
    
    const response = await fetch(`${this.jumioConfig.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DwayBank-KYC/1.0',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jumio API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get Jumio workflow ID based on document type
   */
  private async getJumioWorkflowId(documentType: string): Promise<string> {
    // In production, these would be configured workflow IDs from Jumio dashboard
    const workflowMap = {
      'passport': 'passport-verification-workflow',
      'drivers_license': 'drivers-license-workflow',
      'national_id': 'national-id-workflow',
    };

    return workflowMap[documentType as keyof typeof workflowMap] || workflowMap.passport;
  }

  /**
   * Poll Jumio results (for demo - production should use webhooks)
   */
  private async pollJumioResults(verificationReference: string): Promise<JumioVerificationResponse> {
    // In production, this would be handled via webhooks
    // This is for demonstration purposes only
    
    let attempts = 0;
    const maxAttempts = 12; // 2 minutes with 10-second intervals
    
    while (attempts < maxAttempts) {
      try {
        const result = await this.callJumioAPI(`/v1/verification/${verificationReference}`, 'GET');
        
        if (result.status !== 'PENDING') {
          return result;
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
      } catch (error) {
        logger.warn('Jumio polling attempt failed', { error, attempt: attempts, verificationReference });
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    throw new Error('Jumio verification timeout - results not available');
  }

  /**
   * Map Jumio response to KYC result
   */
  private mapJumioResponseToKYCResult(
    verificationId: string, 
    jumioResponse: JumioVerificationResponse,
    request: KYCRequest
  ): KYCResult {
    const status = this.mapJumioStatus(jumioResponse.status);
    const confidence_score = this.calculateConfidenceScore(jumioResponse);
    
    return {
      verification_id: verificationId,
      status,
      confidence_score,
      extracted_data: {
        full_name: `${jumioResponse.document.firstName} ${jumioResponse.document.lastName}`,
        date_of_birth: jumioResponse.document.dateOfBirth,
        document_number: jumioResponse.document.documentNumber,
        nationality: jumioResponse.document.country,
        expiry_date: jumioResponse.document.expiryDate,
        address: {
          street_address: '', // Would need separate address extraction
          city: '',
          state_province: '',
          postal_code: '',
          country_code: jumioResponse.document.country,
        },
      },
      risk_flags: this.extractRiskFlags(jumioResponse),
      verification_details: {
        document_authenticity: confidence_score,
        biometric_match: jumioResponse.biometrics.faceMatch,
        data_consistency: confidence_score,
        sanctions_check: 'clear', // Would be set by AML check
        pep_check: 'clear', // Would be set by AML check
      },
    };
  }

  /**
   * Map Jumio status to KYC status
   */
  private mapJumioStatus(jumioStatus: string): KYCResult['status'] {
    switch (jumioStatus) {
      case 'DONE_SUCCESS':
        return 'approved';
      case 'DONE_FAILURE':
        return 'rejected';
      case 'ERROR':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /**
   * Calculate confidence score from Jumio response
   */
  private calculateConfidenceScore(jumioResponse: JumioVerificationResponse): number {
    // Simplified scoring logic
    let score = 50;
    
    if (jumioResponse.verification.documentValidation === 'OK') score += 25;
    if (jumioResponse.verification.faceMatch === 'MATCH') score += 20;
    if (jumioResponse.verification.mrzCheck === 'OK') score += 5;
    
    return Math.min(100, score);
  }

  /**
   * Extract risk flags from Jumio response
   */
  private extractRiskFlags(jumioResponse: JumioVerificationResponse): string[] {
    const flags: string[] = [];
    
    if (jumioResponse.verification.documentValidation === 'NOT_OK') {
      flags.push('DOCUMENT_VALIDATION_FAILED');
    }
    if (jumioResponse.verification.faceMatch === 'NO_MATCH') {
      flags.push('BIOMETRIC_MISMATCH');
    }
    if (jumioResponse.biometrics.livenessCheck === 'FAILED') {
      flags.push('LIVENESS_CHECK_FAILED');
    }
    
    return flags;
  }

  /**
   * Perform AML (Anti-Money Laundering) checks
   */
  private async performAMLChecks(result: KYCResult): Promise<void> {
    logger.info('Performing AML checks', { 
      verificationId: result.verification_id,
      fullName: result.extracted_data.full_name,
    });

    try {
      // Check sanctions lists (OFAC, EU, UN, etc.)
      const sanctionsCheck = await this.checkSanctionsList(result.extracted_data.full_name);
      result.verification_details.sanctions_check = sanctionsCheck;

      // Check PEP (Politically Exposed Person) lists
      const pepCheck = await this.checkPEPList(result.extracted_data.full_name);
      result.verification_details.pep_check = pepCheck;

      // Add risk flags based on AML results
      if (sanctionsCheck !== 'clear') {
        result.risk_flags.push('SANCTIONS_MATCH');
        result.status = 'requires_review';
      }
      if (pepCheck !== 'clear') {
        result.risk_flags.push('PEP_MATCH');
        result.status = 'requires_review';
      }

      auditLogger.info('AML checks completed', {
        verificationId: result.verification_id,
        sanctionsCheck,
        pepCheck,
        totalRiskFlags: result.risk_flags.length,
      });

    } catch (error) {
      logger.error('AML check failed', { error, verificationId: result.verification_id });
      result.risk_flags.push('AML_CHECK_FAILED');
    }
  }

  /**
   * Check sanctions lists
   */
  private async checkSanctionsList(fullName: string): Promise<'clear' | 'match' | 'potential_match'> {
    // In production, this would integrate with OFAC, EU, UN sanctions APIs
    // For demo, return clear unless name contains specific test patterns
    
    const testSanctionsNames = ['VLADIMIR PUTIN', 'KIM JONG', 'SANCTIONS TEST'];
    const nameUpper = fullName.toUpperCase();
    
    for (const sanctionedName of testSanctionsNames) {
      if (nameUpper.includes(sanctionedName)) {
        return 'match';
      }
    }
    
    // Simulate potential matches for names with common patterns
    if (Math.random() < 0.02) { // 2% chance for demo
      return 'potential_match';
    }
    
    return 'clear';
  }

  /**
   * Check PEP (Politically Exposed Person) lists
   */
  private async checkPEPList(fullName: string): Promise<'clear' | 'match' | 'potential_match'> {
    // In production, this would integrate with PEP databases
    // For demo, return clear unless name contains specific test patterns
    
    const testPEPNames = ['PRESIDENT', 'MINISTER', 'GOVERNOR', 'PEP TEST'];
    const nameUpper = fullName.toUpperCase();
    
    for (const pepName of testPEPNames) {
      if (nameUpper.includes(pepName)) {
        return 'match';
      }
    }
    
    // Simulate potential matches
    if (Math.random() < 0.01) { // 1% chance for demo
      return 'potential_match';
    }
    
    return 'clear';
  }

  /**
   * Store initial verification record
   */
  private async storeVerificationRecord(verificationId: string, request: KYCRequest): Promise<void> {
    await this.db.query(`
      INSERT INTO kyc_verifications (
        id, user_id, document_type, status, risk_level, 
        metadata, created_at
      )
      VALUES ($1, $2, $3, 'pending', 'medium', $4, CURRENT_TIMESTAMP)
    `, [
      verificationId,
      request.user_id,
      request.document_type,
      JSON.stringify(request.metadata || {}),
    ]);

    // Store encrypted documents
    await this.storeVerificationDocuments(verificationId, request);
  }

  /**
   * Store verification documents (encrypted)
   */
  private async storeVerificationDocuments(verificationId: string, request: KYCRequest): Promise<void> {
    const documents = [
      { type: 'document_front', data: request.document_front },
      { type: 'selfie', data: request.selfie_image },
    ];

    if (request.document_back) {
      documents.push({ type: 'document_back', data: request.document_back });
    }
    if (request.address_proof) {
      documents.push({ type: 'address_proof', data: request.address_proof });
    }

    for (const doc of documents) {
      const encryptedData = this.encrypt(doc.data);
      await this.db.query(`
        INSERT INTO kyc_documents (
          verification_id, document_type, encrypted_data, created_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [verificationId, doc.type, JSON.stringify(encryptedData)]);
    }
  }

  /**
   * Update verification record with results
   */
  private async updateVerificationRecord(verificationId: string, result: KYCResult): Promise<void> {
    await this.db.query(`
      UPDATE kyc_verifications 
      SET 
        status = $2,
        confidence_score = $3,
        extracted_data = $4,
        risk_flags = $5,
        verification_details = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [
      verificationId,
      result.status,
      result.confidence_score,
      JSON.stringify(result.extracted_data),
      JSON.stringify(result.risk_flags),
      JSON.stringify(result.verification_details),
    ]);
  }

  /**
   * Store Jumio reference
   */
  private async storeJumioReference(verificationId: string, jumioReference: string): Promise<void> {
    await this.db.query(`
      INSERT INTO kyc_provider_references (
        verification_id, provider, provider_reference, created_at
      )
      VALUES ($1, 'jumio', $2, CURRENT_TIMESTAMP)
    `, [verificationId, jumioReference]);
  }

  /**
   * Update verification status (internal method)
   */
  private async updateVerificationStatusInternal(
    verificationId: string, 
    status: KYCResult['status'], 
    additionalData?: any
  ): Promise<void> {
    await this.db.query(`
      UPDATE kyc_verifications 
      SET status = $2, metadata = metadata || $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [verificationId, status, JSON.stringify(additionalData || {})]);
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(verificationId: string): Promise<KYCResult | null> {
    const result = await this.db.query(`
      SELECT * FROM kyc_verifications WHERE id = $1
    `, [verificationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      verification_id: row.id,
      status: row.status,
      confidence_score: row.confidence_score || 0,
      extracted_data: row.extracted_data || {},
      risk_flags: row.risk_flags || [],
      verification_details: row.verification_details || {},
    };
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): { iv: string; encryptedData: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(config.security.encryptionAlgorithm, this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: cipher.getAuthTag?.()?.toString('hex') || '',
    };
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedObj: { iv: string; encryptedData: string; authTag: string }): string {
    const decipher = crypto.createDecipher(config.security.encryptionAlgorithm, this.encryptionKey);
    
    if (encryptedObj.authTag) {
      decipher.setAuthTag?.(Buffer.from(encryptedObj.authTag, 'hex'));
    }
    
    let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get latest verification for user
   */
  async getLatestVerificationForUser(userId: string): Promise<KYCResult | null> {
    const result = await this.db.query(`
      SELECT * FROM kyc_verifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      verification_id: row.id,
      status: row.status,
      confidence_score: row.confidence_score || 0,
      extracted_data: row.extracted_data || {},
      risk_flags: row.risk_flags || [],
      verification_details: row.verification_details || {},
      estimated_review_time: row.estimated_review_time,
      next_steps: row.next_steps,
    };
  }

  /**
   * Check if verification is owned by user
   */
  async isVerificationOwnedByUser(verificationId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT 1 FROM kyc_verifications 
      WHERE id = $1 AND user_id = $2
    `, [verificationId, userId]);

    return result.rows.length > 0;
  }

  /**
   * Update verification status (admin function)
   */
  async updateVerificationStatus(
    statusUpdate: KYCStatusUpdate,
    reviewerId: string
  ): Promise<boolean> {
    const result = await this.db.query(`
      UPDATE kyc_verifications 
      SET 
        status = $2,
        risk_level = $3,
        reviewer_id = $4,
        reviewer_notes = $5,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `, [
      statusUpdate.verification_id,
      statusUpdate.status,
      statusUpdate.risk_level,
      reviewerId,
      statusUpdate.reviewer_notes,
    ]);

    return result.rows.length > 0;
  }

  /**
   * Get verifications for admin review
   */
  async getVerificationsForReview(filters: {
    status?: string;
    risk_level?: string;
    page: number;
    limit: number;
  }): Promise<{ verifications: any[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.risk_level) {
      paramCount++;
      whereClause += ` AND risk_level = $${paramCount}`;
      params.push(filters.risk_level);
    }

    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total FROM kyc_verifications ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (filters.page - 1) * filters.limit;
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const result = await this.db.query(`
      SELECT 
        kv.*,
        u.email as user_email,
        reviewer.email as reviewer_email
      FROM kyc_verifications kv
      LEFT JOIN users u ON kv.user_id = u.id
      LEFT JOIN users reviewer ON kv.reviewer_id = reviewer.id
      ${whereClause}
      ORDER BY kv.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, [...params, filters.limit, offset]);

    const verifications = result.rows.map(row => ({
      verification_id: row.id,
      user_email: row.user_email,
      document_type: row.document_type,
      status: row.status,
      risk_level: row.risk_level,
      confidence_score: row.confidence_score,
      risk_flags: row.risk_flags,
      verification_details: row.verification_details,
      reviewer_email: row.reviewer_email,
      reviewer_notes: row.reviewer_notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      reviewed_at: row.reviewed_at,
    }));

    return { verifications, total };
  }

  /**
   * Get KYC statistics
   */
  async getKYCStatistics(): Promise<any> {
    const results = await Promise.all([
      // Total verifications by status
      this.db.query(`
        SELECT status, COUNT(*) as count 
        FROM kyc_verifications 
        GROUP BY status
      `),
      // Verifications by risk level
      this.db.query(`
        SELECT risk_level, COUNT(*) as count 
        FROM kyc_verifications 
        GROUP BY risk_level
      `),
      // Verifications by document type
      this.db.query(`
        SELECT document_type, COUNT(*) as count 
        FROM kyc_verifications 
        GROUP BY document_type
      `),
      // Average processing time
      this.db.query(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) as avg_hours
        FROM kyc_verifications 
        WHERE reviewed_at IS NOT NULL
      `),
      // Recent activity (last 30 days)
      this.db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as submissions
        FROM kyc_verifications 
        WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
    ]);

    return {
      statusCounts: results[0].rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      riskLevelCounts: results[1].rows.reduce((acc, row) => {
        acc[row.risk_level] = parseInt(row.count);
        return acc;
      }, {}),
      documentTypeCounts: results[2].rows.reduce((acc, row) => {
        acc[row.document_type] = parseInt(row.count);
        return acc;
      }, {}),
      averageProcessingHours: parseFloat(results[3].rows[0]?.avg_hours || '0'),
      recentActivity: results[4].rows.map(row => ({
        date: row.date,
        submissions: parseInt(row.submissions),
      })),
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      // Test database connectivity
      await this.db.query('SELECT 1');
      
      // Get recent verification counts
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h
        FROM kyc_verifications
      `);

      const stats = result.rows[0];

      return {
        database: 'connected',
        provider: config.kyc.provider,
        features: {
          jumio: !!this.jumioConfig.apiToken,
          onfido: false, // Not implemented yet
          mock: true,
        },
        statistics: {
          totalVerifications: parseInt(stats.total),
          pendingVerifications: parseInt(stats.pending),
          last24Hours: parseInt(stats.last_24h),
        },
      };
    } catch (error) {
      throw new Error(`KYC service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const kycService = new KYCService(
  // This will be injected by the server initialization
  {} as Pool
);

// Export function to set the database instance
export const setKYCService = (instance: KYCService) => {
  Object.assign(kycService, instance);
};

// Export initialization function
export const initializeKYCService = async (database: Pool): Promise<KYCService> => {
  return new KYCService(database);
};