/**
 * Authentication Middleware for DwayBank Smart Wallet
 * Handles JWT token validation, rate limiting, and security controls
 */

import { Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth.service';
import { securityService } from '../services/security.service';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';
import type { AuthenticatedRequest, ApiResponse, RateLimitInfo } from '../types';
import { performance } from 'perf_hooks';

/**
 * Authentication middleware - validates JWT tokens
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      auditLogger.warn('Authentication failed - no token provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });

      res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    // Validate token
    const validation = await authService.validateToken(token);

    if (!validation.isValid || !validation.user) {
      auditLogger.warn('Authentication failed - invalid token', {
        error: validation.error,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });

      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    // Attach user and session to request
    req.user = validation.user;
    req.session = validation.session;
    req.requestId = req.headers['x-request-id'] as string;

    const responseTime = performance.now() - startTime;
    
    // Log successful authentication
    logger.debug('Token authentication successful', {
      userId: validation.user.id,
      sessionId: validation.session?.id,
      responseTime: `${responseTime.toFixed(2)}ms`,
    });

    next();

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`,
      ip: req.ip,
      path: req.path,
    });

    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      error: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (token) {
      const validation = await authService.validateToken(token);
      if (validation.isValid && validation.user) {
        req.user = validation.user;
        req.session = validation.session;
      }
    }

    req.requestId = req.headers['x-request-id'] as string;
    next();

  } catch (error) {
    // Continue without authentication if error occurs
    logger.warn('Optional authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    next();
  }
};

/**
 * Rate limiting middleware factory
 */
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  const defaultOptions = {
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.maxRequests,
    skipSuccessfulRequests: config.security.rateLimit.skipSuccessful,
    message: 'Too many requests, please try again later',
    ...options,
  };

  return rateLimit({
    windowMs: defaultOptions.windowMs,
    max: defaultOptions.max,
    skipSuccessfulRequests: defaultOptions.skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by IP and user ID if authenticated
      const authenticatedReq = req as AuthenticatedRequest;
      return authenticatedReq.user
        ? `${req.ip}:${authenticatedReq.user.id}`
        : req.ip;
    },
    handler: (req, res) => {
      const authenticatedReq = req as AuthenticatedRequest;
      
      auditLogger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: authenticatedReq.user?.id,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        limit: defaultOptions.max,
        window: `${defaultOptions.windowMs / 1000}s`,
      });

      const rateLimitInfo: RateLimitInfo = {
        limit: defaultOptions.max,
        remaining: 0,
        reset: new Date(Date.now() + defaultOptions.windowMs),
        blocked: true,
      };

      res.status(429).json({
        success: false,
        message: defaultOptions.message,
        error: 'RATE_LIMIT_EXCEEDED',
        rateLimit: rateLimitInfo,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  });
};

/**
 * Endpoint-specific rate limits
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
});

export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later',
});

export const registrationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Too many registration attempts, please try again later',
});

export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: 'Too many password reset attempts, please try again later',
});

export const emailVerificationRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 verification attempts per window
  message: 'Too many email verification attempts, please try again later',
});

/**
 * Security middleware - logs and analyzes requests for suspicious activity
 */
export const securityMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = performance.now();
    
    // Extract security context
    const securityContext = {
      ip: req.ip,
      userAgent: req.get('User-Agent') || '',
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      sessionId: req.session?.id,
      timestamp: new Date(),
    };

    // Perform security analysis if service is available
    if (securityService) {
      try {
        const analysis = await securityService.analyzeRequest(securityContext);
        
        if (analysis.blocked) {
          auditLogger.error('Request blocked by security analysis', {
            ...securityContext,
            riskScore: analysis.riskScore,
            reasons: analysis.reasons,
          });

          res.status(403).json({
            success: false,
            message: 'Request blocked for security reasons',
            error: 'SECURITY_VIOLATION',
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        if (analysis.riskScore > 0.7) {
          auditLogger.warn('High-risk request detected', {
            ...securityContext,
            riskScore: analysis.riskScore,
            reasons: analysis.reasons,
          });
        }
      } catch (securityError) {
        // Continue processing if security analysis fails
        logger.warn('Security analysis failed', {
          error: securityError instanceof Error ? securityError.message : 'Unknown error',
          ...securityContext,
        });
      }
    }

    const responseTime = performance.now() - startTime;
    
    // Add response time to logs if significant
    if (responseTime > 100) {
      logger.debug('Security middleware completed', {
        responseTime: `${responseTime.toFixed(2)}ms`,
        path: req.path,
      });
    }

    next();

  } catch (error) {
    logger.error('Security middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path,
    });

    // Continue processing on security middleware errors
    next();
  }
};

/**
 * Request validation middleware
 */
export const validateRequest = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate request ID
    if (!req.requestId) {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.requestId);
    }

    // Validate content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        res.status(400).json({
          success: false,
          message: 'Content-Type must be application/json',
          error: 'INVALID_CONTENT_TYPE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }
    }

    // Validate API version (if required)
    const apiVersion = req.get('X-API-Version');
    if (apiVersion && apiVersion !== config.API_VERSION) {
      res.status(400).json({
        success: false,
        message: `Unsupported API version: ${apiVersion}`,
        error: 'UNSUPPORTED_API_VERSION',
        supportedVersion: config.API_VERSION,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    next();

  } catch (error) {
    logger.error('Request validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });

    res.status(500).json({
      success: false,
      message: 'Request validation failed',
      error: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    // For now, all authenticated users have basic access
    // In the future, implement role-based access control
    const userRoles = ['user']; // This would come from user profile
    
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      auditLogger.warn('Authorization failed - insufficient permissions', {
        userId: req.user.id,
        requiredRoles: allowedRoles,
        userRoles,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'AUTHORIZATION_FAILED',
        requiredRoles: allowedRoles,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
      return;
    }

    next();
  };
};

/**
 * Email verification requirement middleware
 */
export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED',
      timestamp: new Date().toISOString(),
    } as ApiResponse);
    return;
  }

  if (!req.user.email_verified) {
    res.status(403).json({
      success: false,
      message: 'Email verification required',
      error: 'EMAIL_VERIFICATION_REQUIRED',
      timestamp: new Date().toISOString(),
    } as ApiResponse);
    return;
  }

  next();
};

/**
 * Account status validation middleware
 */
export const requireActiveAccount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED',
      timestamp: new Date().toISOString(),
    } as ApiResponse);
    return;
  }

  if (req.user.status !== 'active') {
    let message = 'Account is not active';
    let error = 'ACCOUNT_INACTIVE';

    switch (req.user.status) {
      case 'pending':
        message = 'Account is pending verification';
        error = 'ACCOUNT_PENDING';
        break;
      case 'suspended':
        message = 'Account has been suspended';
        error = 'ACCOUNT_SUSPENDED';
        break;
      case 'closed':
        message = 'Account has been closed';
        error = 'ACCOUNT_CLOSED';
        break;
    }

    auditLogger.warn('Access denied - inactive account', {
      userId: req.user.id,
      accountStatus: req.user.status,
      path: req.path,
      method: req.method,
    });

    res.status(403).json({
      success: false,
      message,
      error,
      accountStatus: req.user.status,
      timestamp: new Date().toISOString(),
    } as ApiResponse);
    return;
  }

  next();
};