import { Request, Response, NextFunction } from 'express';
import { mfaService } from '../services/mfa.service';
import { authService } from '../services/auth.service';
import logger, { auditLogger } from '../config/logger';

/**
 * MFA Middleware for DwayBank
 * Handles MFA enforcement and verification in authentication flow
 */

export interface MFARequest extends Request {
  user?: any;
  session?: any;
  mfaRequired?: boolean;
  mfaVerified?: boolean;
  mfaChallengeSent?: boolean;
  mfaMethods?: any[];
}

export interface MFAContext {
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
}

/**
 * Extract authentication context from request
 */
const getAuthContext = (req: Request): MFAContext => ({
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown',
  deviceFingerprint: req.headers['x-device-fingerprint'] as string,
});

/**
 * Check if user has MFA enabled
 */
export const checkMFAStatus = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      return next();
    }

    const userId = req.user.id;
    const mfaMethods = await mfaService.getUserMFAMethods(userId);
    const activeMethods = mfaMethods.filter(method => method.isEnabled);

    req.mfaMethods = activeMethods;
    req.mfaRequired = activeMethods.length > 0;

    logger.debug('MFA status checked', {
      userId,
      mfaRequired: req.mfaRequired,
      methodCount: activeMethods.length,
    });

    next();
  } catch (error) {
    logger.error('Failed to check MFA status', {
      error,
      userId: req.user?.id,
    });
    next();
  }
};

/**
 * Require MFA verification for protected routes
 */
export const requireMFA = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip MFA check if user is not authenticated
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const userId = req.user.id;

    // Check if user has MFA configured
    if (!req.mfaMethods) {
      const mfaMethods = await mfaService.getUserMFAMethods(userId);
      req.mfaMethods = mfaMethods.filter(method => method.isEnabled);
      req.mfaRequired = req.mfaMethods.length > 0;
    }

    // If no MFA methods configured, allow access but log warning
    if (!req.mfaRequired) {
      auditLogger.warn('Access granted to user without MFA', {
        userId,
        endpoint: req.path,
        ipAddress: getAuthContext(req).ipAddress,
      });
      return next();
    }

    // Check if MFA has been verified in this session
    const sessionMFAVerified = req.session?.mfaVerified;
    const sessionMFATimestamp = req.session?.mfaVerifiedAt;
    const MFA_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (sessionMFAVerified && sessionMFATimestamp) {
      const timeSinceVerification = Date.now() - new Date(sessionMFATimestamp).getTime();
      
      if (timeSinceVerification < MFA_SESSION_TIMEOUT) {
        req.mfaVerified = true;
        return next();
      } else {
        // MFA verification expired
        if (req.session) {
          req.session.mfaVerified = false;
          req.session.mfaVerifiedAt = null;
        }
      }
    }

    // MFA verification required
    auditLogger.info('MFA verification required', {
      userId,
      endpoint: req.path,
      methodCount: req.mfaMethods.length,
      ipAddress: getAuthContext(req).ipAddress,
    });

    res.status(403).json({
      error: 'Multi-factor authentication required',
      code: 'MFA_REQUIRED',
      challenge: {
        methods: req.mfaMethods.map(method => ({
          id: method.id,
          method: method.method,
          isPrimary: method.isPrimary,
          ...(method.phoneNumber && {
            phoneNumber: `***-***-${method.phoneNumber.slice(-4)}`,
          }),
          ...(method.email && {
            email: `${method.email.charAt(0)}***@${method.email.split('@')[1]}`,
          }),
        })),
        challengeEndpoint: '/api/v1/mfa/challenge',
        verificationEndpoint: '/api/v1/mfa/verify',
      },
    });
  } catch (error) {
    logger.error('MFA requirement check failed', {
      error,
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_ERROR',
    });
  }
};

/**
 * Verify MFA code in authentication flow
 */
