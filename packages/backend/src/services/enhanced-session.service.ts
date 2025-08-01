import crypto from 'crypto';
import { redis } from '../config/database';
import { jwtService } from './jwt.service';
import { encryptionService } from './encryption.service';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';

/**
 * Enhanced Session Security Service for DwayBank
 * Implements enterprise-grade session management with:
 * - Encrypted session storage
 * - Device fingerprinting
 * - IP-based validation
 * - Session rotation
 * - Concurrent session limits
 * - Security event tracking
 */

export interface SessionData {
  userId: string;
  email: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  mfaVerified: boolean;
  riskScore: number;
  geoLocation?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  permissions: string[];
}

export interface SessionValidationResult {
  isValid: boolean;
  sessionData?: SessionData;
  securityAlert?: {
    type: 'SUSPICIOUS_IP' | 'DEVICE_MISMATCH' | 'CONCURRENT_LIMIT' | 'EXPIRED' | 'REVOKED';
    message: string;
    riskScore: number;
  };
}

export interface CreateSessionOptions {
  userId: string;
  email: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  mfaVerified?: boolean;
  geoLocation?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  permissions?: string[];
  rememberMe?: boolean;
}

export class EnhancedSessionService {
  private readonly maxConcurrentSessions = 5;
  private readonly sessionTtl = 24 * 60 * 60; // 24 hours in seconds
  private readonly suspiciousActivityThreshold = 10;

  /**
   * Create a new secure session
   */
  public async createSession(options: CreateSessionOptions): Promise<{
    sessionId: string;
    sessionToken: string;
    expiresAt: Date;
  }> {
    try {
      const sessionId = this.generateSecureSessionId();
      const sessionToken = encryptionService.generateSecureToken(32);
      
      // Check concurrent session limit
      await this.enforceConcurrentSessionLimit(options.userId);
      
      // Calculate initial risk score
      const riskScore = await this.calculateRiskScore({
        ipAddress: options.ipAddress,
        deviceFingerprint: options.deviceFingerprint,
        userId: options.userId
      });
      
      const sessionData: SessionData = {
        userId: options.userId,
        email: options.email,
        deviceFingerprint: options.deviceFingerprint,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 1,
        mfaVerified: options.mfaVerified || false,
        riskScore,
        geoLocation: options.geoLocation,
        permissions: options.permissions || ['read', 'write']
      };
      
      // Encrypt session data
      const encryptedSessionData = encryptionService.encryptFinancialData(sessionData);
      
      // Store in Redis with TTL
      const ttl = options.rememberMe ? this.sessionTtl * 7 : this.sessionTtl; // 7 days if remember me
      await redis.setEx(
        `session:${sessionId}`,
        ttl,
        encryptedSessionData
      );
      
      // Store session token mapping
      await redis.setEx(
        `session_token:${sessionToken}`,
        ttl,
        sessionId
      );
      
      // Track user sessions
      await redis.sAdd(`user_sessions:${options.userId}`, sessionId);
      await redis.expire(`user_sessions:${options.userId}`, ttl);
      
      const expiresAt = new Date(Date.now() + (ttl * 1000));
      
      auditLogger.info('Secure session created', {
        sessionId,
        userId: options.userId,
        ipAddress: options.ipAddress,
        deviceFingerprint: options.deviceFingerprint,
        riskScore,
        expiresAt: expiresAt.toISOString()
      });
      
      return {
        sessionId,
        sessionToken,
        expiresAt
      };
      
    } catch (error) {
      logger.error('Failed to create secure session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: options.userId,
        ipAddress: options.ipAddress
      });
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate session with security checks
   */
  public async validateSession(
    sessionToken: string,
    requestIp: string,
    userAgent: string,
    deviceFingerprint?: string
  ): Promise<SessionValidationResult> {
    try {
      // Get session ID from token
      const sessionId = await redis.get(`session_token:${sessionToken}`);
      
      if (!sessionId) {
        return {
          isValid: false,
          securityAlert: {
            type: 'EXPIRED',
            message: 'Session token not found or expired',
            riskScore: 5
          }
        };
      }
      
      // Get encrypted session data
      const encryptedSessionData = await redis.get(`session:${sessionId}`);
      
      if (!encryptedSessionData) {
        return {
          isValid: false,
          securityAlert: {
            type: 'EXPIRED',
            message: 'Session data not found',
            riskScore: 5
          }
        };
      }
      
      // Decrypt session data
      const sessionData = encryptionService.decryptFinancialData<SessionData>(encryptedSessionData);
      
      // Perform security validations
      const securityCheck = this.performSecurityValidations(sessionData, {
        requestIp,
        userAgent,
        deviceFingerprint
      });
      
      if (!securityCheck.isValid) {
        // Log security event
        auditLogger.warn('Session security validation failed', {
          sessionId,
          userId: sessionData.userId,
          securityAlert: securityCheck.securityAlert,
          requestIp,
          storedIp: sessionData.ipAddress
        });
        
        return securityCheck;
      }
      
      // Update session access info
      sessionData.lastAccessedAt = new Date();
      sessionData.accessCount += 1;
      
      // Re-encrypt and store updated session data
      const updatedEncryptedData = encryptionService.encryptFinancialData(sessionData);
      await redis.set(`session:${sessionId}`, updatedEncryptedData);
      
      return {
        isValid: true,
        sessionData
      };
      
    } catch (error) {
      logger.error('Session validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestIp
      });
      
      return {
        isValid: false,
        securityAlert: {
          type: 'EXPIRED',
          message: 'Session validation error',
          riskScore: 8
        }
      };
    }
  }

