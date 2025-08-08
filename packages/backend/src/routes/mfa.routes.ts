import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { mfaService } from '../services/mfa.service';
import { authService } from '../services/auth.service';
import logger, { auditLogger } from '../config/logger';

/**
 * MFA Routes for DwayBank
 * Handles MFA setup, verification, and management
 */

const router = Router();

// Rate limiting for MFA operations
const mfaSetupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 setup attempts per 15 minutes
  message: {
    error: 'Too many MFA setup attempts. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const mfaVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 verification attempts per 15 minutes
  message: {
    error: 'Too many verification attempts. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const mfaChallengeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Max 3 challenge requests per 5 minutes
  message: {
    error: 'Too many challenge requests. Please try again later.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to extract authentication context
const getAuthContext = (req: Request) => ({
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown',
  deviceFingerprint: req.headers['x-device-fingerprint'] as string,
});

// Middleware to verify admin role
const requireAdminRole = (allowedRoles: string[] = ['admin', 'super_admin', 'auditor']) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      if (!req.user.role || !allowedRoles.includes(req.user.role)) {
        auditLogger.warn('Unauthorized admin access attempt', {
          userId: req.user.id,
          userRole: req.user.role,
          ipAddress: getAuthContext(req).ipAddress,
          endpoint: req.path,
          requiredRoles: allowedRoles,
        });

        return res.status(403).json({
          error: 'Administrative access required',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
        });
      }

      next();
    } catch (error) {
      logger.error('Admin role verification failed', { error, userId: req.user?.id });
      res.status(500).json({
        error: 'Role verification failed',
        code: 'INTERNAL_ERROR',
      });
    }
  };
};

// Middleware to verify user authentication
const requireAuth = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const validation = await authService.validateToken(token);
    
    if (!validation.isValid || !validation.user) {
      return res.status(401).json({
        error: validation.error || 'Invalid token',
        code: 'UNAUTHORIZED',
      });
    }

    req.user = validation.user;
    req.session = validation.session;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({
      error: 'Authentication validation failed',
      code: 'INTERNAL_ERROR',
    });
  }
};

