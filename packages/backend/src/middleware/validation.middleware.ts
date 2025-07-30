/**
 * Validation Middleware for DwayBank Smart Wallet
 * Joi-based input validation for all authentication endpoints
 */

import { Response, NextFunction } from 'express';
import Joi from 'joi';
import logger, { auditLogger } from '../config/logger';
import type { AuthenticatedRequest, ApiResponse, ValidationError } from '../types';

/**
 * Generic validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));

        auditLogger.warn('Validation failed', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          errors: validationErrors,
          userId: req.user?.id,
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          validation_errors: validationErrors,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Replace request data with validated/sanitized data
      req[target] = value;
      next();

    } catch (validationError) {
      logger.error('Validation middleware error', {
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        path: req.path,
      });

      res.status(500).json({
        success: false,
        message: 'Validation service error',
        error: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * User Registration Schema
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: true } })
    .max(255)
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address cannot exceed 255 characters',
      'any.required': 'Email address is required',
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),

  confirm_password: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match',
      'any.required': 'Password confirmation is required',
    }),

  first_name: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .trim()
    .required()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'First name is required',
    }),

  last_name: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .trim()
    .required()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'Last name is required',
    }),

  phone_number: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be in international format (e.g., +1234567890)',
    }),

  timezone: Joi.string()
    .max(50)
    .optional()
    .default('UTC')
    .messages({
      'string.max': 'Timezone cannot exceed 50 characters',
    }),

  locale: Joi.string()
    .pattern(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .default('en')
    .messages({
      'string.pattern.base': 'Locale must be in format "en" or "en-US"',
    }),

  accept_terms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms of service',
      'any.required': 'Terms of service acceptance is required',
    }),

  accept_privacy: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the privacy policy',
      'any.required': 'Privacy policy acceptance is required',
    }),
});

/**
 * User Login Schema
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address cannot exceed 255 characters',
      'any.required': 'Email address is required',
    }),

  password: Joi.string()
    .min(1)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password cannot be empty',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required',
    }),

  remember_me: Joi.boolean()
    .optional()
    .default(false),
});

/**
 * Password Change Schema
 */
export const changePasswordSchema = Joi.object({
  current_password: Joi.string()
    .min(1)
    .max(128)
    .required()
    .messages({
      'string.min': 'Current password cannot be empty',
      'string.max': 'Current password cannot exceed 128 characters',
      'any.required': 'Current password is required',
    }),

  new_password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.max': 'New password cannot exceed 128 characters',
      'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'New password is required',
    }),

  confirm_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match',
      'any.required': 'Password confirmation is required',
    }),
});

/**
 * Password Reset Request Schema
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address cannot exceed 255 characters',
      'any.required': 'Email address is required',
    }),
});

/**
 * Password Reset Completion Schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .min(32)
    .max(512)
    .required()
    .messages({
      'string.min': 'Reset token is invalid',
      'string.max': 'Reset token is invalid',
      'any.required': 'Reset token is required',
    }),

  new_password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),

  confirm_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match',
      'any.required': 'Password confirmation is required',
    }),
});

/**
 * Email Verification Schema
 */
export const emailVerificationSchema = Joi.object({
  token: Joi.string()
    .min(32)
    .max(512)
    .required()
    .messages({
      'string.min': 'Verification token is invalid',
      'string.max': 'Verification token is invalid',
      'any.required': 'Verification token is required',
    }),
});

/**
 * Profile Update Schema
 */
export const updateProfileSchema = Joi.object({
  first_name: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .trim()
    .optional()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
    }),

  last_name: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .trim()
    .optional()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
    }),

  phone_number: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Phone number must be in international format (e.g., +1234567890)',
    }),

  timezone: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Timezone cannot exceed 50 characters',
    }),

  locale: Joi.string()
    .pattern(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .messages({
      'string.pattern.base': 'Locale must be in format "en" or "en-US"',
    }),

  profile_picture: Joi.string()
    .uri()
    .max(512)
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Profile picture must be a valid URL',
      'string.max': 'Profile picture URL cannot exceed 512 characters',
    }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

/**
 * Refresh Token Schema
 */
export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string()
    .min(32)
    .max(1024)
    .required()
    .messages({
      'string.min': 'Refresh token is invalid',
      'string.max': 'Refresh token is invalid',
      'any.required': 'Refresh token is required',
    }),
});

/**
 * MFA Verification Schema
 */
export const mfaVerificationSchema = Joi.object({
  code: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'MFA code must be 6 digits',
      'any.required': 'MFA code is required',
    }),

  method: Joi.string()
    .valid('totp', 'sms', 'email')
    .optional()
    .messages({
      'any.only': 'MFA method must be one of: totp, sms, email',
    }),

  config_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Config ID must be a valid UUID',
    }),

  is_backup_code: Joi.boolean()
    .optional()
    .default(false),
});

/**
 * Session ID Schema (for params)
 */
export const sessionIdSchema = Joi.object({
  sessionId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Session ID must be a valid UUID',
      'any.required': 'Session ID is required',
    }),
});

/**
 * Pagination Schema (for query params)
 */
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional()
    .default(1)
    .messages({
      'number.min': 'Page number must be at least 1',
      'number.max': 'Page number cannot exceed 1000',
      'number.integer': 'Page number must be an integer',
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
      'number.integer': 'Limit must be an integer',
    }),

  sort: Joi.string()
    .valid('created_at', 'last_used', 'status')
    .optional()
    .default('created_at')
    .messages({
      'any.only': 'Sort field must be one of: created_at, last_used, status',
    }),

  order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('desc')
    .messages({
      'any.only': 'Sort order must be either "asc" or "desc"',
    }),
});

// ============================================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================================

export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateForgotPassword = validate(forgotPasswordSchema);
export const validateResetPassword = validate(resetPasswordSchema);
export const validateEmailVerification = validate(emailVerificationSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateRefreshToken = validate(refreshTokenSchema);
export const validateMfaVerification = validate(mfaVerificationSchema);
export const validateSessionId = validate(sessionIdSchema, 'params');
export const validatePagination = validate(paginationSchema, 'query');

/**
 * Custom validation middleware for complex scenarios
 */
export const validatePasswordStrength = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { password, new_password } = req.body;
    const passwordToCheck = new_password || password;

    if (!passwordToCheck) {
      next();
      return;
    }

    // Additional password strength checks
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', 'password1'
    ];

    if (commonPasswords.includes(passwordToCheck.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Password is too common',
        error: 'WEAK_PASSWORD',
        validation_errors: [{
          field: new_password ? 'new_password' : 'password',
          message: 'Please choose a less common password',
          value: '[REDACTED]',
        }],
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    // Check for repeated characters
    const hasRepeatedChars = /(.)\1{2,}/.test(passwordToCheck);
    if (hasRepeatedChars) {
      res.status(400).json({
        success: false,
        message: 'Password contains too many repeated characters',
        error: 'WEAK_PASSWORD',
        validation_errors: [{
          field: new_password ? 'new_password' : 'password',
          message: 'Password should not contain more than 2 consecutive repeated characters',
          value: '[REDACTED]',
        }],
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    next();

  } catch (error) {
    logger.error('Password strength validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });

    next(); // Continue on validation error
  }
};