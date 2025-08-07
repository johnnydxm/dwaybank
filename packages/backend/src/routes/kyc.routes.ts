import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { kycService, KYCRequest } from '../services/kyc.service';
import { authService } from '../services/auth.service';
import logger, { auditLogger } from '../config/logger';

/**
 * KYC Routes for DwayBank
 * Handles KYC verification, document submission, and compliance management
 */

const router = Router();

// Rate limiting for KYC operations
const kycSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 submissions per hour per IP
  message: {
    error: 'Too many KYC submissions. Please wait before trying again.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const kycStatusLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Max 20 status checks per 5 minutes
  message: {
    error: 'Too many status requests. Please try again later.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminKycLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 admin operations per 15 minutes
  message: {
    error: 'Too many admin requests. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to extract request context
const getRequestContext = (req: Request) => ({
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown',
  deviceFingerprint: req.headers['x-device-fingerprint'] as string,
  submissionSource: req.headers['x-platform'] === 'mobile' ? 'mobile' as const : 'web' as const,
});

// Middleware to verify user authentication
const requireAuth = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
    }

    const validation = await authService.validateToken(token);
    
    if (!validation.isValid || !validation.user) {
      return res.status(401).json({
        success: false,
        error: validation.error || 'Invalid token',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
    }

    req.user = validation.user;
    req.session = validation.session;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication validation failed',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
};

// Middleware to verify admin role
const requireAdminRole = (allowedRoles: string[] = ['admin', 'super_admin', 'compliance_officer']) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
      }

      if (!req.user.role || !allowedRoles.includes(req.user.role)) {
        auditLogger.warn('Unauthorized KYC admin access attempt', {
          userId: req.user.id,
          userRole: req.user.role,
          ipAddress: getRequestContext(req).ipAddress,
          endpoint: req.path,
          requiredRoles: allowedRoles,
        });

        return res.status(403).json({
          success: false,
          error: 'Administrative access required',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          timestamp: new Date().toISOString(),
        });
      }

      next();
    } catch (error) {
      logger.error('Admin role verification failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Role verification failed',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Validation rules for KYC submission
const kycSubmissionValidation = [
  body('document_type')
    .isIn(['passport', 'drivers_license', 'national_id'])
    .withMessage('Invalid document type'),
  body('document_front')
    .isBase64()
    .isLength({ min: 100, max: 5000000 }) // ~3.7MB base64 limit
    .withMessage('Invalid document front image'),
  body('document_back')
    .optional()
    .isBase64()
    .isLength({ min: 100, max: 5000000 })
    .withMessage('Invalid document back image'),
  body('selfie_image')
    .isBase64()
    .isLength({ min: 100, max: 5000000 })
    .withMessage('Invalid selfie image'),
  body('address_proof')
    .optional()
    .isBase64()
    .isLength({ min: 100, max: 5000000 })
    .withMessage('Invalid address proof image'),
];

/**
 * POST /api/v1/kyc/submit
 * Submit KYC verification documents
 */
router.post('/submit',
  kycSubmissionLimiter,
  requireAuth,
  kycSubmissionValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }

      const userId = req.user.id;
      const context = getRequestContext(req);

      // Check if user already has a pending or approved KYC
      const existingVerification = await kycService.getLatestVerificationForUser(userId);
      if (existingVerification && ['pending', 'approved'].includes(existingVerification.status)) {
        return res.status(409).json({
          success: false,
          error: 'KYC verification already exists',
          code: 'VERIFICATION_EXISTS',
          status: existingVerification.status,
          verificationId: existingVerification.verification_id,
          timestamp: new Date().toISOString(),
        });
      }

      // Prepare KYC request
      const kycRequest: KYCRequest = {
        user_id: userId,
        document_type: req.body.document_type,
        document_front: req.body.document_front,
        document_back: req.body.document_back,
        selfie_image: req.body.selfie_image,
        address_proof: req.body.address_proof,
        metadata: {
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
          device_fingerprint: context.deviceFingerprint,
          submission_source: context.submissionSource,
        },
      };

      // Submit KYC verification
      const result = await kycService.submitVerification(kycRequest);

      auditLogger.info('KYC verification submitted', {
        userId,
        verificationId: result.verification_id,
        documentType: kycRequest.document_type,
        hasAddressProof: !!kycRequest.address_proof,
        submissionSource: context.submissionSource,
        ipAddress: context.ipAddress,
      });

      // Remove sensitive data from response
      const response = {
        verification_id: result.verification_id,
        status: result.status,
        confidence_score: result.confidence_score,
        estimated_review_time: result.estimated_review_time,
        next_steps: result.next_steps,
      };

      res.status(201).json({
        success: true,
        message: 'KYC verification submitted successfully',
        data: response,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('KYC submission failed', {
        error: error.message,
        userId: req.user?.id,
        documentType: req.body?.document_type,
      });

      res.status(500).json({
        success: false,
        error: 'KYC submission failed',
        code: 'SUBMISSION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/kyc/status/:verificationId?
 * Get KYC verification status
 */
router.get('/status/:verificationId?',
  kycStatusLimiter,
  requireAuth,
  [
    param('verificationId')
      .optional()
      .isUUID()
      .withMessage('Invalid verification ID format'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }

      const userId = req.user.id;
      const { verificationId } = req.params;

      let result;
      if (verificationId) {
        // Get specific verification
        result = await kycService.getVerificationStatus(verificationId);
        
        // Verify ownership
        if (result && !await kycService.isVerificationOwnedByUser(verificationId, userId)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to verification',
            code: 'ACCESS_DENIED',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Get latest verification for user
        result = await kycService.getLatestVerificationForUser(userId);
      }

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Verification not found',
          code: 'NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      // Remove sensitive extracted data for privacy
      const response = {
        verification_id: result.verification_id,
        status: result.status,
        confidence_score: result.confidence_score,
        risk_flags: result.risk_flags,
        verification_details: {
          document_authenticity: result.verification_details.document_authenticity,
          biometric_match: result.verification_details.biometric_match,
          data_consistency: result.verification_details.data_consistency,
          sanctions_check: result.verification_details.sanctions_check,
          pep_check: result.verification_details.pep_check,
        },
        estimated_review_time: result.estimated_review_time,
        next_steps: result.next_steps,
      };

      res.json({
        success: true,
        message: 'Verification status retrieved successfully',
        data: response,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('KYC status retrieval failed', {
        error: error.message,
        userId: req.user?.id,
        verificationId: req.params.verificationId,
      });

      res.status(500).json({
        success: false,
        error: 'Status retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/v1/kyc/admin/update-status
 * Update KYC verification status (admin only)
 */
router.post('/admin/update-status',
  adminKycLimiter,
  requireAuth,
  requireAdminRole(['admin', 'super_admin', 'compliance_officer']),
  [
    body('verification_id').isUUID().withMessage('Invalid verification ID'),
    body('status')
      .isIn(['pending', 'approved', 'rejected', 'requires_review'])
      .withMessage('Invalid status'),
    body('reviewer_notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Reviewer notes too long'),
    body('risk_level')
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid risk level'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }

      const { verification_id, status, reviewer_notes, risk_level } = req.body;
      const reviewerId = req.user.id;
      const context = getRequestContext(req);

      const statusUpdate = {
        verification_id,
        status,
        reviewer_notes,
        risk_level,
      };

      const success = await kycService.updateVerificationStatus(statusUpdate, reviewerId);

      if (success) {
        auditLogger.info('KYC status updated by admin', {
          verificationId: verification_id,
          newStatus: status,
          riskLevel: risk_level,
          reviewerId,
          reviewerRole: req.user.role,
          ipAddress: context.ipAddress,
          hasNotes: !!reviewer_notes,
        });

        res.json({
          success: true,
          message: 'Verification status updated successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Verification not found',
          code: 'NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error: any) {
      logger.error('KYC status update failed', {
        error: error.message,
        verificationId: req.body?.verification_id,
        reviewerId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Status update failed',
        code: 'UPDATE_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/kyc/admin/verifications
 * Get all KYC verifications for admin review
 */
router.get('/admin/verifications',
  adminKycLimiter,
  requireAuth,
  requireAdminRole(['admin', 'super_admin', 'compliance_officer']),
  [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'requires_review'])
      .withMessage('Invalid status filter'),
    query('risk_level')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid risk level filter'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid page number'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Invalid limit value'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }

      const {
        status,
        risk_level,
        page = 1,
        limit = 20,
      } = req.query;

      const filters = {
        status: status as string,
        risk_level: risk_level as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      const result = await kycService.getVerificationsForReview(filters);

      res.json({
        success: true,
        message: 'Verifications retrieved successfully',
        data: result.verifications,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          pages: Math.ceil(result.total / filters.limit),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Admin verifications retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Verifications retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/kyc/admin/stats
 * Get KYC statistics (admin only)
 */
router.get('/admin/stats',
  adminKycLimiter,
  requireAuth,
  requireAdminRole(['admin', 'super_admin', 'compliance_officer']),
  async (req: Request, res: Response) => {
    try {
      const stats = await kycService.getKYCStatistics();

      res.json({
        success: true,
        message: 'KYC statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('KYC statistics retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Statistics retrieval failed',
        code: 'STATS_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/kyc/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await kycService.getHealthStatus();

    res.json({
      success: true,
      status: 'healthy',
      data: health,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    logger.error('KYC health check failed', { error: error.message });
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
router.use((error: any, req: Request, res: Response, next: any) => {
  logger.error('KYC route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

export default router;