  /**
   * Rotate session for enhanced security
   */
  public async rotateSession(sessionToken: string): Promise<{
    newSessionToken: string;
    expiresAt: Date;
  } | null> {
    try {
      const sessionId = await redis.get(`session_token:${sessionToken}`);
      
      if (!sessionId) {
        return null;
      }
      
      // Generate new session token
      const newSessionToken = encryptionService.generateSecureToken(32);
      
      // Remove old token mapping
      await redis.del(`session_token:${sessionToken}`);
      
      // Create new token mapping
      const ttl = await redis.ttl(`session:${sessionId}`);
      await redis.setEx(`session_token:${newSessionToken}`, ttl, sessionId);
      
      const expiresAt = new Date(Date.now() + (ttl * 1000));
      
      auditLogger.info('Session token rotated', {
        sessionId,
        newTokenGenerated: true,
        expiresAt: expiresAt.toISOString()
      });
      
      return {
        newSessionToken,
        expiresAt
      };
      
    } catch (error) {
      logger.error('Session rotation failed', { error });
      return null;
    }
  }

  /**
   * Revoke session
   */
  public async revokeSession(sessionToken: string): Promise<boolean> {
    try {
      const sessionId = await redis.get(`session_token:${sessionToken}`);
      
      if (!sessionId) {
        return false;
      }
      
      // Get session data for audit
      const encryptedSessionData = await redis.get(`session:${sessionId}`);
      let userId = '';
      
      if (encryptedSessionData) {
        const sessionData = encryptionService.decryptFinancialData<SessionData>(encryptedSessionData);
        userId = sessionData.userId;
        
        // Remove from user sessions set
        await redis.sRem(`user_sessions:${userId}`, sessionId);
      }
      
      // Remove session data and token mapping
      await redis.del(`session:${sessionId}`);
      await redis.del(`session_token:${sessionToken}`);
      
      auditLogger.info('Session revoked', {
        sessionId,
        userId,
        revokedAt: new Date().toISOString()
      });
      
      return true;
      
    } catch (error) {
      logger.error('Session revocation failed', { error });
      return false;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  public async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await redis.sMembers(`user_sessions:${userId}`);
      let revokedCount = 0;
      
      for (const sessionId of sessionIds) {
        // Find and remove token mapping
        const tokenKeys = await redis.keys(`session_token:*`);
        
        for (const tokenKey of tokenKeys) {
          const storedSessionId = await redis.get(tokenKey);
          if (storedSessionId === sessionId) {
            await redis.del(tokenKey);
            break;
          }
        }
        
        // Remove session data
        await redis.del(`session:${sessionId}`);
        revokedCount++;
      }
      
      // Clear user sessions set
      await redis.del(`user_sessions:${userId}`);
      
      auditLogger.info('All user sessions revoked', {
        userId,
        revokedCount,
        revokedAt: new Date().toISOString()
      });
      
      return revokedCount;
      
    } catch (error) {
      logger.error('Failed to revoke all user sessions', { error, userId });
      return 0;
    }
  }