// Validation rules
const setupValidation = [
  body('method')
    .isIn(['totp', 'sms', 'email'])
    .withMessage('Invalid MFA method'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary must be boolean'),
];

const verificationValidation = [
  body('code')
    .isLength({ min: 4, max: 8 })
    .isAlphanumeric()
    .withMessage('Invalid verification code format'),
  body('configId')
    .optional()
    .isUUID()
    .withMessage('Invalid config ID format'),
  body('method')
    .optional()
    .isIn(['totp', 'sms', 'email'])
    .withMessage('Invalid MFA method'),
  body('isBackupCode')
    .optional()
    .isBoolean()
    .withMessage('isBackupCode must be boolean'),
];

/**
 * POST /api/v1/mfa/setup
 * Setup new MFA method
 */
router.post('/setup', 
  mfaSetupLimiter,
  requireAuth,
  setupValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { method, phoneNumber, email, isPrimary } = req.body;
      const userId = req.user.id;

      // Validate method-specific requirements
      if (method === 'sms' && !phoneNumber) {
        return res.status(400).json({
          error: 'Phone number required for SMS MFA',
          code: 'MISSING_PHONE_NUMBER',
        });
      }

      if (method === 'email' && !email) {
        return res.status(400).json({
          error: 'Email required for Email MFA',
          code: 'MISSING_EMAIL',
        });
      }

      // Setup MFA method
      let setupResult;
      
      if (method === 'totp') {
        setupResult = await mfaService.setupTOTP({
          userId,
          method,
          isPrimary,
        });
      } else if (method === 'sms') {
        setupResult = await mfaService.setupSMS({
          userId,
          method,
          phoneNumber,
          isPrimary,
        });
      } else if (method === 'email') {
        setupResult = await mfaService.setupEmail({
          userId,
          method,
          email,
          isPrimary,
        });
      } else if (method === 'biometric') {
        setupResult = await mfaService.setupBiometric({
          userId,
          method,
          isPrimary,
        });
      }

      auditLogger.info('MFA setup initiated', {
        userId,
        method,
        configId: setupResult?.configId,
        ipAddress: getAuthContext(req).ipAddress,
      });

      // Remove sensitive data from response
      const response = {
        configId: setupResult?.configId,
        method: setupResult?.method,
        backupCodes: setupResult?.backupCodes,
        ...(method === 'totp' && {
          qrCodeUrl: setupResult?.qrCodeUrl,
          secret: setupResult?.secret,
        }),
      };

      res.status(201).json({
        message: 'MFA setup initiated successfully',
        data: response,
        nextStep: 'Verify the setup using the verification endpoint',
      });

    } catch (error: any) {
      logger.error('MFA setup failed', {
        error: error.message,
        userId: req.user?.id,
        method: req.body.method,
      });

      res.status(500).json({
        error: 'MFA setup failed',
        code: 'SETUP_ERROR',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/mfa/verify-setup
 * Verify MFA setup with initial code
 */
router.post('/verify-setup',
  mfaVerificationLimiter,
  requireAuth,
  [
    body('configId').isUUID().withMessage('Invalid config ID'),
    body('code').isLength({ min: 4, max: 8 }).withMessage('Invalid code format'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { configId, code } = req.body;
      const userId = req.user.id;

      const result = await mfaService.verifySetup(configId, code, userId);

      if (result.success) {
        auditLogger.info('MFA setup verified successfully', {
          userId,
          configId,
          ipAddress: getAuthContext(req).ipAddress,
        });

        res.json({
          message: 'MFA method enabled successfully',
          success: true,
        });
      } else {
        res.status(400).json({
          error: result.error || 'Verification failed',
          code: 'VERIFICATION_FAILED',
          success: false,
        });
      }

    } catch (error: any) {
      logger.error('MFA setup verification failed', {
        error: error.message,
        userId: req.user?.id,
        configId: req.body.configId,
      });

      res.status(500).json({
        error: 'Verification failed',
        code: 'VERIFICATION_ERROR',
      });
    }
  }
);

/**
 * POST /api/v1/mfa/challenge
 * Request MFA challenge (send code via SMS/Email)
 */
router.post('/challenge',
  mfaChallengeLimiter,
  requireAuth,
  [
    body('method')
      .optional()
      .isIn(['totp', 'sms', 'email'])
      .withMessage('Invalid MFA method'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { method } = req.body;
      const userId = req.user.id;
      const context = getAuthContext(req);

      const result = await mfaService.sendChallenge({
        userId,
        method,
        context,
      });

      if (result.success) {
        auditLogger.info('MFA challenge sent', {
          userId,
          method: result.method,
          configId: result.configId,
          ipAddress: context.ipAddress,
        });

        res.json({
          message: 'MFA challenge sent successfully',
          method: result.method,
          configId: result.configId,
        });
      } else {
        const statusCode = result.error?.includes('Rate limit') ? 429 : 400;
        
        res.status(statusCode).json({
          error: result.error || 'Challenge failed',
          code: result.error?.includes('Rate limit') ? 'RATE_LIMITED' : 'CHALLENGE_FAILED',
        });
      }

    } catch (error: any) {
      logger.error('MFA challenge failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        error: 'Challenge failed',
        code: 'CHALLENGE_ERROR',
      });
    }
  }
);

/**
 * POST /api/v1/mfa/verify
 * Verify MFA code
 */
router.post('/verify',
  mfaVerificationLimiter,
  requireAuth,
  verificationValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { code, configId, method, isBackupCode } = req.body;
      const userId = req.user.id;
      const context = getAuthContext(req);

      const result = await mfaService.verifyCode({
        userId,
        code,
        configId,
        method,
        isBackupCode,
        context,
      });

      if (result.success) {
        auditLogger.info('MFA verification successful', {
          userId,
          method: result.method,
          configId: result.configId,
          isBackupCode,
          ipAddress: context.ipAddress,
        });

        res.json({
          message: 'MFA verification successful',
          success: true,
          method: result.method,
          remainingBackupCodes: result.remainingBackupCodes,
        });
      } else {
        const statusCode = result.rateLimited ? 429 : 400;
        
        res.status(statusCode).json({
          error: result.error || 'Verification failed',
          code: result.rateLimited ? 'RATE_LIMITED' : 'VERIFICATION_FAILED',
          success: false,
          ...(result.rateLimited && {
            retryAfter: result.nextAttemptIn,
          }),
        });
      }

    } catch (error: any) {
      logger.error('MFA verification failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        error: 'Verification failed',
        code: 'VERIFICATION_ERROR',
      });
    }
  }
);

