import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwt.service';
import { sessionService } from '../services/session.service';
import { redisSessionService } from '../services/redis-session.service';
import { userService } from '../services/user.service';
import logger, { auditLogger } from '../config/logger';
import type { UserProfile, JWTPayload } from '../types';

/**
 * Session Management Middleware for DwayBank
 * Handles token rotation, session validation, and security monitoring
 */

export interface SessionRequest extends Request {
  user?: UserProfile & {
    jwt_payload?: JWTPayload;
    session_id?: string;
  };
  session?: {
    id: string;
    data: any;
    isValid: boolean;
    needsRefresh: boolean;
  };
}

export interface SessionOptions {
  autoRefresh?: boolean;
  refreshThreshold?: number; // Minutes before expiry to trigger refresh
  trackActivity?: boolean;
  requireValidSession?: boolean;
}

/**
 * Advanced session validation middleware with automatic token rotation
 */
export const sessionValidator = (options: SessionOptions = {}) => {
  const {
    autoRefresh = true,
    refreshThreshold = 15, // 15 minutes
    trackActivity = true,
    requireValidSession = true,
  } = options;

  return async (req: SessionRequest, res: Response, next: NextFunction) => {
    try {
      // Extract token from request
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        if (requireValidSession) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authentication token provided',
            timestamp: new Date().toISOString(),
          });
        }
        return next();
      }

      // Validate JWT token
      const tokenValidation = await jwtService.validateAccessToken(token);
      
      if (!tokenValidation.isValid) {
        if (tokenValidation.isExpired && autoRefresh) {
          // Attempt automatic token refresh
          const refreshResult = await attemptTokenRefresh(req, res);
          if (refreshResult) {
            return next();
          }
        }

        auditLogger.warn('Invalid session token', {
          error: tokenValidation.error,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        if (requireValidSession) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: tokenValidation.error || 'Invalid token',
            token_expired: tokenValidation.isExpired,
            timestamp: new Date().toISOString(),
          });
        }
        return next();
      }

      const payload = tokenValidation.payload!;

      // Get user information
      const user = await userService.getUserById(payload.sub);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate session in Redis
      const sessionData = await redisSessionService.getSession(payload.session_id);
      if (!sessionData) {
        auditLogger.warn('Session not found in Redis', {
          userId: user.id,
          sessionId: payload.session_id,
          ipAddress: req.ip,
        });

        if (requireValidSession) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Session expired or invalid',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Check if token needs refresh
      const needsRefresh = shouldRefreshToken(payload, refreshThreshold);
      
      if (needsRefresh && autoRefresh) {
        // Set header to indicate client should refresh token
        res.setHeader('X-Token-Refresh-Required', 'true');
        res.setHeader('X-Token-Expires-In', Math.floor((payload.exp * 1000 - Date.now()) / 1000));
      }

      // Track session activity
      if (trackActivity && sessionData) {
        await sessionService.updateSessionActivity(payload.session_id);
        
        // Update Redis session last access
        await redisSessionService.updateSession(payload.session_id, {
          lastAccess: new Date().toISOString(),
        });
      }

      // Attach user and session to request
      req.user = {
        ...user,
        jwt_payload: payload,
        session_id: payload.session_id,
      };

      req.session = {
        id: payload.session_id,
        data: sessionData,
        isValid: true,
        needsRefresh,
      };

      logger.debug('Session validated successfully', {
        userId: user.id,
        sessionId: payload.session_id,
        needsRefresh,
      });

      next();

    } catch (error) {
      logger.error('Session validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip,
        path: req.path,
      });

      if (requireValidSession) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Session validation failed',
          timestamp: new Date().toISOString(),
        });
      }

      next();
    }
  };
};

/**
 * Session activity tracking middleware
 */
export const sessionTracker = () => {
  return async (req: SessionRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Continue with request processing
    next();

    // Track activity after response (non-blocking)
    res.on('finish', async () => {
      try {
        if (!req.user?.session_id) return;

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Update session activity with performance metrics
        await redisSessionService.updateSession(req.user.session_id, {
          lastAccess: new Date().toISOString(),
        });

        // Log slow requests
        if (responseTime > 1000) {
          logger.warn('Slow request detected', {
            userId: req.user.id,
            sessionId: req.user.session_id,
            path: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
          });
        }

      } catch (error) {
        logger.error('Session tracking error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.user?.id,
          sessionId: req.user?.session_id,
        });
      }
    });
  };
};

/**
 * Automatic session cleanup middleware
 */