export const verifyMFAInFlow = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mfaCode, mfaConfigId, mfaMethod, isBackupCode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!mfaCode) {
      return res.status(400).json({
        error: 'MFA code required',
        code: 'MFA_CODE_REQUIRED',
      });
    }

    const context = getAuthContext(req);

    // Verify MFA code
    const verificationResult = await mfaService.verifyCode({
      userId,
      code: mfaCode,
      configId: mfaConfigId,
      method: mfaMethod,
      isBackupCode,
      context,
    });

    if (verificationResult.success) {
      // Mark MFA as verified in session
      if (req.session) {
        req.session.mfaVerified = true;
        req.session.mfaVerifiedAt = new Date().toISOString();
        req.session.mfaMethod = verificationResult.method;
        req.session.mfaConfigId = verificationResult.configId;
      }

      req.mfaVerified = true;

      auditLogger.info('MFA verified in authentication flow', {
        userId,
        method: verificationResult.method,
        configId: verificationResult.configId,
        isBackupCode,
        ipAddress: context.ipAddress,
      });

      next();
    } else {
      const statusCode = verificationResult.rateLimited ? 429 : 400;
      
      auditLogger.warn('MFA verification failed in authentication flow', {
        userId,
        error: verificationResult.error,
        rateLimited: verificationResult.rateLimited,
        ipAddress: context.ipAddress,
      });

      res.status(statusCode).json({
        error: verificationResult.error || 'MFA verification failed',
        code: verificationResult.rateLimited ? 'RATE_LIMITED' : 'MFA_VERIFICATION_FAILED',
        ...(verificationResult.rateLimited && {
          retryAfter: verificationResult.nextAttemptIn,
        }),
      });
    }
  } catch (error) {
    logger.error('MFA verification in flow failed', {
      error,
      userId: req.user?.id,
    });

    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_ERROR',
    });
  }
};

/**
 * Conditional MFA requirement - only require if user has MFA enabled
 */
export const conditionalMFA = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      return next();
    }

    // Check MFA status if not already checked
    if (req.mfaRequired === undefined) {
      await checkMFAStatus(req, res, () => {});
    }

    // If MFA is required, enforce it
    if (req.mfaRequired) {
      return requireMFA(req, res, next);
    }

    // If no MFA required, proceed
    next();
  } catch (error) {
    logger.error('Conditional MFA check failed', {
      error,
      userId: req.user?.id,
    });
    next();
  }
};

/**
 * Enhanced security middleware for high-risk operations
 */
export const requireRecentMFA = (maxAgeMinutes: number = 5) => {
  return async (req: MFARequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      // Check if user has MFA enabled
      if (!req.mfaMethods) {
        const mfaMethods = await mfaService.getUserMFAMethods(req.user.id);
        req.mfaMethods = mfaMethods.filter(method => method.isEnabled);
        req.mfaRequired = req.mfaMethods.length > 0;
      }

      if (!req.mfaRequired) {
        auditLogger.warn('High-risk operation attempted without MFA', {
          userId: req.user.id,
          endpoint: req.path,
          ipAddress: getAuthContext(req).ipAddress,
        });
        
        return res.status(403).json({
          error: 'Multi-factor authentication required for this operation',
          code: 'MFA_REQUIRED_FOR_OPERATION',
          recommendation: 'Please enable MFA for enhanced security',
        });
      }

      // Check if MFA was verified recently
      const sessionMFATimestamp = req.session?.mfaVerifiedAt;
      const maxAge = maxAgeMinutes * 60 * 1000;

      if (!sessionMFATimestamp) {
        return res.status(403).json({
          error: 'Recent MFA verification required',
          code: 'RECENT_MFA_REQUIRED',
          challenge: {
            maxAgeMinutes,
            verificationEndpoint: '/api/v1/mfa/verify',
          },
        });
      }

      const timeSinceVerification = Date.now() - new Date(sessionMFATimestamp).getTime();
      
      if (timeSinceVerification > maxAge) {
        return res.status(403).json({
          error: 'Recent MFA verification required',
          code: 'MFA_TOO_OLD',
          challenge: {
            maxAgeMinutes,
            lastVerified: sessionMFATimestamp,
            verificationEndpoint: '/api/v1/mfa/verify',
          },
        });
      }

      auditLogger.info('Recent MFA verification confirmed', {
        userId: req.user.id,
        endpoint: req.path,
        lastVerified: sessionMFATimestamp,
        ipAddress: getAuthContext(req).ipAddress,
      });

      next();
    } catch (error) {
      logger.error('Recent MFA check failed', {
        error,
        userId: req.user?.id,
      });

      res.status(500).json({
        error: 'MFA verification failed',
        code: 'MFA_ERROR',
      });
    }
  };
};

