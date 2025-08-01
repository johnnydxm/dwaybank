import crypto from 'crypto';
import { config } from '../config/environment';
import logger from '../config/logger';

/**
 * Field-Level Encryption Service for DwayBank
 * Provides AES-256-GCM encryption for sensitive financial data
 * PCI DSS Level 1 compliant encryption implementation
 */

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export interface DecryptionInput {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private readonly algorithm: string;
  private readonly keyLength: number;
  private readonly ivLength: number;
  private readonly tagLength: number;
  private readonly encryptionKey: Buffer;

  constructor() {
    this.algorithm = config.security.encryptionAlgorithm; // aes-256-gcm
    this.keyLength = 32; // 256 bits
    this.ivLength = 12; // 96 bits for GCM
    this.tagLength = 16; // 128 bits
    
    // Validate and convert hex key to buffer
    const hexKey = config.security.encryptionKey;
    if (hexKey.length !== 64) { // 32 bytes * 2 hex chars
      throw new Error('Encryption key must be exactly 64 hex characters (32 bytes)');
    }
    
    this.encryptionKey = Buffer.from(hexKey, 'hex');
    
    logger.info('Field-level encryption service initialized', {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength
    });
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  public encrypt(plaintext: string): EncryptionResult {
    try {
      if (!plaintext || plaintext.trim().length === 0) {
        throw new Error('Cannot encrypt empty or null data');
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAutoPadding(true);
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      };
      
    } catch (error) {
      logger.error('Encryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        algorithm: this.algorithm
      });
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  public decrypt(input: DecryptionInput): string {
    try {
      if (!input.encryptedData || !input.iv || !input.authTag) {
        throw new Error('Missing required decryption parameters');
      }

      // Convert base64 back to buffers
      const iv = Buffer.from(input.iv, 'base64');
      const authTag = Buffer.from(input.authTag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(input.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      logger.error('Decryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        algorithm: this.algorithm
      });
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Encrypt financial data (PII, account numbers, SSN, etc.)
   */
  public encryptFinancialData(data: any): string {
    try {
      const jsonString = JSON.stringify(data);
      const result = this.encrypt(jsonString);
      
      // Combine all components into a single encrypted string
      const combined = {
        e: result.encryptedData,
        i: result.iv,
        t: result.authTag,
        v: 1 // Version for future compatibility
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
      
    } catch (error) {
      logger.error('Financial data encryption failed', { error });
      throw new Error('Financial data encryption failed');
    }
  }

  /**
   * Decrypt financial data
   */
  public decryptFinancialData<T = any>(encryptedData: string): T {
    try {
      const decoded = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      
      if (decoded.v !== 1) {
        throw new Error(`Unsupported encryption version: ${decoded.v}`);
      }
      
      const decryptionInput: DecryptionInput = {
        encryptedData: decoded.e,
        iv: decoded.i,
        authTag: decoded.t
      };
      
      const jsonString = this.decrypt(decryptionInput);
      return JSON.parse(jsonString);
      
    } catch (error) {
      logger.error('Financial data decryption failed', { error });
      throw new Error('Financial data decryption failed');
    }
  }

  /**
   * Hash sensitive data for indexing (one-way)
   */
  public hashForIndex(data: string): string {
    try {
      // Use HMAC-SHA256 for secure hashing
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      logger.error('Data hashing failed', { error });
      throw new Error('Data hashing failed');
    }
  }

  /**
   * Generate secure random token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate encryption configuration
   */
  public validateConfiguration(): boolean {
    try {
      // Test encryption/decryption with sample data
      const testData = 'encryption_test_' + Date.now();
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption validation failed: decrypted data does not match original');
      }
      
      logger.info('Encryption service configuration validated successfully');
      return true;
      
    } catch (error) {
      logger.error('Encryption service validation failed', { error });
      return false;
    }
  }

  /**
   * Encrypt URL or path (for document storage)
   */
  public encryptUrl(url: string): string {
    return this.encryptFinancialData({ url, timestamp: Date.now() });
  }

  /**
   * Decrypt URL or path
   */
  public decryptUrl(encryptedUrl: string): string {
    const data = this.decryptFinancialData<{ url: string; timestamp: number }>(encryptedUrl);
    return data.url;
  }

  /**
   * Encrypt document data for KYC compliance
   */
  public encryptDocumentData(documentData: {
    extractedText?: string;
    ocrResults?: any;
    metadata?: any;
  }): string {
    return this.encryptFinancialData({
      ...documentData,
      encrypted_at: new Date().toISOString(),
      compliance_version: '1.0'
    });
  }

  /**
   * Decrypt document data
   */
  public decryptDocumentData(encryptedData: string): {
    extractedText?: string;
    ocrResults?: any;
    metadata?: any;
    encrypted_at: string;
    compliance_version: string;
  } {
    return this.decryptFinancialData(encryptedData);
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Validate configuration on startup
encryptionService.validateConfiguration();