/**
 * GET /api/v1/mfa/methods
 * Get user's MFA methods
 */
router.get('/methods',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const methods = await mfaService.getUserMFAMethods(userId);

      // Remove sensitive information
      const safeMethods = methods.map(method => ({
        id: method.id,
        method: method.method,
        isPrimary: method.isPrimary,
        isEnabled: method.isEnabled,
        phoneNumber: method.phoneNumber ? 
          `***-***-${method.phoneNumber.slice(-4)}` : undefined,
        email: method.email ? 
          `${method.email.charAt(0)}***@${method.email.split('@')[1]}` : undefined,
        lastUsed: method.lastUsed,
        verifiedAt: method.verifiedAt,
      }));

      res.json({
        methods: safeMethods,
        total: safeMethods.length,
      });

    } catch (error: any) {
      logger.error('Failed to get MFA methods', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        error: 'Failed to retrieve MFA methods',
        code: 'RETRIEVAL_ERROR',
      });
    }
  }
);

/**
 * DELETE /api/v1/mfa/methods/:configId
 * Disable MFA method
 */
router.delete('/methods/:configId',
  requireAuth,
  [
    param('configId').isUUID().withMessage('Invalid config ID'),
    body('reason').optional().isString().withMessage('Reason must be string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { configId } = req.params;
      const { reason = 'user_request' } = req.body;
      const userId = req.user.id;

      const success = await mfaService.disableMFAMethod(userId, configId, reason);

      if (success) {
        auditLogger.info('MFA method disabled', {
          userId,
          configId,
          reason,
          ipAddress: getAuthContext(req).ipAddress,
        });

        res.json({
          message: 'MFA method disabled successfully',
          success: true,
        });
      } else {
        res.status(404).json({
          error: 'MFA method not found or not owned by user',
          code: 'NOT_FOUND',
        });
      }

    } catch (error: any) {
      logger.error('Failed to disable MFA method', {
        error: error.message,
        userId: req.user?.id,
        configId: req.params.configId,
      });

      res.status(500).json({
        error: 'Failed to disable MFA method',
        code: 'DISABLE_ERROR',
      });
    }
  }
);

/**
 * POST /api/v1/mfa/backup-codes/regenerate
 * Regenerate backup codes
 */
router.post('/backup-codes/regenerate',
  requireAuth,
  [
    body('configId').isUUID().withMessage('Invalid config ID'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { configId } = req.body;
      const userId = req.user.id;

      const result = await mfaService.regenerateBackupCodes(userId, configId);

      if (result.success) {
        auditLogger.info('Backup codes regenerated', {
          userId,
          configId,
          ipAddress: getAuthContext(req).ipAddress,
        });

        res.json({
          message: 'Backup codes regenerated successfully',
          backupCodes: result.backupCodes,
        });
      } else {
        res.status(404).json({
          error: 'MFA method not found or not owned by user',
          code: 'NOT_FOUND',
        });
      }

    } catch (error: any) {
      logger.error('Failed to regenerate backup codes', {
        error: error.message,
        userId: req.user?.id,
        configId: req.body.configId,
      });

      res.status(500).json({
        error: 'Failed to regenerate backup codes',
        code: 'REGENERATION_ERROR',
      });
    }
  }
);

/**
 * GET /api/v1/mfa/stats
 * Get MFA statistics (admin only)
 */
router.get('/stats',
  requireAuth,
  requireAdminRole(['admin', 'super_admin', 'auditor']),
  async (req: Request, res: Response) => {
    try {

      const stats = await mfaService.getMFAStats();

      res.json({
        message: 'MFA statistics retrieved successfully',
        data: stats,
      });

    } catch (error: any) {
      logger.error('Failed to get MFA statistics', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        error: 'Failed to retrieve statistics',
        code: 'STATS_ERROR',
      });
    }
  }
);

/**
 * GET /api/v1/mfa/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Basic health check
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        totp: true,
        sms: !!process.env.TWILIO_ACCOUNT_SID,
        email: !!process.env.EMAIL_USER,
      },
    });

  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
router.use((error: any, req: Request, res: Response, next: any) => {
  logger.error('MFA route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});

export default router;