/**
 * Middleware to check if device is trusted and bypass MFA
 */
export const checkTrustedDevice = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      return next();
    }

    const userId = req.user.id;
    const context = getAuthContext(req);
    const deviceFingerprint = context.deviceFingerprint;

    // Skip trusted device check if no device fingerprint
    if (!deviceFingerprint) {
      logger.debug('No device fingerprint provided, skipping trusted device check', { userId });
      return next();
    }

    // Check if device is marked as trusted for this user
    const trustedDevice = await checkIfDeviceIsTrusted(userId, deviceFingerprint, context.ipAddress);
    
    if (trustedDevice.isTrusted) {
      // Mark MFA as verified for trusted device (with shorter session)
      if (req.session) {
        req.session.mfaVerified = true;
        req.session.mfaVerifiedAt = new Date().toISOString();
        req.session.mfaMethod = 'trusted_device';
        req.session.trustedDevice = true;
        req.session.trustedDeviceId = trustedDevice.deviceId;
      }

      req.mfaVerified = true;

      auditLogger.info('MFA bypassed for trusted device', {
        userId,
        deviceId: trustedDevice.deviceId,
        deviceName: trustedDevice.deviceName,
        lastUsed: trustedDevice.lastUsed,
        ipAddress: context.ipAddress,
      });

      // Still log the trusted device usage for security monitoring
      await logTrustedDeviceUsage(userId, trustedDevice.deviceId, context);
    }

    next();
  } catch (error) {
    logger.error('Trusted device check failed', { error, userId: req.user?.id });
    // Continue without trusted device bypass on error
    next();
  }
};

/**
 * Middleware to log MFA events
 */
export const logMFAEvent = (eventType: string) => {
  return (req: MFARequest, res: Response, next: NextFunction): void => {
    const context = getAuthContext(req);
    
    auditLogger.info(`MFA Event: ${eventType}`, {
      userId: req.user?.id,
      endpoint: req.path,
      method: req.method,
      mfaRequired: req.mfaRequired,
      mfaVerified: req.mfaVerified,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceFingerprint: context.deviceFingerprint,
    });

    next();
  };
};

/**
 * Middleware to clear MFA session on logout
 */
export const clearMFASession = (req: MFARequest, res: Response, next: NextFunction): void => {
  if (req.session) {
    req.session.mfaVerified = false;
    req.session.mfaVerifiedAt = null;
    req.session.mfaMethod = null;
    req.session.mfaConfigId = null;
  }

  req.mfaVerified = false;
  
  next();
};

/**
 * Middleware to check for suspicious MFA activity
 */
