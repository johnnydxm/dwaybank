import { authenticator, totp } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { config } from '../config/environment';
import logger, { auditLogger } from '../config/logger';
import { smsService } from './sms.service';
import { emailService } from './email.service';
import { securityService } from './security.service';

/**
 * Multi-Factor Authentication Service for DwayBank
 * Supports TOTP, SMS, and Email verification methods
 */

export interface MFAConfig {
  id: string;
  userId: string;
  method: 'totp' | 'sms' | 'email' | 'biometric';
  isPrimary: boolean;
  isEnabled: boolean;
  phoneNumber?: string;
  email?: string;
  lastUsed?: Date;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface MFASetupRequest {
  userId: string;
  method: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface MFASetupResponse {
  configId: string;
  method: 'totp' | 'sms' | 'email';
  qrCodeUrl?: string; // For TOTP
  secret?: string; // For TOTP backup
  backupCodes: string[];
  verificationCode?: string; // For SMS/Email testing
}

export interface MFAVerificationRequest {
  userId: string;
  code: string;
  method?: 'totp' | 'sms' | 'email';
  configId?: string;
  isBackupCode?: boolean;
  context: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
  };
}

export interface MFAVerificationResponse {
  success: boolean;
  configId?: string;
  method?: string;
  remainingBackupCodes?: number;
  error?: string;
  rateLimited?: boolean;
  nextAttemptIn?: number;
}

export interface MFAChallengeRequest {
  userId: string;
  method?: 'totp' | 'sms' | 'email';
  context: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
  };
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
}

class MFAService {
  private db: Pool;
  private encryptionKey: Buffer;

