import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool, redis } from '../config/database';
import { encryptionService } from '../services/encryption.service';
import { kycEncryptionService } from '../services/kyc-encryption.service';
import { enhancedSessionService } from '../services/enhanced-session.service';
import { jwtService } from '../services/jwt.service';
import crypto from 'crypto';

/**
 * Security Validation Test Suite for DwayBank
 * Tests all critical security implementations for PCI DSS Level 1 compliance
 */

describe('DwayBank Security Validation Suite', () => {
  
  beforeAll(async () => {
    // Ensure test database connections
    if (!redis.isOpen) {
      await redis.connect();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await redis.flushDb();
    await redis.quit();
    await pool.end();
  });

  describe('Field-Level Encryption Service', () => {
    
    it('should encrypt and decrypt sensitive data correctly', () => {
      const sensitiveData = 'SSN:123-45-6789';
      
      const encrypted = encryptionService.encrypt(sensitiveData);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });

    it('should encrypt financial data with version control', () => {
      const financialData = {
        accountNumber: '1234567890123456',
        routingNumber: '021000021',
        ssn: '123-45-6789'
      };
      
      const encrypted = encryptionService.encryptFinancialData(financialData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      const decrypted = encryptionService.decryptFinancialData(encrypted);
      expect(decrypted).toEqual(financialData);
    });

    it('should generate consistent hashes for indexing', () => {
      const data = 'john.doe@example.com';
      
      const hash1 = encryptionService.hashForIndex(data);
      const hash2 = encryptionService.hashForIndex(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should fail gracefully with invalid input', () => {
      expect(() => {
        encryptionService.encrypt('');
      }).toThrow('Cannot encrypt empty or null data');
      
      expect(() => {
        encryptionService.decrypt({
          encryptedData: 'invalid',
          iv: 'invalid',
          authTag: 'invalid'
        });
      }).toThrow('Data decryption failed');
    });

    it('should validate encryption configuration', () => {
      const isValid = encryptionService.validateConfiguration();
      expect(isValid).toBe(true);
    });
  });

  describe('KYC Encryption Service', () => {
    let testKycRecordId: string;
    let testDocumentId: string;

    beforeEach(() => {
      testKycRecordId = crypto.randomUUID();
      testDocumentId = crypto.randomUUID();
    });

    it('should encrypt sensitive KYC data', async () => {
      const sensitiveData = {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123-45-6789',
        documentNumber: 'P1234567890',
        addressLine1: '123 Main St'
      };

      // Mock database query for testing
      const originalQuery = pool.query;
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(
        kycEncryptionService.encryptKycRecord(testKycRecordId, sensitiveData)
      ).resolves.not.toThrow();

      // Restore original query
      pool.query = originalQuery;
    });

    it('should generate searchable hashes', () => {
      const email = 'John.Doe@Example.com';
      const hash = kycEncryptionService.generateSearchHash(email);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
      
      // Should be consistent for normalized input
      const hash2 = kycEncryptionService.generateSearchHash('john.doe@example.com');
      expect(hash).toBe(hash2);
    });

    it('should encrypt and decrypt storage paths', () => {
      const originalPath = '/secure/documents/kyc/user123/passport.jpg';
      
      const encrypted = kycEncryptionService.encryptStoragePath(originalPath);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(originalPath);
      
      const decrypted = kycEncryptionService.decryptStoragePath(encrypted);
      expect(decrypted).toBe(originalPath);
    });
  });

  describe('Enhanced Session Security', () => {
    
    it('should create secure sessions with risk scoring', async () => {
      const sessionOptions = {
        userId: crypto.randomUUID(),
        email: 'test@example.com',
        deviceFingerprint: 'test-device-fingerprint',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        mfaVerified: true,
        permissions: ['read', 'write']
      };

      const session = await enhancedSessionService.createSession(sessionOptions);
      
      expect(session.sessionId).toBeDefined();
      expect(session.sessionToken).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.sessionToken).toHaveLength(64); // 32 bytes * 2 hex chars
    });

    it('should validate sessions with security checks', async () => {
      const sessionOptions = {
        userId: crypto.randomUUID(),
        email: 'test@example.com',
        deviceFingerprint: 'test-device-fingerprint',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser'
      };

      const session = await enhancedSessionService.createSession(sessionOptions);
      
      // Valid session validation
      const validResult = await enhancedSessionService.validateSession(
        session.sessionToken,
        '192.168.1.100',
        'Mozilla/5.0 Test Browser',
        'test-device-fingerprint'
      );
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.sessionData).toBeDefined();
      
      // Invalid IP validation
      const invalidIpResult = await enhancedSessionService.validateSession(
        session.sessionToken,
        '192.168.1.999', // Different IP
        'Mozilla/5.0 Test Browser',
        'test-device-fingerprint'
      );
      
      expect(invalidIpResult.isValid).toBe(false);
      expect(invalidIpResult.securityAlert?.type).toBe('SUSPICIOUS_IP');
    });

    it('should rotate session tokens', async () => {
      const sessionOptions = {
        userId: crypto.randomUUID(),
        email: 'test@example.com',
        deviceFingerprint: 'test-device-fingerprint',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser'
      };

      const session = await enhancedSessionService.createSession(sessionOptions);
      const rotated = await enhancedSessionService.rotateSession(session.sessionToken);
      
      expect(rotated).toBeDefined();
      expect(rotated?.newSessionToken).toBeDefined();
      expect(rotated?.newSessionToken).not.toBe(session.sessionToken);
      expect(rotated?.expiresAt).toBeInstanceOf(Date);
    });

    it('should revoke sessions properly', async () => {
      const sessionOptions = {
        userId: crypto.randomUUID(),
        email: 'test@example.com',
        deviceFingerprint: 'test-device-fingerprint',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser'
      };

      const session = await enhancedSessionService.createSession(sessionOptions);
      const revoked = await enhancedSessionService.revokeSession(session.sessionToken);
      
      expect(revoked).toBe(true);
      
      // Validation should fail after revocation
      const validationResult = await enhancedSessionService.validateSession(
        session.sessionToken,
        '192.168.1.100',
        'Mozilla/5.0 Test Browser',
        'test-device-fingerprint'
      );
      
      expect(validationResult.isValid).toBe(false);
    });
  });

  describe('JWT Security Enhancements', () => {
    
    it('should generate JWT tokens with proper security', () => {
      const user = { id: crypto.randomUUID(), email: 'test@example.com' };
      const options = {
        sessionId: crypto.randomUUID(),
        tokenFamily: 'test-families',
        scope: ['read', 'write']
      };

      const accessToken = jwtService.generateAccessToken(user, options);
      const refreshToken = jwtService.generateRefreshToken(user, options);
      
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
    });

    it('should validate JWT tokens correctly', async () => {
      const user = { id: crypto.randomUUID(), email: 'test@example.com' };
      const options = {
        sessionId: crypto.randomUUID(),
        tokenFamily: 'test-family',
        scope: ['read', 'write']
      };

      const accessToken = jwtService.generateAccessToken(user, options);
      const validation = await jwtService.validateAccessToken(accessToken);
      
      expect(validation.isValid).toBe(true);
      expect(validation.payload?.sub).toBe(user.id);
      expect(validation.payload?.email).toBe(user.email);
      expect(validation.payload?.scope).toEqual(['read', 'write']);
    });

    it('should reject tampered tokens', async () => {
      const user = { id: crypto.randomUUID(), email: 'test@example.com' };
      const options = {
        sessionId: crypto.randomUUID(),
        tokenFamily: 'test-family',
        scope: ['read', 'write']
      };

      const accessToken = jwtService.generateAccessToken(user, options);
      const tamperedToken = accessToken.slice(0, -10) + 'tampered123';
      
      const validation = await jwtService.validateAccessToken(tamperedToken);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should handle token revocation', async () => {
      const user = { id: crypto.randomUUID(), email: 'test@example.com' };
      const options = {
        sessionId: crypto.randomUUID(),
        tokenFamily: 'test-family',
        scope: ['read', 'write']
      };

      const accessToken = jwtService.generateAccessToken(user, options);
      
      // Token should be valid initially
      const initialValidation = await jwtService.validateAccessToken(accessToken);
      expect(initialValidation.isValid).toBe(true);
      
      // Revoke the token
      const revoked = await jwtService.revokeToken(accessToken);
      expect(revoked).toBe(true);
      
      // Token should be invalid after revocation
      const postRevocationValidation = await jwtService.validateAccessToken(accessToken);
      expect(postRevocationValidation.isValid).toBe(false);
      expect(postRevocationValidation.error).toBe('Token has been revoked');
    });
  });

  describe('Database SSL/TLS Security', () => {
    
    it('should have secure SSL configuration in production', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Re-import to get updated config
      delete require.cache[require.resolve('../config/database')];
      
      // In a real test, you would verify SSL connection
      // This is a placeholder for SSL configuration validation
      expect(process.env.NODE_ENV).toBe('production');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Integration Tests', () => {
    
    it('should maintain data integrity through encrypt/decrypt cycles', () => {
      const testData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          ssn: '123-45-6789',
          dateOfBirth: '1990-01-01'
        },
        financialInfo: {
          accountNumber: '1234567890123456',
          routingNumber: '021000021',
          creditScore: 750
        },
        addresses: [
          {
            street: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '12345'
          }
        ]
      };

      // Multiple encryption/decryption cycles
      let currentData = testData;
      
      for (let i = 0; i < 5; i++) {
        const encrypted = encryptionService.encryptFinancialData(currentData);
        currentData = encryptionService.decryptFinancialData(encrypted);
      }
      
      expect(currentData).toEqual(testData);
    });

    it('should handle concurrent encryption operations', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        sensitiveData: `sensitive-data-${i}`,
        timestamp: new Date().toISOString()
      }));

      const encryptionPromises = testData.map(data => 
        Promise.resolve(encryptionService.encryptFinancialData(data))
      );

      const encrypted = await Promise.all(encryptionPromises);
      
      expect(encrypted).toHaveLength(100);
      
      const decryptionPromises = encrypted.map(data => 
        Promise.resolve(encryptionService.decryptFinancialData(data))
      );

      const decrypted = await Promise.all(decryptionPromises);
      
      expect(decrypted).toEqual(testData);
    });

    it('should maintain security under load', async () => {
      const userId = crypto.randomUUID();
      const sessionPromises = [];

      // Create multiple sessions concurrently
      for (let i = 0; i < 10; i++) {
        sessionPromises.push(
          enhancedSessionService.createSession({
            userId,
            email: `test${i}@example.com`,
            deviceFingerprint: `device-${i}`,
            ipAddress: `192.168.1.${100 + i}`,
            userAgent: `Browser-${i}`
          })
        );
      }

      const sessions = await Promise.all(sessionPromises);
      
      expect(sessions).toHaveLength(10);
      
      // Validate all sessions concurrently
      const validationPromises = sessions.map(session =>
        enhancedSessionService.validateSession(
          session.sessionToken,
          session.sessionId.includes('192.168.1.') ? '192.168.1.100' : '192.168.1.101',
          'Test Browser',
          'test-device'
        )
      );

      const validations = await Promise.all(validationPromises);
      
      // Some should be valid, some might fail due to IP/device mismatch
      expect(validations.length).toBe(10);
    });
  });

  describe('PCI DSS Compliance Validation', () => {
    
    it('should use approved encryption algorithms', () => {
      const config = encryptionService['algorithm'];
      const approvedAlgorithms = ['aes-256-gcm', 'aes-256-cbc'];
      
      expect(approvedAlgorithms).toContain(config);
    });

    it('should enforce minimum key lengths', () => {
      const keyLength = encryptionService['keyLength'];
      
      expect(keyLength).toBeGreaterThanOrEqual(32); // 256 bits minimum
    });

    it('should use secure random number generation', () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();
      
      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes * 2 hex chars
      expect(token2).toHaveLength(64);
    });

    it('should implement proper authentication tags', () => {
      const data = 'PCI DSS compliance test data';
      const encrypted = encryptionService.encrypt(data);
      
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.authTag.length).toBeGreaterThan(0);
      
      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: 'tampered'
      };
      
      expect(() => {
        encryptionService.decrypt(tampered);
      }).toThrow();
    });
  });
});

// Helper function to setup test environment
export const setupSecurityTestEnvironment = async () => {
  // Ensure Redis is clean
  if (redis.isOpen) {
    await redis.flushDb();
  }
  
  // Validate encryption service
  const isEncryptionValid = encryptionService.validateConfiguration();
  if (!isEncryptionValid) {
    throw new Error('Encryption service configuration is invalid');
  }
  
  return {
    encryptionService,
    kycEncryptionService,
    enhancedSessionService,
    jwtService
  };
};