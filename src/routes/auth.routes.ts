/**
 * Authentication Routes for DwayBank Smart Wallet
 * Complete user authentication API endpoints with security controls
 */

import { Router, Response } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { emailService } from '../services/email.service';
import { mfaService } from '../services/mfa.service';
import logger, { auditLogger } from '../config/logger';
import type { 
  AuthenticatedRequest, 
  ApiResponse, 
  LoginCredentials,
  RegisterInput,
  RefreshTokenRequest,
  AuthenticationContext 
} from '../types';

// Import middleware
import {
  authenticateToken,
  optionalAuth,
  loginRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  authRateLimit,
  securityMiddleware,
  validateRequest,
  requireEmailVerification,
  requireActiveAccount,
} from '../middleware/auth.middleware';

// Import validation middleware
import {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateEmailVerification,
  validateUpdateProfile,
  validateRefreshToken,
  validateMfaVerification,
  validateSessionId,
  validatePagination,
  validatePasswordStrength,
} from '../middleware/validation.middleware';

import { performance } from 'perf_hooks';

const router = Router();

// Apply common middleware to all routes
router.use(validateRequest);
router.use(securityMiddleware);

// ============================================================================
// USER REGISTRATION & AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /api/v1/auth/register
 * User registration with email verification
 */