  constructor(database: Pool) {
    this.db = database;
    this.encryptionKey = Buffer.from(config.security.encryptionKey, 'hex');
    
    // Configure TOTP settings
    authenticator.options = {
      window: config.mfa.window,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    };
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encrypt(data: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('dwaybank-mfa'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('dwaybank-mfa'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate secure backup codes
   */
  private generateBackupCodes(): BackupCode[] {
    const codes: BackupCode[] = [];
    const count = config.mfa.backupCodesCount;
    
    for (let i = 0; i < count; i++) {
      codes.push({
        code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        used: false,
      });
    }
    
    return codes;
  }

  /**
   * Check MFA rate limiting with enhanced security
   */
  private async checkRateLimit(
    userId: string,
    ipAddress: string
  ): Promise<{ allowed: boolean; nextAttemptIn?: number; blocked?: boolean; reason?: string }> {
    try {
      // Check basic rate limiting from database
      const result = await this.db.query(
        'SELECT check_mfa_rate_limit($1, $2) as allowed',
        [userId, ipAddress]
      );
      
      if (!result.rows[0].allowed) {
        // Calculate next attempt time (15 minutes from now)
        const nextAttemptIn = 15 * 60 * 1000; // 15 minutes in milliseconds
        return { allowed: false, nextAttemptIn };
      }

      // Enhanced security checks using security service
      if (securityService) {
        const blockCheck = await securityService.shouldBlock(userId, ipAddress);
        if (blockCheck.blocked) {
          return {
            allowed: false,
            blocked: true,
            reason: blockCheck.reason,
            nextAttemptIn: blockCheck.unblockAt ? blockCheck.unblockAt.getTime() - Date.now() : undefined,
          };
        }
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Rate limit check failed', { error, userId, ipAddress });
      // On error, allow the attempt but log it
      return { allowed: true };
    }
  }

  /**
   * Record MFA verification attempt
   */
  private async recordAttempt(
    userId: string,
    configId: string,
    method: 'totp' | 'sms' | 'email',
    code: string,
    isBackupCode: boolean,
    success: boolean,
    context: MFAVerificationRequest['context'],
    failureReason?: string
  ): Promise<string> {
    try {
      const result = await this.db.query(
        'SELECT record_mfa_attempt($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as attempt_id',
        [
          userId,
          configId,
          method,
          code,
          isBackupCode,
          success,
          context.ipAddress,
          context.userAgent,
          context.deviceFingerprint || null,
          failureReason || null,
        ]
      );
      
      return result.rows[0].attempt_id;
    } catch (error) {
      logger.error('Failed to record MFA attempt', { error, userId, configId });
      throw error;
    }
  }

  /**
   * Setup TOTP authentication
   */
  async setupTOTP(request: MFASetupRequest): Promise<MFASetupResponse> {
    try {
      if (request.method !== 'totp') {
        throw new Error('Invalid method for TOTP setup');
      }

      // Generate TOTP secret
      const secret = authenticator.generateSecret();
      const serviceName = config.mfa.issuer;
      
      // Get user email for QR code
      const userResult = await this.db.query(
        'SELECT email FROM users WHERE id = $1',
        [request.userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userEmail = userResult.rows[0].email;
      
      // Generate QR code
      const otpauth = authenticator.keyuri(userEmail, serviceName, secret);
      const qrCodeUrl = await QRCode.toDataURL(otpauth);
      
      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      
      // Encrypt secret and backup codes
      const encryptedSecret = this.encrypt(secret);
      const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));
      
      // Store in database
      const result = await this.db.query(`
        INSERT INTO mfa_configs 
        (user_id, method, is_primary, secret_encrypted, backup_codes_encrypted)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        request.userId,
        'totp',
        request.isPrimary || false,
        JSON.stringify(encryptedSecret),
        JSON.stringify(encryptedBackupCodes),
      ]);
      
      const configId = result.rows[0].id;
      
      auditLogger.info('TOTP MFA setup initiated', {
        userId: request.userId,
        configId,
        isPrimary: request.isPrimary,
      });
      
      return {
        configId,
        method: 'totp',
        qrCodeUrl,
        secret, // Return for manual entry
        backupCodes: backupCodes.map(bc => bc.code),
      };
      
    } catch (error) {
      logger.error('TOTP setup failed', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Setup SMS authentication
   */
  async setupSMS(request: MFASetupRequest): Promise<MFASetupResponse> {
    try {
      if (request.method !== 'sms' || !request.phoneNumber) {
        throw new Error('Invalid method or missing phone number for SMS setup');
      }

      // Validate phone number format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(request.phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));
      
      // Store in database
      const result = await this.db.query(`
        INSERT INTO mfa_configs 
        (user_id, method, is_primary, is_enabled, phone_number, backup_codes_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        request.userId,
        'sms',
        request.isPrimary || false,
        false, // Disabled until verified
        request.phoneNumber,
        JSON.stringify(encryptedBackupCodes),
      ]);
      
      const configId = result.rows[0].id;
      
      // Send verification SMS
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      await smsService.sendVerificationCode(request.phoneNumber, verificationCode);
      
      // Store verification code temporarily (in Redis or database)
      await this.storeVerificationCode(configId, verificationCode, 'sms');
      
      auditLogger.info('SMS MFA setup initiated', {
        userId: request.userId,
        configId,
        phoneNumber: request.phoneNumber,
        isPrimary: request.isPrimary,
      });
      
      return {
        configId,
        method: 'sms',
        backupCodes: backupCodes.map(bc => bc.code),
        verificationCode, // For development/testing only
      };
      
    } catch (error) {
      logger.error('SMS setup failed', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Setup Email authentication
   */
  async setupEmail(request: MFASetupRequest): Promise<MFASetupResponse> {
    try {
      if (request.method !== 'email' || !request.email) {
        throw new Error('Invalid method or missing email for Email setup');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(request.email)) {
        throw new Error('Invalid email format');
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));
      
      // Store in database
      const result = await this.db.query(`
        INSERT INTO mfa_configs 
        (user_id, method, is_primary, is_enabled, email, backup_codes_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        request.userId,
        'email',
        request.isPrimary || false,
        false, // Disabled until verified
        request.email,
        JSON.stringify(encryptedBackupCodes),
      ]);
      
      const configId = result.rows[0].id;
      
      // Send verification email
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      await emailService.sendMFAVerificationCode(request.email, verificationCode);
      
      // Store verification code temporarily
      await this.storeVerificationCode(configId, verificationCode, 'email');
      
      auditLogger.info('Email MFA setup initiated', {
        userId: request.userId,
        configId,
        email: request.email,
        isPrimary: request.isPrimary,
      });
      
      return {
        configId,
        method: 'email',
        backupCodes: backupCodes.map(bc => bc.code),
        verificationCode, // For development/testing only
      };
      
    } catch (error) {
      logger.error('Email setup failed', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Store verification code temporarily
   */
  private async storeVerificationCode(
    configId: string,
    code: string,
    method: 'sms' | 'email'
  ): Promise<void> {
    const expiryMinutes = method === 'sms' ? config.sms.expiryMinutes : config.email.expiryMinutes;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    // Store in a temporary verification table or Redis
    // For now, using database approach
    await this.db.query(`
      INSERT INTO temp_verification_codes (config_id, code, method, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_id) DO UPDATE SET
        code = EXCLUDED.code,
        method = EXCLUDED.method,
        expires_at = EXCLUDED.expires_at,
        created_at = CURRENT_TIMESTAMP
    `, [configId, code, method, expiresAt]);
  }

  /**
   * Verify MFA setup (initial verification)
   */
  async verifySetup(
    configId: string,
    code: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get MFA config
      const configResult = await this.db.query(`
        SELECT id, user_id, method, secret_encrypted, phone_number, email, is_enabled
        FROM mfa_configs 
        WHERE id = $1 AND user_id = $2
      `, [configId, userId]);
      
      if (configResult.rows.length === 0) {
        return { success: false, error: 'MFA configuration not found' };
      }
      
      const mfaConfig = configResult.rows[0];
      let isValid = false;
      
      if (mfaConfig.method === 'totp') {
        // Verify TOTP code
        const encryptedSecret = JSON.parse(mfaConfig.secret_encrypted);
        const secret = this.decrypt(encryptedSecret);
        isValid = authenticator.verify({ token: code, secret });
      } else {
        // Verify SMS/Email code
        const tempCodeResult = await this.db.query(`
          SELECT code, expires_at FROM temp_verification_codes
          WHERE config_id = $1 AND expires_at > CURRENT_TIMESTAMP
        `, [configId]);
        
        if (tempCodeResult.rows.length === 0) {
          return { success: false, error: 'Verification code expired or not found' };
        }
        
        isValid = tempCodeResult.rows[0].code === code;
        
        // Clean up temporary code
        if (isValid) {
          await this.db.query('DELETE FROM temp_verification_codes WHERE config_id = $1', [configId]);
        }
      }
      
      if (isValid) {
        // Enable the MFA method
        await this.db.query(`
          UPDATE mfa_configs 
          SET is_enabled = true, verified_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [configId]);
        
        auditLogger.info('MFA setup verified successfully', {
          userId,
          configId,
          method: mfaConfig.method,
        });
        
        return { success: true };
      } else {
        return { success: false, error: 'Invalid verification code' };
      }
      
    } catch (error) {
      logger.error('MFA setup verification failed', { error, configId, userId });
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Send MFA challenge
   */
  async sendChallenge(request: MFAChallengeRequest): Promise<{
    success: boolean;
    configId?: string;
    method?: string;
    error?: string;
  }> {
    try {
      // Check rate limiting
      const rateLimit = await this.checkRateLimit(request.userId, request.context.ipAddress);
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
        };
      }

      // Get user's MFA methods
      const methodsResult = await this.db.query(
        'SELECT * FROM get_user_mfa_methods($1)',
        [request.userId]
      );
      
      if (methodsResult.rows.length === 0) {
        return { success: false, error: 'No MFA methods configured' };
      }
      
      // Select method (primary first, or specified method)
      let selectedMethod = methodsResult.rows.find(m => m.is_primary);
      if (request.method) {
        selectedMethod = methodsResult.rows.find(m => m.method === request.method);
      }
      if (!selectedMethod) {
        selectedMethod = methodsResult.rows[0];
      }
      
      if (selectedMethod.method === 'sms' && selectedMethod.phone_number) {
        const code = crypto.randomInt(100000, 999999).toString();
        await smsService.sendVerificationCode(selectedMethod.phone_number, code);
        await this.storeVerificationCode(selectedMethod.config_id, code, 'sms');
        
        return {
          success: true,
          configId: selectedMethod.config_id,
          method: 'sms',
        };
      } else if (selectedMethod.method === 'email' && selectedMethod.email) {
        const code = crypto.randomInt(100000, 999999).toString();
        await emailService.sendMFAVerificationCode(selectedMethod.email, code);
        await this.storeVerificationCode(selectedMethod.config_id, code, 'email');
        
        return {
          success: true,
          configId: selectedMethod.config_id,
          method: 'email',
        };
      } else if (selectedMethod.method === 'totp') {
        return {
          success: true,
          configId: selectedMethod.config_id,
          method: 'totp',
        };
      }
      
      return { success: false, error: 'No valid MFA method available' };
      
    } catch (error) {
      logger.error('MFA challenge failed', { error, userId: request.userId });
      return { success: false, error: 'Challenge failed' };
    }
  }

  /**
   * Verify MFA code
   */
  async verifyCode(request: MFAVerificationRequest): Promise<MFAVerificationResponse> {
    try {
      // Check rate limiting
      const rateLimit = await this.checkRateLimit(request.userId, request.context.ipAddress);
      if (!rateLimit.allowed) {
        return {
          success: false,
          rateLimited: true,
          nextAttemptIn: rateLimit.nextAttemptIn,
          error: 'Rate limit exceeded',
        };
      }

      // Get MFA config
      let configQuery = `
        SELECT id, method, secret_encrypted, backup_codes_encrypted, phone_number, email
        FROM mfa_configs 
        WHERE user_id = $1 AND is_enabled = true
      `;
      let queryParams = [request.userId];
      
      if (request.configId) {
        configQuery += ' AND id = $2';
        queryParams.push(request.configId);
      } else if (request.method) {
        configQuery += ' AND method = $2';
        queryParams.push(request.method);
      } else {
        configQuery += ' AND is_primary = true';
      }
      
      const configResult = await this.db.query(configQuery, queryParams);
      
      if (configResult.rows.length === 0) {
        await this.recordAttempt(
          request.userId,
          request.configId || 'unknown',
          request.method || 'unknown',
          request.code,
          request.isBackupCode || false,
          false,
          request.context,
          'config_not_found'
        );
        
        return { success: false, error: 'MFA configuration not found' };
      }
      
      const mfaConfig = configResult.rows[0];
      let isValid = false;
      
      if (request.isBackupCode) {
        // Verify backup code
        const encryptedBackupCodes = JSON.parse(mfaConfig.backup_codes_encrypted);
        const backupCodes: BackupCode[] = JSON.parse(this.decrypt(encryptedBackupCodes));
        
        const codeIndex = backupCodes.findIndex(bc => bc.code === request.code && !bc.used);
        if (codeIndex !== -1) {
          isValid = true;
          
          // Mark backup code as used
          backupCodes[codeIndex].used = true;
          backupCodes[codeIndex].usedAt = new Date();
          
          const updatedEncryptedCodes = this.encrypt(JSON.stringify(backupCodes));
          await this.db.query(`
            UPDATE mfa_configs 
            SET backup_codes_encrypted = $1, backup_codes_used = backup_codes_used + 1
            WHERE id = $2
          `, [JSON.stringify(updatedEncryptedCodes), mfaConfig.id]);
        }
      } else if (mfaConfig.method === 'totp') {
        // Verify TOTP code
        const encryptedSecret = JSON.parse(mfaConfig.secret_encrypted);
        const secret = this.decrypt(encryptedSecret);
        isValid = authenticator.verify({ token: request.code, secret });
      } else {
        // Verify SMS/Email code
        const tempCodeResult = await this.db.query(`
          SELECT code FROM temp_verification_codes
          WHERE config_id = $1 AND expires_at > CURRENT_TIMESTAMP
        `, [mfaConfig.id]);
        
        if (tempCodeResult.rows.length > 0) {
          isValid = tempCodeResult.rows[0].code === request.code;
          
          // Clean up temp code if valid
          if (isValid) {
            await this.db.query('DELETE FROM temp_verification_codes WHERE config_id = $1', [mfaConfig.id]);
          }
        }
      }
      
      // Record attempt
      await this.recordAttempt(
        request.userId,
        mfaConfig.id,
        mfaConfig.method,
        request.code,
        request.isBackupCode || false,
        isValid,
        request.context,
        isValid ? null : 'invalid_code'
      );

      // Log security event
      if (securityService) {
        await securityService.logSecurityEvent({
          type: 'mfa_verify',
          userId: request.userId,
          ipAddress: request.context.ipAddress,
          userAgent: request.context.userAgent,
          details: {
            method: mfaConfig.method,
            configId: mfaConfig.id,
            isBackupCode: request.isBackupCode,
            success: isValid,
          },
          riskScore: isValid ? 5 : 25, // Lower risk for successful attempts
          blocked: false,
        });
      }
      
      if (isValid) {
        // Get remaining backup codes count
        let remainingBackupCodes = 0;
        if (mfaConfig.backup_codes_encrypted) {
          const encryptedBackupCodes = JSON.parse(mfaConfig.backup_codes_encrypted);
          const backupCodes: BackupCode[] = JSON.parse(this.decrypt(encryptedBackupCodes));
          remainingBackupCodes = backupCodes.filter(bc => !bc.used).length;
        }
        
        auditLogger.info('MFA verification successful', {
          userId: request.userId,
          configId: mfaConfig.id,
          method: mfaConfig.method,
          isBackupCode: request.isBackupCode,
          ipAddress: request.context.ipAddress,
        });
        
        return {
          success: true,
          configId: mfaConfig.id,
          method: mfaConfig.method,
          remainingBackupCodes,
        };
      } else {
        return { success: false, error: 'Invalid verification code' };
      }
      
    } catch (error) {
      logger.error('MFA verification failed', { error, userId: request.userId });
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Get user's MFA methods
   */
  async getUserMFAMethods(userId: string): Promise<MFAConfig[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM get_user_mfa_methods($1)',
        [userId]
      );
      
      return result.rows.map(row => ({
        id: row.config_id,
        userId,
        method: row.method,
        isPrimary: row.is_primary,
        isEnabled: row.is_enabled,
        phoneNumber: row.phone_number,
        email: row.email,
        lastUsed: row.last_used,
        createdAt: new Date(), // Would need to be added to the function
        verifiedAt: row.verified_at,
      }));
      
    } catch (error) {
      logger.error('Failed to get user MFA methods', { error, userId });
      return [];
    }
  }

  /**
   * Disable MFA method
   */
  async disableMFAMethod(
    userId: string,
    configId: string,
    reason: string = 'user_request'
  ): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT disable_mfa_method($1, $2) as success',
        [configId, reason]
      );
      
      const success = result.rows[0].success;
      
      if (success) {
        auditLogger.info('MFA method disabled', {
          userId,
          configId,
          reason,
        });
      }
      
      return success;
      
    } catch (error) {
      logger.error('Failed to disable MFA method', { error, userId, configId });
      return false;
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    configId: string
  ): Promise<{ success: boolean; backupCodes?: string[] }> {
    try {
      // Verify user owns the config
      const configResult = await this.db.query(
        'SELECT id FROM mfa_configs WHERE id = $1 AND user_id = $2',
        [configId, userId]
      );
      
      if (configResult.rows.length === 0) {
        return { success: false };
      }
      
      // Generate new backup codes
      const backupCodes = this.generateBackupCodes();
      const encryptedBackupCodes = this.encrypt(JSON.stringify(backupCodes));
      
      // Update in database
      await this.db.query(`
        UPDATE mfa_configs 
        SET backup_codes_encrypted = $1, backup_codes_used = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify(encryptedBackupCodes), configId]);
      
      // Log regeneration
      await this.db.query(
        'SELECT generate_backup_codes_placeholder($1)',
        [configId]
      );
      
      auditLogger.info('Backup codes regenerated', {
        userId,
        configId,
      });
      
      return {
        success: true,
        backupCodes: backupCodes.map(bc => bc.code),
      };
      
    } catch (error) {
      logger.error('Failed to regenerate backup codes', { error, userId, configId });
      return { success: false };
    }
  }

  /**
   * Get MFA statistics for admin dashboard
   */
  async getMFAStats(): Promise<{
    totalUsers: number;
    usersWithMFA: number;
    methodBreakdown: Record<string, number>;
    verificationAttempts: {
      successful: number;
      failed: number;
      total: number;
    };
  }> {
    try {
      const statsResult = await this.db.query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT mc.user_id) as users_with_mfa,
          COUNT(CASE WHEN mc.method = 'totp' THEN 1 END) as totp_count,
          COUNT(CASE WHEN mc.method = 'sms' THEN 1 END) as sms_count,
          COUNT(CASE WHEN mc.method = 'email' THEN 1 END) as email_count
        FROM users u
        LEFT JOIN mfa_configs mc ON u.id = mc.user_id AND mc.is_enabled = true
        WHERE u.deleted_at IS NULL
      `);
      
      const attemptsResult = await this.db.query(`
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN is_successful THEN 1 END) as successful_attempts,
          COUNT(CASE WHEN NOT is_successful THEN 1 END) as failed_attempts
        FROM mfa_verification_attempts
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
      `);
      
      const stats = statsResult.rows[0];
      const attempts = attemptsResult.rows[0];
      
      return {
        totalUsers: parseInt(stats.total_users) || 0,
        usersWithMFA: parseInt(stats.users_with_mfa) || 0,
        methodBreakdown: {
          totp: parseInt(stats.totp_count) || 0,
          sms: parseInt(stats.sms_count) || 0,
          email: parseInt(stats.email_count) || 0,
        },
        verificationAttempts: {
          total: parseInt(attempts.total_attempts) || 0,
          successful: parseInt(attempts.successful_attempts) || 0,
          failed: parseInt(attempts.failed_attempts) || 0,
        },
      };
      
    } catch (error) {
      logger.error('Failed to get MFA statistics', { error });
      return {
        totalUsers: 0,
        usersWithMFA: 0,
        methodBreakdown: { totp: 0, sms: 0, email: 0 },
        verificationAttempts: { total: 0, successful: 0, failed: 0 },
      };
    }
  }
}

// Create temp verification codes table if it doesn't exist
const createTempVerificationTable = async (db: Pool) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS temp_verification_codes (
        config_id UUID PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        method mfa_method NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cleanup job for expired codes
    await db.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM temp_verification_codes WHERE expires_at < CURRENT_TIMESTAMP;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
  } catch (error) {
    logger.error('Failed to create temp verification table', { error });
  }
};

// Initialize MFA service
export const initializeMFAService = async (database: Pool): Promise<MFAService> => {
  await createTempVerificationTable(database);
  return new MFAService(database);
};

// Export service instance (will be initialized in server.ts)
export let mfaService: MFAService;

export const setMFAService = (service: MFAService) => {
  mfaService = service;
};