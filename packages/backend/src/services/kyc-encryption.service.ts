import { pool } from '../config/database';
import { encryptionService } from './encryption.service';
import logger, { auditLogger } from '../config/logger';

/**
 * KYC Data Encryption Service
 * Handles encryption/decryption of sensitive KYC and financial data
 * Ensures PCI DSS Level 1 compliance for financial data protection
 */

export interface SensitiveKycData {
  // Personal Information
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  ssn?: string;
  taxId?: string;
  
  // Document Information
  documentNumber?: string;
  
  // Address Information
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  
  // Financial Information
  bankAccountNumber?: string;
  routingNumber?: string;
  creditCardNumber?: string;
  
  // Provider Results
  verificationResult?: any;
  extractedData?: any;
}

export interface KycDocumentData {
  extractedText?: string;
  ocrResults?: any;
  documentMetadata?: any;
  qualityScores?: {
    imageQuality?: number;
    blurScore?: number;
    glareScore?: number;
  };
}

export class KycEncryptionService {
  
  /**
   * Encrypt sensitive KYC record data
   */
  public async encryptKycRecord(
    kycRecordId: string,
    sensitiveData: SensitiveKycData
  ): Promise<void> {
    try {
      // Filter out only the fields that need encryption
      const fieldsToEncrypt = this.extractSensitiveFields(sensitiveData);
      
      if (Object.keys(fieldsToEncrypt).length === 0) {
        logger.debug('No sensitive fields to encrypt for KYC record', { kycRecordId });
        return;
      }

      // Encrypt the sensitive data
      const encryptedData = encryptionService.encryptFinancialData(fieldsToEncrypt);
      
      // Update the KYC record with encrypted data
      const query = `
        UPDATE kyc_records 
        SET verification_result_encrypted = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await pool.query(query, [encryptedData, kycRecordId]);
      
      auditLogger.info('KYC sensitive data encrypted', {
        kycRecordId,
        fieldsEncrypted: Object.keys(fieldsToEncrypt),
        encryptionAlgorithm: 'AES-256-GCM'
      });
      
    } catch (error) {
      logger.error('Failed to encrypt KYC record data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        kycRecordId
      });
      throw new Error('KYC data encryption failed');
    }
  }

  /**
   * Decrypt sensitive KYC record data
   */
  public async decryptKycRecord(kycRecordId: string): Promise<SensitiveKycData | null> {
    try {
      const query = `
        SELECT verification_result_encrypted 
        FROM kyc_records 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [kycRecordId]);
      
      if (result.rows.length === 0) {
        logger.warn('KYC record not found for decryption', { kycRecordId });
        return null;
      }
      
      const encryptedData = result.rows[0].verification_result_encrypted;
      
      if (!encryptedData) {
        return {};
      }
      
      const decryptedData = encryptionService.decryptFinancialData<SensitiveKycData>(encryptedData);
      
      auditLogger.info('KYC sensitive data decrypted', {
        kycRecordId,
        fieldsDecrypted: Object.keys(decryptedData)
      });
      
      return decryptedData;
      
    } catch (error) {
      logger.error('Failed to decrypt KYC record data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        kycRecordId
      });
      throw new Error('KYC data decryption failed');
    }
  }

  /**
   * Encrypt KYC document data
   */
  public async encryptKycDocument(
    documentId: string,
    documentData: KycDocumentData
  ): Promise<void> {
    try {
      const encryptedData = encryptionService.encryptDocumentData({
        extractedText: documentData.extractedText,
        ocrResults: documentData.ocrResults,
        metadata: {
          ...documentData.documentMetadata,
          qualityScores: documentData.qualityScores
        }
      });
      
      const query = `
        UPDATE kyc_documents 
        SET extracted_data_encrypted = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await pool.query(query, [encryptedData, documentId]);
      
      auditLogger.info('KYC document data encrypted', {
        documentId,
        hasExtractedText: !!documentData.extractedText,
        hasOcrResults: !!documentData.ocrResults,
        hasMetadata: !!documentData.documentMetadata
      });
      
    } catch (error) {
      logger.error('Failed to encrypt KYC document data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId
      });
      throw new Error('KYC document encryption failed');
    }
  }

  /**
   * Decrypt KYC document data
   */
  public async decryptKycDocument(documentId: string): Promise<KycDocumentData | null> {
    try {
      const query = `
        SELECT extracted_data_encrypted 
        FROM kyc_documents 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [documentId]);
      
      if (result.rows.length === 0) {
        logger.warn('KYC document not found for decryption', { documentId });
        return null;
      }
      
      const encryptedData = result.rows[0].extracted_data_encrypted;
      
      if (!encryptedData) {
        return {};
      }
      
      const decryptedData = encryptionService.decryptDocumentData(encryptedData);
      
      return {
        extractedText: decryptedData.extractedText,
        ocrResults: decryptedData.ocrResults,
        documentMetadata: decryptedData.metadata,
        qualityScores: decryptedData.metadata?.qualityScores
      };
      
    } catch (error) {
      logger.error('Failed to decrypt KYC document data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId
      });
      throw new Error('KYC document decryption failed');
    }
  }

  /**
   * Encrypt storage path for KYC documents
   */
  public encryptStoragePath(path: string): string {
    return encryptionService.encryptUrl(path);
  }

  /**
   * Decrypt storage path for KYC documents
   */
  public decryptStoragePath(encryptedPath: string): string {
    return encryptionService.decryptUrl(encryptedPath);
  }

  /**
   * Encrypt KYC compliance check details
   */
  public async encryptComplianceCheck(
    checkId: string,
    checkDetails: any,
    matchDetails?: any
  ): Promise<void> {
    try {
      const dataToEncrypt = {
        checkDetails,
        matchDetails,
        encryptedAt: new Date().toISOString()
      };
      
      const encryptedCheckDetails = encryptionService.encryptFinancialData(dataToEncrypt.checkDetails);
      const encryptedMatchDetails = dataToEncrypt.matchDetails 
        ? encryptionService.encryptFinancialData(dataToEncrypt.matchDetails)
        : null;
      
      const query = `
        UPDATE kyc_compliance_checks 
        SET check_details_encrypted = $1,
            match_details_encrypted = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      
      await pool.query(query, [encryptedCheckDetails, encryptedMatchDetails, checkId]);
      
      auditLogger.info('KYC compliance check encrypted', {
        checkId,
        hasCheckDetails: !!checkDetails,
        hasMatchDetails: !!matchDetails
      });
      
    } catch (error) {
      logger.error('Failed to encrypt compliance check data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checkId
      });
      throw new Error('Compliance check encryption failed');
    }
  }

  /**
   * Decrypt KYC compliance check details
   */
  public async decryptComplianceCheck(checkId: string): Promise<{
    checkDetails?: any;
    matchDetails?: any;
  } | null> {
    try {
      const query = `
        SELECT check_details_encrypted, match_details_encrypted 
        FROM kyc_compliance_checks 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [checkId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const decryptedData: any = {};
      
      if (row.check_details_encrypted) {
        decryptedData.checkDetails = encryptionService.decryptFinancialData(row.check_details_encrypted);
      }
      
      if (row.match_details_encrypted) {
        decryptedData.matchDetails = encryptionService.decryptFinancialData(row.match_details_encrypted);
      }
      
      return decryptedData;
      
    } catch (error) {
      logger.error('Failed to decrypt compliance check data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checkId
      });
      throw new Error('Compliance check decryption failed');
    }
  }

  /**
   * Extract only sensitive fields that need encryption
   */
  private extractSensitiveFields(data: SensitiveKycData): Partial<SensitiveKycData> {
    const sensitiveFields: (keyof SensitiveKycData)[] = [
      'firstName', 'lastName', 'middleName', 'dateOfBirth', 
      'ssn', 'taxId', 'documentNumber',
      'addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode',
      'bankAccountNumber', 'routingNumber', 'creditCardNumber',
      'verificationResult', 'extractedData'
    ];
    
    const result: Partial<SensitiveKycData> = {};
    
    for (const field of sensitiveFields) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        result[field] = data[field];
      }
    }
    
    return result;
  }

  /**
   * Generate searchable hash for sensitive data (for indexing)
   */
  public generateSearchHash(data: string): string {
    return encryptionService.hashForIndex(data.toLowerCase().trim());
  }

  /**
   * Bulk encrypt existing KYC records (migration utility)
   */
  public async migrateExistingRecords(): Promise<{
    processed: number;
    encrypted: number;
    errors: number;
  }> {
    const stats = { processed: 0, encrypted: 0, errors: 0 };
    
    try {
      // Get all KYC records that might have unencrypted sensitive data
      const query = `
        SELECT id, first_name, last_name, middle_name, date_of_birth,
               document_number, address_line1, address_line2, city,
               state_province, postal_code, verification_result_encrypted
        FROM kyc_records
        WHERE verification_result_encrypted IS NULL
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query);
      
      for (const row of result.rows) {
        stats.processed++;
        
        try {
          const sensitiveData: SensitiveKycData = {
            firstName: row.first_name,
            lastName: row.last_name,
            middleName: row.middle_name,
            dateOfBirth: row.date_of_birth,
            documentNumber: row.document_number,
            addressLine1: row.address_line1,
            addressLine2: row.address_line2,
            city: row.city,
            stateProvince: row.state_province,
            postalCode: row.postal_code
          };
          
          await this.encryptKycRecord(row.id, sensitiveData);
          stats.encrypted++;
          
        } catch (error) {
          stats.errors++;
          logger.error('Failed to encrypt KYC record during migration', {
            kycRecordId: row.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      logger.info('KYC encryption migration completed', stats);
      return stats;
      
    } catch (error) {
      logger.error('KYC encryption migration failed', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const kycEncryptionService = new KycEncryptionService();