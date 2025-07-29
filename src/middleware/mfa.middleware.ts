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
 * Middleware to bypass MFA for trusted devices (future enhancement)
 */
export const checkTrustedDevice = async (
  req: MFARequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Implement trusted device logic
    // For now, just pass through
    next();
  } catch (error) {
    logger.error('Trusted device check failed', { error });
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
    // TODO: Implement suspicious activity detection
    // - Multiple failed attempts from different IPs
    // - Rapid successive attempts
    // - Unusual device/location patterns
    
    next();
  } catch (error) {
    logger.error('Suspicious activity detection failed', { error });
    next();
  }
};

// Export all middleware functions
export default {
  checkMFAStatus,
  requireMFA,
  verifyMFAInFlow,
  conditionalMFA,
  requireRecentMFA,
  checkTrustedDevice,
  logMFAEvent,
  clearMFASession,
  detectSuspiciousMFAActivity,
};