export const sessionCleanup = () => {
  let lastCleanup = 0;
  const cleanupInterval = 300000; // 5 minutes

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    
    // Run cleanup if enough time has passed
    if (now - lastCleanup > cleanupInterval) {
      lastCleanup = now;
      
      // Run cleanup asynchronously
      setImmediate(async () => {
        try {
          const cleanedSessions = await sessionService.cleanupExpiredSessions();
          const cleanedRedis = await redisSessionService.cleanupExpiredSessions();
          
          if (cleanedSessions > 0 || cleanedRedis > 0) {
            logger.info('Session cleanup completed', {
              cleanedDatabaseSessions: cleanedSessions,
              cleanedRedisSessions: cleanedRedis,
            });
          }
        } catch (error) {
          logger.error('Session cleanup error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    }

    next();
  };
};

/**
 * Session security monitoring middleware
 */
export const sessionSecurityMonitor = () => {
  return async (req: SessionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.session_id) {
        return next();
      }

      const sessionData = await redisSessionService.getSession(req.user.session_id);
      if (!sessionData) {
        return next();
      }

      // Check for suspicious activity
      const suspiciousIndicators = [];

      // IP address change
      if (sessionData.ipAddress !== req.ip) {
        suspiciousIndicators.push('ip_change');
      }

      // User agent change
      const currentUserAgent = req.get('User-Agent') || '';
      if (sessionData.userAgent !== currentUserAgent) {
        suspiciousIndicators.push('user_agent_change');
      }

      // Unusual access patterns (could be expanded)
      const lastAccess = new Date(sessionData.lastAccess);
      const timeSinceLastAccess = Date.now() - lastAccess.getTime();
      if (timeSinceLastAccess < 1000) { // Less than 1 second
        suspiciousIndicators.push('rapid_requests');
      }

      // Log suspicious activity
      if (suspiciousIndicators.length > 0) {
        auditLogger.warn('Suspicious session activity detected', {
          userId: req.user.id,
          sessionId: req.user.session_id,
          indicators: suspiciousIndicators,
          currentIP: req.ip,
          sessionIP: sessionData.ipAddress,
          currentUserAgent: currentUserAgent,
          sessionUserAgent: sessionData.userAgent,
        });

        // Update session as suspicious
        await redisSessionService.updateSession(req.user.session_id, {
          isSuspicious: true,
        });

        // Add security headers
        res.setHeader('X-Security-Alert', 'suspicious-activity-detected');
      }

      next();

    } catch (error) {
      logger.error('Security monitoring error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        sessionId: req.user?.session_id,
      });
      next();
    }
  };
};

/**
 * Session rate limiting middleware
 */
export const sessionRateLimit = (options: {
  maxRequests?: number;
  windowMs?: number;
  skipSuccessful?: boolean;
} = {}) => {
  const {
    maxRequests = 100,
    windowMs = 60000, // 1 minute
    skipSuccessful = true,
  } = options;

  return async (req: SessionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.session_id) {
        return next();
      }

      const rateLimitKey = `rate_limit:${req.user.session_id}`;
      const window = Math.floor(Date.now() / windowMs);
      const key = `${rateLimitKey}:${window}`;

      // Get current request count
      const currentCount = await redisSessionService.redis.get(key);
      const requestCount = currentCount ? parseInt(currentCount) : 0;

      // Check if limit exceeded
      if (requestCount >= maxRequests) {
        auditLogger.warn('Session rate limit exceeded', {
          userId: req.user.id,
          sessionId: req.user.session_id,
          requestCount,
          maxRequests,
          ipAddress: req.ip,
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for this session',
          retryAfter: Math.ceil(windowMs / 1000),
          timestamp: new Date().toISOString(),
        });
      }

      // Increment counter
      await redisSessionService.redis.multi()
        .incr(key)
        .expire(key, Math.ceil(windowMs / 1000))
        .exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - requestCount - 1);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs));

      next();

    } catch (error) {
      logger.error('Session rate limiting error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        sessionId: req.user?.session_id,
      });
      next(); // Continue on error (fail open)
    }
  };
};

// Helper functions

function extractTokenFromRequest(req: Request): string | null {
  // Authorization header
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }

  // Cookie
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }

  // Custom header
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'] as string;
  }

  // Query parameter (less secure)
  if (req.query.access_token) {
    return req.query.access_token as string;
  }

  return null;
}

function shouldRefreshToken(payload: JWTPayload, thresholdMinutes: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;
  const threshold = thresholdMinutes * 60;

  return timeUntilExpiry <= threshold && timeUntilExpiry > 0;
}

async function attemptTokenRefresh(req: SessionRequest, res: Response): Promise<boolean> {
  try {
    // This is a simplified version - in production, you'd need to handle
    // refresh token extraction and validation more carefully
    const refreshToken = req.cookies?.refresh_token || req.headers['x-refresh-token'];
    
    if (!refreshToken) {
      return false;
    }

    // Validate refresh token
    const validation = await jwtService.validateRefreshToken(refreshToken as string);
    if (!validation.isValid || !validation.payload) {
      return false;
    }

    // Get user
    const user = await userService.getUserById(validation.payload.sub);
    if (!user) {
      return false;
    }

    // Generate new tokens
    const newTokens = await jwtService.refreshTokens(refreshToken as string, user);
    if (!newTokens) {
      return false;
    }

    // Set new tokens in response
    res.setHeader('X-New-Access-Token', newTokens.access_token);
    res.setHeader('X-New-Refresh-Token', newTokens.refresh_token);

    // Update request with new token for this request
    req.headers.authorization = `Bearer ${newTokens.access_token}`;

    auditLogger.info('Token automatically refreshed', {
      userId: user.id,
      sessionId: validation.payload.session_id,
      ipAddress: req.ip,
    });

    return true;

  } catch (error) {
    logger.error('Automatic token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: req.ip,
    });
    return false;
  }
}

export {
  SessionRequest,
  SessionOptions,
};