router.post('/register', 
  registrationRateLimit,
  validateRegister,
  validatePasswordStrength,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const registerInput: RegisterInput = req.body;
      
      // Check if user already exists
      const existingUser = await userService.getUserByEmail(registerInput.email);
      if (existingUser) {
        auditLogger.warn('Registration attempt with existing email', {
          email: registerInput.email,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        res.status(409).json({
          success: false,
          message: 'An account with this email address already exists',
          error: 'USER_ALREADY_EXISTS',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      // Create authentication context
      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      // Register user
      const result = await authService.register(registerInput, context);

      // Send verification email
      try {
        await emailService.sendVerificationEmail(result.user.email, {
          firstName: result.user.first_name,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=EMAIL_VERIFICATION_TOKEN`,
        });
      } catch (emailError) {
        logger.warn('Failed to send verification email', {
          userId: result.user.id,
          email: result.user.email,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
        // Continue registration process even if email fails
      }

      const responseTime = performance.now() - startTime;
      
      auditLogger.info('User registration successful', {
        userId: result.user.id,
        email: result.user.email,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            status: result.user.status,
            email_verified: result.user.email_verified,
            created_at: result.user.created_at,
          },
          verification_required: result.verification_required,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('User registration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: 'REGISTRATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * User login with MFA challenge
 */
router.post('/login',
  loginRateLimit,
  validateLogin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const credentials: LoginCredentials = req.body;

      // Create authentication context
      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      // Attempt login
      const result = await authService.login(credentials, context);

      if (!result) {
        const responseTime = performance.now() - startTime;
        
        auditLogger.warn('Login failed', {
          email: credentials.email,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const responseTime = performance.now() - startTime;

      if (result.mfa_required) {
        auditLogger.info('Login successful - MFA required', {
          userId: result.user.id,
          mfaMethodCount: result.mfa_methods?.length || 0,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(200).json({
          success: true,
          message: 'MFA verification required',
          data: {
            user: {
              id: result.user.id,
              email: result.user.email,
              first_name: result.user.first_name,
              last_name: result.user.last_name,
            },
            mfa_required: true,
            mfa_methods: result.mfa_methods,
          },
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      auditLogger.info('Login successful', {
        userId: result.user.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Login process failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: 'LOGIN_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/verify-mfa
 * Complete MFA verification and receive tokens
 */
router.post('/verify-mfa',
  authRateLimit,
  validateMfaVerification,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { code, method, config_id, is_backup_code } = req.body;
      const userId = req.headers['x-user-id'] as string;
      const sessionId = req.headers['x-session-id'] as string;

      if (!userId || !sessionId) {
        res.status(400).json({
          success: false,
          message: 'User ID and Session ID headers are required',
          error: 'MISSING_HEADERS',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      const result = await authService.completeMFALogin(
        userId,
        sessionId,
        code,
        context,
        config_id,
        method,
        is_backup_code
      );

      if (!result) {
        const responseTime = performance.now() - startTime;
        
        auditLogger.warn('MFA verification failed', {
          userId,
          sessionId,
          method,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(401).json({
          success: false,
          message: 'Invalid or expired MFA code',
          error: 'INVALID_MFA_CODE',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const responseTime = performance.now() - startTime;
      
      auditLogger.info('MFA verification successful', {
        userId: result.user.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'MFA verification successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('MFA verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'MFA verification failed',
        error: 'MFA_VERIFICATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Secure logout with session cleanup
 */
router.post('/logout',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { all_devices } = req.body;
      const token = req.headers.authorization?.substring(7) || '';

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      const success = await authService.logout(token, context, {
        allDevices: all_devices,
        reason: 'user_logout',
      });

      const responseTime = performance.now() - startTime;

      if (success) {
        auditLogger.info('User logout successful', {
          userId: req.user?.id,
          allDevices: all_devices,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(200).json({
          success: true,
          message: all_devices ? 'Logged out from all devices' : 'Logout successful',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          message: 'Logout failed',
          error: 'LOGOUT_ERROR',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
      }

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: 'LOGOUT_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * JWT token refresh with rotation
 */
router.post('/refresh',
  authRateLimit,
  validateRefreshToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { refresh_token } = req.body;

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      const request: RefreshTokenRequest = {
        refreshToken: refresh_token,
        context,
      };

      const newTokens = await authService.refreshTokens(request);

      if (!newTokens) {
        const responseTime = performance.now() - startTime;
        
        auditLogger.warn('Token refresh failed', {
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
          error: 'INVALID_REFRESH_TOKEN',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const responseTime = performance.now() - startTime;
      
      logger.info('Token refresh successful', {
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          tokens: newTokens,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Token refresh failed',
        error: 'REFRESH_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/auth/profile
 * Get user profile information
 */
router.get('/profile',
  authenticateToken,
  requireActiveAccount,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const responseTime = performance.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: req.user,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

      logger.debug('Profile retrieved', {
        userId: req.user.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Profile retrieval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: 'PROFILE_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * PUT /api/v1/auth/profile
 * Update user profile
 */
router.put('/profile',
  authenticateToken,
  requireActiveAccount,
  requireEmailVerification,
  validateUpdateProfile,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const updateData = req.body;
      const updatedUser = await userService.updateUser(req.user.id, updateData);

      if (!updatedUser) {
        res.status(400).json({
          success: false,
          message: 'Failed to update profile',
          error: 'UPDATE_ERROR',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const responseTime = performance.now() - startTime;
      
      auditLogger.info('Profile updated', {
        userId: req.user.id,
        updatedFields: Object.keys(updateData),
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Profile update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: 'UPDATE_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

// ============================================================================
// PASSWORD MANAGEMENT ROUTES
// ============================================================================

/**
 * POST /api/v1/auth/forgot-password
 * Password reset request
 */
router.post('/forgot-password',
  passwordResetRateLimit,
  validateForgotPassword,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await userService.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      const responseTime = performance.now() - startTime;
      
      if (user && user.status === 'active') {
        try {
          // Generate password reset token and send email
          const resetToken = await userService.generatePasswordResetToken(user.id);
          
          await emailService.sendPasswordResetEmail(email, {
            firstName: user.first_name,
            resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          });

          auditLogger.info('Password reset requested', {
            userId: user.id,
            email: user.email,
            responseTime: `${responseTime.toFixed(2)}ms`,
            ip: req.ip,
          });
        } catch (emailError) {
          logger.error('Failed to send password reset email', {
            email,
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
        }
      } else {
        auditLogger.warn('Password reset requested for non-existent or inactive user', {
          email,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });
      }

      res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Forgot password failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Password reset request failed',
        error: 'RESET_REQUEST_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Password reset completion
 */
router.post('/reset-password',
  passwordResetRateLimit,
  validateResetPassword,
  validatePasswordStrength,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { token, new_password } = req.body;

      const success = await userService.resetPassword(token, new_password);

      const responseTime = performance.now() - startTime;

      if (!success) {
        auditLogger.warn('Password reset failed - invalid token', {
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
          error: 'INVALID_RESET_TOKEN',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      auditLogger.info('Password reset successful', {
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset successful',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Password reset failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Password reset failed',
        error: 'RESET_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * PUT /api/v1/auth/change-password
 * Authenticated password change
 */
router.put('/change-password',
  authenticateToken,
  requireActiveAccount,
  requireEmailVerification,
  authRateLimit,
  validateChangePassword,
  validatePasswordStrength,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const { current_password, new_password } = req.body;

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      const success = await authService.changePassword(
        req.user.id,
        current_password,
        new_password,
        context
      );

      const responseTime = performance.now() - startTime;

      if (!success) {
        auditLogger.warn('Password change failed', {
          userId: req.user.id,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          error: 'INVALID_CURRENT_PASSWORD',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      auditLogger.info('Password changed successfully', {
        userId: req.user.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. You have been logged out from all devices.',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Password change failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Password change failed',
        error: 'PASSWORD_CHANGE_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

// ============================================================================
// EMAIL VERIFICATION ROUTES
// ============================================================================

/**
 * POST /api/v1/auth/verify-email
 * Email verification
 */
router.post('/verify-email',
  emailVerificationRateLimit,
  validateEmailVerification,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { token } = req.body;

      const success = await userService.verifyEmailWithToken(token);

      const responseTime = performance.now() - startTime;

      if (!success) {
        auditLogger.warn('Email verification failed - invalid token', {
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token',
          error: 'INVALID_VERIFICATION_TOKEN',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      auditLogger.info('Email verification successful', {
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Email verification successful',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Email verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Email verification failed',
        error: 'VERIFICATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification',
  emailVerificationRateLimit,
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const { email } = req.body;
      
      // Use authenticated user's email or provided email
      const emailToVerify = req.user?.email || email;
      
      if (!emailToVerify) {
        res.status(400).json({
          success: false,
          message: 'Email address is required',
          error: 'EMAIL_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const user = await userService.getUserByEmail(emailToVerify);
      
      // Always return success to prevent email enumeration
      const responseTime = performance.now() - startTime;
      
      if (user && user.status !== 'closed' && !user.email_verified) {
        try {
          const verificationToken = await userService.generateEmailVerificationToken(user.id);
          
          await emailService.sendVerificationEmail(user.email, {
            firstName: user.first_name,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
          });

          auditLogger.info('Verification email resent', {
            userId: user.id,
            email: user.email,
            responseTime: `${responseTime.toFixed(2)}ms`,
            ip: req.ip,
          });
        } catch (emailError) {
          logger.error('Failed to resend verification email', {
            email: emailToVerify,
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
        }
      } else if (user?.email_verified) {
        auditLogger.warn('Verification email requested for already verified user', {
          email: emailToVerify,
          responseTime: `${responseTime.toFixed(2)}ms`,
          ip: req.ip,
        });
      }

      res.status(200).json({
        success: true,
        message: 'If your account exists and is not verified, a new verification email has been sent.',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Resend verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to resend verification email',
        error: 'RESEND_VERIFICATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

// ============================================================================
// SESSION MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/v1/auth/sessions
 * List active sessions
 */
router.get('/sessions',
  authenticateToken,
  requireActiveAccount,
  validatePagination,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user || !req.session) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const sessions = await authService.getUserSessions(req.user.id, req.session.id);

      const responseTime = performance.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions,
          total: sessions.length,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

      logger.debug('Sessions retrieved', {
        userId: req.user.id,
        sessionCount: sessions.length,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Sessions retrieval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions',
        error: 'SESSIONS_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 * Terminate specific session
 */
router.delete('/sessions/:sessionId',
  authenticateToken,
  requireActiveAccount,
  validateSessionId,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const { sessionId } = req.params;

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      const success = await authService.revokeSession(req.user.id, sessionId, context);

      const responseTime = performance.now() - startTime;

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Session not found or already terminated',
          error: 'SESSION_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      auditLogger.info('Session terminated', {
        userId: req.user.id,
        sessionId,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: 'Session terminated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Session termination failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        sessionId: req.params.sessionId,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to terminate session',
        error: 'SESSION_TERMINATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/v1/auth/sessions
 * Terminate all sessions except current
 */
router.delete('/sessions',
  authenticateToken,
  requireActiveAccount,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = performance.now();
    
    try {
      if (!req.user || !req.session) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        } as ApiResponse);
        return;
      }

      const context: AuthenticationContext = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      };

      // Revoke all sessions for user except current
      const revokedCount = await authService.revokeUserSessions(
        req.user.id,
        req.session.id,
        context
      );

      const responseTime = performance.now() - startTime;

      auditLogger.info('All other sessions terminated', {
        userId: req.user.id,
        revokedCount,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: `${revokedCount} session(s) terminated successfully`,
        data: {
          revoked_sessions: revokedCount,
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);

    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      logger.error('Bulk session termination failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to terminate sessions',
        error: 'BULK_SESSION_TERMINATION_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      } as ApiResponse);
    }
  }
);

export default router;