export const detectSuspiciousMFAActivity = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Import security service dynamically to avoid circular dependency
    const { securityService } = await import('../services/security.service');
    
    if (securityService) {
      const context = getAuthContext(req);
      const suspiciousActivity = await securityService.detectSuspiciousActivity(
        req.user?.id,
        context.ipAddress,
        context
      );

      if (suspiciousActivity.suspicious) {
        auditLogger.warn('Suspicious MFA activity detected', {
          userId: req.user?.id,
          riskScore: suspiciousActivity.riskScore,
          factors: suspiciousActivity.factors,
          recommendations: suspiciousActivity.recommendedActions,
          ipAddress: context.ipAddress,
        });

        // For high-risk activities, block the request
        if (suspiciousActivity.riskScore >= 60) {
          return res.status(429).json({
            error: 'Suspicious activity detected',
            code: 'SUSPICIOUS_ACTIVITY_BLOCKED',
            riskScore: suspiciousActivity.riskScore,
            retryAfter: 300, // 5 minutes
          });
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Suspicious activity detection failed', { error });
    next();
  }
};

/**
 * Helper function to check if device is trusted
 */
async function checkIfDeviceIsTrusted(
  userId: string, 
  deviceFingerprint: string, 
  ipAddress: string
): Promise<{
  isTrusted: boolean;
  deviceId?: string;
  deviceName?: string;
  lastUsed?: Date;
  trustLevel?: 'high' | 'medium' | 'low';
}> {
  try {
    // Dynamic import to avoid circular dependency
    const { Pool } = await import('pg');
    const { config } = await import('../config/environment');
    
    // Create a pool for this specific query
    const pool = new Pool(config.database);
    
    const result = await pool.query(`
      SELECT 
        id,
        device_name,
        last_used_at,
        trust_level,
        created_at,
        expires_at
      FROM trusted_devices 
      WHERE user_id = $1 
      AND device_fingerprint = $2 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY last_used_at DESC
      LIMIT 1
    `, [userId, deviceFingerprint]);

    if (result.rows.length === 0) {
      await pool.end();
      return { isTrusted: false };
    }

    const device = result.rows[0];
    
    // Additional security checks
    const securityChecks = await performTrustedDeviceSecurityChecks(
      userId, 
      device.id, 
      ipAddress, 
      pool
    );

    await pool.end();

    if (!securityChecks.passed) {
      logger.warn('Trusted device failed security checks', {
        userId,
        deviceId: device.id,
        failedChecks: securityChecks.failedChecks,
      });
      return { isTrusted: false };
    }

    return {
      isTrusted: true,
      deviceId: device.id,
      deviceName: device.device_name,
      lastUsed: device.last_used_at,
      trustLevel: device.trust_level,
    };

  } catch (error) {
    logger.error('Failed to check trusted device', { error, userId, deviceFingerprint });
    return { isTrusted: false };
  }
}

/**
 * Perform additional security checks for trusted devices
 */
async function performTrustedDeviceSecurityChecks(
  userId: string,
  deviceId: string,
  currentIP: string,
  pool: any
): Promise<{ passed: boolean; failedChecks: string[] }> {
  const failedChecks: string[] = [];

  try {
    // Check 1: Device hasn't been used from too many different IPs recently
    const ipDiversityResult = await pool.query(`
      SELECT COUNT(DISTINCT ip_address) as unique_ips
      FROM trusted_device_usage 
      WHERE device_id = $1 
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
    `, [deviceId]);

    const uniqueIPs = parseInt(ipDiversityResult.rows[0]?.unique_ips) || 0;
    if (uniqueIPs > 5) {
      failedChecks.push('too_many_ips');
    }

    // Check 2: No recent security incidents for this user
    const securityIncidentResult = await pool.query(`
      SELECT COUNT(*) as incident_count
      FROM security_events 
      WHERE user_id = $1 
      AND (blocked = true OR risk_score >= 75)
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `, [userId]);

    const incidentCount = parseInt(securityIncidentResult.rows[0]?.incident_count) || 0;
    if (incidentCount > 0) {
      failedChecks.push('recent_security_incidents');
    }

    // Check 3: Device usage frequency (shouldn't be dormant too long)
    const lastUsageResult = await pool.query(`
      SELECT MAX(created_at) as last_usage
      FROM trusted_device_usage 
      WHERE device_id = $1
    `, [deviceId]);

    const lastUsage = lastUsageResult.rows[0]?.last_usage;
    if (lastUsage) {
      const daysSinceLastUse = (Date.now() - new Date(lastUsage).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse > 30) {
        failedChecks.push('device_dormant');
      }
    }

    return {
      passed: failedChecks.length === 0,
      failedChecks,
    };

  } catch (error) {
    logger.error('Trusted device security checks failed', { error, userId, deviceId });
    return { passed: false, failedChecks: ['security_check_error'] };
  }
}

/**
 * Log trusted device usage for monitoring
 */
async function logTrustedDeviceUsage(
  userId: string,
  deviceId: string,
  context: MFAContext
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { Pool } = await import('pg');
    const { config } = await import('../config/environment');
    
    const pool = new Pool(config.database);
    
    // Log the usage
    await pool.query(`
      INSERT INTO trusted_device_usage 
      (device_id, user_id, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [deviceId, userId, context.ipAddress, context.userAgent]);

    // Update last used timestamp on trusted device
    await pool.query(`
      UPDATE trusted_devices 
      SET last_used_at = CURRENT_TIMESTAMP,
          usage_count = usage_count + 1
      WHERE id = $1
    `, [deviceId]);

    await pool.end();

  } catch (error) {
    logger.error('Failed to log trusted device usage', { error, userId, deviceId });
  }
}

/**
 * Middleware to register a device as trusted after successful MFA verification
 */
export const registerTrustedDevice = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user wants to trust this device
    const trustDevice = req.body.trustDevice === true;
    const deviceName = req.body.deviceName || 'Unknown Device';
    
    if (!trustDevice || !req.user?.id || !req.mfaVerified) {
      return next();
    }

    const context = getAuthContext(req);
    const deviceFingerprint = context.deviceFingerprint;

    if (!deviceFingerprint) {
      logger.debug('Cannot register trusted device without fingerprint', { userId: req.user.id });
      return next();
    }

    // Register the device as trusted
    await registerDeviceAsTrusted(req.user.id, deviceFingerprint, deviceName, context);

    auditLogger.info('Device registered as trusted', {
      userId: req.user.id,
      deviceName,
      ipAddress: context.ipAddress,
    });

    next();
  } catch (error) {
    logger.error('Failed to register trusted device', { error, userId: req.user?.id });
    next();
  }
};

/**
 * Helper function to register a device as trusted
 */
async function registerDeviceAsTrusted(
  userId: string,
  deviceFingerprint: string,
  deviceName: string,
  context: MFAContext
): Promise<void> {
  try {
    const { Pool } = await import('pg');
    const { config } = await import('../config/environment');
    
    const pool = new Pool(config.database);
    
    // Check if device is already trusted
    const existingDevice = await pool.query(`
      SELECT id FROM trusted_devices
      WHERE user_id = $1 AND device_fingerprint = $2 AND is_active = true
    `, [userId, deviceFingerprint]);

    if (existingDevice.rows.length > 0) {
      await pool.end();
      return; // Device already trusted
    }

    // Insert new trusted device
    await pool.query(`
      INSERT INTO trusted_devices 
      (user_id, device_fingerprint, device_name, ip_address, user_agent, 
       trust_level, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      userId,
      deviceFingerprint,
      deviceName,
      context.ipAddress,
      context.userAgent,
      'medium', // Default trust level
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days expiry
    ]);

    await pool.end();

  } catch (error) {
    logger.error('Failed to register trusted device in database', { error, userId });
    throw error;
  }
}

// Export all middleware functions
export default {
  checkMFAStatus,
  requireMFA,
  verifyMFAInFlow,
  conditionalMFA,
  requireRecentMFA,
  checkTrustedDevice,
  registerTrustedDevice,
  logMFAEvent,
  clearMFASession,
  detectSuspiciousMFAActivity,
};