  /**
   * Get active sessions for a user
   */
  public async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessionIds = await redis.sMembers(`user_sessions:${userId}`);
      const sessions: SessionData[] = [];
      
      for (const sessionId of sessionIds) {
        const encryptedData = await redis.get(`session:${sessionId}`);
        
        if (encryptedData) {
          try {
            const sessionData = encryptionService.decryptFinancialData<SessionData>(encryptedData);
            sessions.push(sessionData);
          } catch (decryptError) {
            logger.warn('Failed to decrypt session data', { sessionId, userId });
          }
        }
      }
      
      return sessions.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
      
    } catch (error) {
      logger.error('Failed to get user active sessions', { error, userId });
      return [];
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSecureSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `sess_${timestamp}_${randomBytes}`;
  }

  /**
   * Enforce concurrent session limits
   */
  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const sessionIds = await redis.sMembers(`user_sessions:${userId}`);
    
    if (sessionIds.length >= this.maxConcurrentSessions) {
      // Remove oldest session
      const sessions = await this.getUserActiveSessions(userId);
      
      if (sessions.length > 0) {
        const oldestSession = sessions[sessions.length - 1];
        
        // Find and revoke the oldest session
        const tokenKeys = await redis.keys(`session_token:*`);
        
        for (const tokenKey of tokenKeys) {
          const sessionData = await redis.get(`session:${await redis.get(tokenKey) || ''}`);
          
          if (sessionData) {
            const decryptedData = encryptionService.decryptFinancialData<SessionData>(sessionData);
            
            if (decryptedData.createdAt.getTime() === oldestSession.createdAt.getTime()) {
              const sessionToken = tokenKey.replace('session_token:', '');
              await this.revokeSession(sessionToken);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Calculate risk score based on multiple factors
   */
  private async calculateRiskScore(params: {
    ipAddress: string;
    deviceFingerprint: string;
    userId: string;
  }): Promise<number> {
    let riskScore = 0;
    
    try {
      // Check IP reputation (simplified - in production, use external service)
      const ipHistory = await redis.get(`ip_history:${params.ipAddress}`);
      if (ipHistory) {
        const history = JSON.parse(ipHistory);
        if (history.failedAttempts > 5) {
          riskScore += 3;
        }
      }
      
      // Check device fingerprint history
      const deviceHistory = await redis.get(`device_history:${params.deviceFingerprint}`);
      if (!deviceHistory) {
        riskScore += 2; // New device
      }
      
      // Check user login patterns
      const userSessions = await this.getUserActiveSessions(params.userId);
      const uniqueIPs = new Set(userSessions.map(s => s.ipAddress));
      
      if (uniqueIPs.size > 3) {
        riskScore += 2; // Multiple IPs
      }
      
      return Math.min(riskScore, 10); // Cap at 10
      
    } catch (error) {
      logger.warn('Failed to calculate risk score', { error });
      return 3; // Default moderate risk
    }
  }

  /**
   * Perform comprehensive security validations
   */
  private performSecurityValidations(
    sessionData: SessionData,
    request: {
      requestIp: string;
      userAgent: string;
      deviceFingerprint?: string;
    }
  ): SessionValidationResult {
    
    // IP address validation
    if (sessionData.ipAddress !== request.requestIp) {
      return {
        isValid: false,
        securityAlert: {
          type: 'SUSPICIOUS_IP',
          message: 'Request from different IP address',
          riskScore: 7
        }
      };
    }
    
    // Device fingerprint validation
    if (request.deviceFingerprint && sessionData.deviceFingerprint !== request.deviceFingerprint) {
      return {
        isValid: false,
        securityAlert: {
          type: 'DEVICE_MISMATCH',
          message: 'Device fingerprint mismatch',
          riskScore: 8
        }
      };
    }
    
    // Excessive access validation
    if (sessionData.accessCount > this.suspiciousActivityThreshold) {
      return {
        isValid: false,
        securityAlert: {
          type: 'CONCURRENT_LIMIT',
          message: 'Suspicious access pattern detected',
          riskScore: 6
        }
      };
    }
    
    return { isValid: true };
  }
}

// Export singleton instance
export const enhancedSessionService = new EnhancedSessionService();