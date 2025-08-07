import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { userProfileService, UserProfile, UserPreferences, NotificationPreference, UserDevice } from '../services/user-profile.service';
import { authService } from '../services/auth.service';
import logger, { auditLogger } from '../config/logger';

/**
 * User Profile Routes for DwayBank
 * Handles user profile management, preferences, and device management
 */

const router = Router();

// Rate limiting for profile operations
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 profile updates per 15 minutes
  message: {
    error: 'Too many profile updates. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const profileViewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Max 100 profile views per 5 minutes
  message: {
    error: 'Too many profile requests. Please try again later.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminProfileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Max 200 admin operations per 15 minutes
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
const requireAdminRole = (allowedRoles: string[] = ['admin', 'super_admin']) => {
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
        auditLogger.warn('Unauthorized profile admin access attempt', {
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

// Validation rules for profile creation/update
const profileValidation = [
  body('first_name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be 1-100 characters'),
  body('middle_name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Middle name must be 1-100 characters'),
  body('last_name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be 1-100 characters'),
  body('display_name')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Display name must be 1-200 characters'),
  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be valid ISO date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'])
    .withMessage('Invalid gender value'),
  body('phone_number')
    .optional()
    .matches(/^\\+?[1-9]\\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  body('secondary_email')
    .optional()
    .isEmail()
    .withMessage('Invalid secondary email format'),
  body('country_code')
    .optional()
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .withMessage('Country code must be 2-letter ISO code'),
  body('occupation')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Occupation must be 1-200 characters'),
  body('employer')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Employer must be 1-200 characters'),
  body('annual_income_range')
    .optional()
    .isIn(['0-25k', '25k-50k', '50k-100k', '100k-250k', '250k+'])
    .withMessage('Invalid income range'),
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio must be max 1000 characters'),
  body('profile_visibility')
    .optional()
    .isIn(['public', 'private', 'contacts_only'])
    .withMessage('Invalid profile visibility'),
];

// Validation rules for preferences
const preferencesValidation = [
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'pt', 'it', 'ru', 'ar', 'hi'])
    .withMessage('Invalid language code'),
  body('primary_currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'KRW', 'MXN', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'RUB'])
    .withMessage('Invalid currency code'),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Invalid theme preference'),
  body('font_size')
    .optional()
    .isIn(['small', 'medium', 'large', 'x-large'])
    .withMessage('Invalid font size'),
  body('session_timeout_minutes')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Session timeout must be 5-480 minutes'),
  body('remember_device_days')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('Remember device days must be 0-365'),
];

/**
 * GET /api/v1/profile
 * Get current user's profile
 */
router.get('/',
  profileViewLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const profile = await userProfileService.getProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          code: 'PROFILE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: profile,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/v1/profile
 * Create user profile
 */
router.post('/',
  profileUpdateLimiter,
  requireAuth,
  profileValidation,
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
      
      // Check if profile already exists
      const existingProfile = await userProfileService.getProfile(userId);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          error: 'Profile already exists',
          code: 'PROFILE_EXISTS',
          timestamp: new Date().toISOString(),
        });
      }

      const profileData: UserProfile = {
        user_id: userId,
        ...req.body,
      };

      const profile = await userProfileService.createProfile(profileData);

      res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        data: profile,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile creation failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile creation failed',
        code: 'CREATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PUT /api/v1/profile
 * Update user profile
 */
router.put('/',
  profileUpdateLimiter,
  requireAuth,
  profileValidation,
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

      const updateRequest = {
        user_id: userId,
        profile_data: req.body,
        changed_by: userId,
        change_reason: req.body.change_reason || 'user_update',
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      };

      const profile = await userProfileService.updateProfile(updateRequest);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: profile,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile update failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile update failed',
        code: 'UPDATE_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/preferences
 * Get user preferences
 */
router.get('/preferences',
  profileViewLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const preferences = await userProfileService.getPreferences(userId);

      res.json({
        success: true,
        message: 'Preferences retrieved successfully',
        data: preferences,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Preferences retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Preferences retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PUT /api/v1/profile/preferences
 * Update user preferences
 */
router.put('/preferences',
  profileUpdateLimiter,
  requireAuth,
  preferencesValidation,
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
      const preferences = await userProfileService.updatePreferences(userId, req.body);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Preferences update failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Preferences update failed',
        code: 'UPDATE_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/notifications
 * Get notification preferences
 */
router.get('/notifications',
  profileViewLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const notifications = await userProfileService.getNotificationPreferences(userId);

      res.json({
        success: true,
        message: 'Notification preferences retrieved successfully',
        data: notifications,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Notification preferences retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Notification preferences retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PUT /api/v1/profile/notifications
 * Update notification preferences
 */
router.put('/notifications',
  profileUpdateLimiter,
  requireAuth,
  [
    body('preferences')
      .isArray()
      .withMessage('Preferences must be an array'),
    body('preferences.*.notification_type')
      .isIn(['email', 'sms', 'push', 'in_app'])
      .withMessage('Invalid notification type'),
    body('preferences.*.category')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be 1-50 characters'),
    body('preferences.*.enabled')
      .isBoolean()
      .withMessage('Enabled must be boolean'),
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
      const { preferences } = req.body;

      // Add user_id to each preference
      const preferencesWithUserId = preferences.map((pref: NotificationPreference) => ({
        ...pref,
        user_id: userId,
      }));

      const updatedPreferences = await userProfileService.updateNotificationPreferences(
        userId, 
        preferencesWithUserId
      );

      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: updatedPreferences,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Notification preferences update failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Notification preferences update failed',
        code: 'UPDATE_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/devices
 * Get user devices
 */
router.get('/devices',
  profileViewLimiter,
  requireAuth,
  [
    query('active_only')
      .optional()
      .isBoolean()
      .withMessage('Active only must be boolean'),
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
      const activeOnly = req.query.active_only === 'true';
      const devices = await userProfileService.getUserDevices(userId, activeOnly);

      res.json({
        success: true,
        message: 'Devices retrieved successfully',
        data: devices,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Devices retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Devices retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * POST /api/v1/profile/devices
 * Register a new device
 */
router.post('/devices',
  profileUpdateLimiter,
  requireAuth,
  [
    body('device_id')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Device ID must be 1-255 characters'),
    body('device_name')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Device name must be 1-200 characters'),
    body('device_type')
      .optional()
      .isIn(['mobile', 'tablet', 'desktop', 'tv'])
      .withMessage('Invalid device type'),
    body('platform')
      .optional()
      .isIn(['ios', 'android', 'windows', 'macos', 'linux'])
      .withMessage('Invalid platform'),
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
      const context = getRequestContext(req);

      const deviceData: UserDevice = {
        user_id: userId,
        ...req.body,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      };

      const device = await userProfileService.registerDevice(deviceData);

      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: device,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Device registration failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Device registration failed',
        code: 'REGISTRATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * PUT /api/v1/profile/devices/:deviceId/trust
 * Update device trust status
 */
router.put('/devices/:deviceId/trust',
  profileUpdateLimiter,
  requireAuth,
  [
    param('deviceId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Invalid device ID'),
    body('is_trusted')
      .isBoolean()
      .withMessage('Is trusted must be boolean'),
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
      const { deviceId } = req.params;
      const { is_trusted } = req.body;

      const success = await userProfileService.updateDeviceTrustStatus(userId, deviceId, is_trusted);

      if (success) {
        res.json({
          success: true,
          message: 'Device trust status updated successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error: any) {
      logger.error('Device trust update failed', {
        error: error.message,
        userId: req.user?.id,
        deviceId: req.params.deviceId,
      });

      res.status(500).json({
        success: false,
        error: 'Device trust update failed',
        code: 'UPDATE_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * DELETE /api/v1/profile/devices/:deviceId
 * Remove a device
 */
router.delete('/devices/:deviceId',
  profileUpdateLimiter,
  requireAuth,
  [
    param('deviceId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Invalid device ID'),
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
      const { deviceId } = req.params;

      const success = await userProfileService.removeDevice(userId, deviceId);

      if (success) {
        res.json({
          success: true,
          message: 'Device removed successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error: any) {
      logger.error('Device removal failed', {
        error: error.message,
        userId: req.user?.id,
        deviceId: req.params.deviceId,
      });

      res.status(500).json({
        success: false,
        error: 'Device removal failed',
        code: 'REMOVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/history
 * Get profile change history
 */
router.get('/history',
  profileViewLimiter,
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
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
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await userProfileService.getProfileHistory(userId, limit);

      res.json({
        success: true,
        message: 'Profile history retrieved successfully',
        data: history,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile history retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile history retrieval failed',
        code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * DELETE /api/v1/profile
 * Delete user profile (GDPR compliance)
 */
router.delete('/',
  profileUpdateLimiter,
  requireAuth,
  [
    body('reason')
      .optional()
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Reason must be 1-200 characters'),
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
      const reason = req.body.reason || 'user_request';

      const success = await userProfileService.deleteProfile(userId, reason);

      if (success) {
        res.json({
          success: true,
          message: 'Profile deleted successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
          code: 'PROFILE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error: any) {
      logger.error('Profile deletion failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile deletion failed',
        code: 'DELETION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Admin Routes
 */

/**
 * GET /api/v1/profile/admin/search
 * Search profiles (admin only)
 */
router.get('/admin/search',
  adminProfileLimiter,
  requireAuth,
  requireAdminRole(['admin', 'super_admin']),
  [
    query('country_code')
      .optional()
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Country code must be 2-letter ISO code'),
    query('completion_status')
      .optional()
      .isIn(['incomplete', 'basic_complete', 'full_complete', 'verified'])
      .withMessage('Invalid completion status'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
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

      const filters = {
        country_code: req.query.country_code as string,
        completion_status: req.query.completion_status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await userProfileService.searchProfiles(filters);

      res.json({
        success: true,
        message: 'Profiles retrieved successfully',
        data: result.profiles,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          pages: Math.ceil(result.total / filters.limit),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile search failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile search failed',
        code: 'SEARCH_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/admin/stats
 * Get profile statistics (admin only)
 */
router.get('/admin/stats',
  adminProfileLimiter,
  requireAuth,
  requireAdminRole(['admin', 'super_admin']),
  async (req: Request, res: Response) => {
    try {
      const stats = await userProfileService.getProfileStatistics();

      res.json({
        success: true,
        message: 'Profile statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Profile statistics retrieval failed', {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Profile statistics retrieval failed',
        code: 'STATS_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/v1/profile/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        profiles: true,
        preferences: true,
        notifications: true,
        devices: true,
        history: true,
        admin: true,
      },
    });

  } catch (error: any) {
    logger.error('Profile health check failed', { error: error.message });
    
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
  logger.error('Profile route error', {
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