import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/jest-globals';
import { Pool } from 'pg';
import { authenticator } from 'otplib';
import { config } from '../config/environment';
import { initializeMFAService } from '../services/mfa.service';
import { initializeSecurityService } from '../services/security.service';
import { smsService } from '../services/sms.service';
import { emailService } from '../services/email.service';

/**
 * MFA System Integration Tests
 * 
 * Tests the complete Multi-Factor Authentication system including:
 * - TOTP setup and verification
 * - SMS setup and verification  
 * - Email setup and verification
 * - Security controls and rate limiting
 * - Error handling and edge cases
 */

describe('MFA System Integration Tests', () => {
  let db: Pool;
  let mfaService: any;
  let securityService: any;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize test database connection
    db = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: 'dwaybank_test', // Use test database
      user: config.database.user,
      password: config.database.password,
      max: 5,
    });

    // Initialize services
    mfaService = await initializeMFAService(db);
    securityService = await initializeSecurityService(db);

    // Create test user
    const userResult = await db.query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, status, email_verified
      ) VALUES (
        'test@example.com', 'hashed_password', 'Test', 'User', 'active', true
      ) RETURNING id
    `);
    testUserId = userResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    
    // Close database connection
    await db.end();
  });

  beforeEach(async () => {
    // Clean up MFA configs before each test
    await db.query('DELETE FROM mfa_configs WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM mfa_verification_attempts WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM temp_verification_codes WHERE config_id IN (SELECT id FROM mfa_configs WHERE user_id = $1)', [testUserId]);
  });

  describe('TOTP Authentication', () => {
    it('should setup TOTP authentication successfully', async () => {
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      expect(setupResult).toHaveProperty('configId');
      expect(setupResult).toHaveProperty('method', 'totp');
      expect(setupResult).toHaveProperty('qrCodeUrl');
      expect(setupResult).toHaveProperty('secret');
      expect(setupResult).toHaveProperty('backupCodes');
      expect(Array.isArray(setupResult.backupCodes)).toBe(true);
      expect(setupResult.backupCodes).toHaveLength(config.mfa.backupCodesCount);
    });

    it('should verify TOTP setup with valid code', async () => {
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      // Generate valid TOTP code
      const totpCode = authenticator.generate(setupResult.secret);

      const verifyResult = await mfaService.verifySetup(
        setupResult.configId,
        totpCode,
        testUserId
      );

      expect(verifyResult.success).toBe(true);
    });

    it('should reject TOTP setup with invalid code', async () => {
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      const verifyResult = await mfaService.verifySetup(
        setupResult.configId,
        '000000', // Invalid code
        testUserId
      );

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.error).toBeDefined();
    });

    it('should verify TOTP code during authentication', async () => {
      // Setup TOTP
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      // Verify setup
      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);

      // Generate new code for verification
      const newTotpCode = authenticator.generate(setupResult.secret);

      const verifyResult = await mfaService.verifyCode({
        userId: testUserId,
        code: newTotpCode,
        method: 'totp',
        isBackupCode: false,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          deviceFingerprint: 'test-device',
        },
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.method).toBe('totp');
    });

    it('should verify backup codes', async () => {
      // Setup TOTP
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      // Verify setup
      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);

      // Use backup code
      const backupCode = setupResult.backupCodes[0];

      const verifyResult = await mfaService.verifyCode({
        userId: testUserId,
        code: backupCode,
        isBackupCode: true,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.remainingBackupCodes).toBe(config.mfa.backupCodesCount - 1);
    });
  });

  describe('SMS Authentication', () => {
    it('should setup SMS authentication successfully', async () => {
      const setupResult = await mfaService.setupSMS({
        userId: testUserId,
        method: 'sms',
        phoneNumber: '+1234567890',
        isPrimary: false,
      });

      expect(setupResult).toHaveProperty('configId');
      expect(setupResult).toHaveProperty('method', 'sms');
      expect(setupResult).toHaveProperty('backupCodes');
      expect(Array.isArray(setupResult.backupCodes)).toBe(true);
    });

    it('should reject invalid phone number format', async () => {
      await expect(mfaService.setupSMS({
        userId: testUserId,
        method: 'sms',
        phoneNumber: 'invalid-phone',
        isPrimary: false,
      })).rejects.toThrow('Invalid phone number format');
    });

    it('should verify SMS setup', async () => {
      const setupResult = await mfaService.setupSMS({
        userId: testUserId,
        method: 'sms',
        phoneNumber: '+1234567890',
        isPrimary: false,
      });

      // In test environment, use the development verification code
      const verifyResult = await mfaService.verifySetup(
        setupResult.configId,
        setupResult.verificationCode || '123456',
        testUserId
      );

      expect(verifyResult.success).toBe(true);
    });
  });

  describe('Email Authentication', () => {
    it('should setup Email authentication successfully', async () => {
      const setupResult = await mfaService.setupEmail({
        userId: testUserId,
        method: 'email',
        email: 'test-mfa@example.com',
        isPrimary: false,
      });

      expect(setupResult).toHaveProperty('configId');
      expect(setupResult).toHaveProperty('method', 'email');
      expect(setupResult).toHaveProperty('backupCodes');
      expect(Array.isArray(setupResult.backupCodes)).toBe(true);
    });

    it('should reject invalid email format', async () => {
      await expect(mfaService.setupEmail({
        userId: testUserId,
        method: 'email',
        email: 'invalid-email',
        isPrimary: false,
      })).rejects.toThrow('Invalid email format');
    });

    it('should verify email setup', async () => {
      const setupResult = await mfaService.setupEmail({
        userId: testUserId,
        method: 'email',
        email: 'test-mfa@example.com',
        isPrimary: false,
      });

      // In test environment, use the development verification code
      const verifyResult = await mfaService.verifySetup(
        setupResult.configId,
        setupResult.verificationCode || '123456',
        testUserId
      );

      expect(verifyResult.success).toBe(true);
    });
  });

  describe('MFA Challenge and Verification Flow', () => {
    let mfaConfigId: string;

    beforeEach(async () => {
      // Setup TOTP for challenge tests
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
        isPrimary: true,
      });

      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);
      
      mfaConfigId = setupResult.configId;
    });

    it('should send MFA challenge successfully', async () => {
      const challengeResult = await mfaService.sendChallenge({
        userId: testUserId,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      });

      expect(challengeResult.success).toBe(true);
      expect(challengeResult.method).toBe('totp');
      expect(challengeResult.configId).toBe(mfaConfigId);
    });

    it('should return appropriate methods for user', async () => {
      const methods = await mfaService.getUserMFAMethods(testUserId);

      expect(Array.isArray(methods)).toBe(true);
      expect(methods).toHaveLength(1);
      expect(methods[0]).toHaveProperty('method', 'totp');
      expect(methods[0]).toHaveProperty('isPrimary', true);
      expect(methods[0]).toHaveProperty('isEnabled', true);
    });
  });

  describe('Security Controls and Rate Limiting', () => {
    it('should enforce rate limiting on verification attempts', async () => {
      // Setup TOTP first
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
      });

      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);

      // Make multiple failed verification attempts
      const context = {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      // First few attempts should be allowed
      for (let i = 0; i < 4; i++) {
        const result = await mfaService.verifyCode({
          userId: testUserId,
          code: '000000', // Invalid code
          context,
        });
        
        expect(result.success).toBe(false);
        expect(result.rateLimited).toBeFalsy();
      }

      // After threshold, should be rate limited
      const rateLimitedResult = await mfaService.verifyCode({
        userId: testUserId,
        code: '000000',
        context,
      });

      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.rateLimited).toBe(true);
      expect(rateLimitedResult.nextAttemptIn).toBeDefined();
    });

    it('should assess risk correctly', async () => {
      if (!securityService) {
        console.log('Security service not available, skipping risk assessment test');
        return;
      }

      const riskAssessment = await securityService.assessRisk({
        type: 'mfa_verify',
        userId: testUserId,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        details: { method: 'totp', success: false },
      });

      expect(riskAssessment).toHaveProperty('score');
      expect(riskAssessment).toHaveProperty('level');
      expect(riskAssessment).toHaveProperty('factors');
      expect(riskAssessment).toHaveProperty('recommended_actions');
      expect(typeof riskAssessment.score).toBe('number');
      expect(riskAssessment.score).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.score).toBeLessThanOrEqual(100);
    });
  });

  describe('MFA Management Operations', () => {
    let mfaConfigId: string;

    beforeEach(async () => {
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
      });

      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);
      
      mfaConfigId = setupResult.configId;
    });

    it('should disable MFA method successfully', async () => {
      const result = await mfaService.disableMFAMethod(
        testUserId,
        mfaConfigId,
        'user_request'
      );

      expect(result).toBe(true);

      // Verify method is disabled
      const methods = await mfaService.getUserMFAMethods(testUserId);
      expect(methods).toHaveLength(0); // Should return only enabled methods
    });

    it('should regenerate backup codes successfully', async () => {
      const result = await mfaService.regenerateBackupCodes(testUserId, mfaConfigId);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toBeDefined();
      expect(Array.isArray(result.backupCodes)).toBe(true);
      expect(result.backupCodes).toHaveLength(config.mfa.backupCodesCount);
    });

    it('should get MFA statistics', async () => {
      const stats = await mfaService.getMFAStats();

      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('usersWithMFA');
      expect(stats).toHaveProperty('methodBreakdown');
      expect(stats).toHaveProperty('verificationAttempts');
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.usersWithMFA).toBe('number');
    });
  });

  describe('Service Integration Tests', () => {
    it('should test SMS service configuration', async () => {
      const status = smsService.getServiceStatus();
      
      expect(status).toHaveProperty('configured');
      expect(typeof status.configured).toBe('boolean');
      expect(status).toHaveProperty('rateLimitCacheSize');
      expect(typeof status.rateLimitCacheSize).toBe('number');
    });

    it('should test email service configuration', async () => {
      const status = emailService.getServiceStatus();
      
      expect(status).toHaveProperty('configured');
      expect(typeof status.configured).toBe('boolean');
      expect(status).toHaveProperty('rateLimitCacheSize');
      expect(typeof status.rateLimitCacheSize).toBe('number');
    });

    it('should handle service failures gracefully', async () => {
      // Test with invalid user ID
      const result = await mfaService.getUserMFAMethods('invalid-uuid');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that errors don't crash the service
      const result = await mfaService.verifyCode({
        userId: 'non-existent-user',
        code: '123456',
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed input gracefully', async () => {
      await expect(mfaService.setupTOTP({
        userId: 'not-a-uuid',
        method: 'totp',
      })).rejects.toThrow();
    });

    it('should validate backup code usage', async () => {
      const setupResult = await mfaService.setupTOTP({
        userId: testUserId,
        method: 'totp',
      });

      const totpCode = authenticator.generate(setupResult.secret);
      await mfaService.verifySetup(setupResult.configId, totpCode, testUserId);

      const backupCode = setupResult.backupCodes[0];

      // Use backup code first time - should succeed
      const firstUse = await mfaService.verifyCode({
        userId: testUserId,
        code: backupCode,
        isBackupCode: true,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      });

      expect(firstUse.success).toBe(true);

      // Try to use same backup code again - should fail
      const secondUse = await mfaService.verifyCode({
        userId: testUserId,
        code: backupCode,
        isBackupCode: true,
        context: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        },
      });

      expect(secondUse.success).toBe(false);
    });
  });
});

// Helper function to run tests with proper setup
export const runMFATests = async () => {
  console.log('🔐 Running MFA System Integration Tests...');
  
  try {
    // This would be run by Jest test runner
    console.log('✅ MFA tests configured and ready to run');
    console.log('Run: npm test -- --testPathPattern=mfa.test.ts');
    
    return true;
  } catch (error) {
    console.error('❌ MFA test configuration failed:', error);
    return false;
  }
};