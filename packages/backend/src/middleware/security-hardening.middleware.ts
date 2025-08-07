/**
 * Security Hardening Middleware for DwayBank
 * Advanced security protections and hardening measures
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';

/**
 * Advanced Rate Limiting Configuration
 */

// Critical operations (login, password reset, MFA)
export const criticalOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use IP + User-Agent fingerprint for better tracking
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.get('User-Agent') || ''}`)
      .digest('hex');
    return fingerprint.substring(0, 16);
  },
  handler: (req, res) => {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.get('User-Agent') || ''}`)
      .digest('hex')
      .substring(0, 16);

    auditLogger.warn('Critical operations rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      fingerprint,
      timestamp: new Date().toISOString(),
    });
    
    res.status(429).json({
      success: false,
      error: 'Too Many Attempts',
      message: 'Critical operation rate limit exceeded. Please try again in 15 minutes.',
      code: 'RATE_LIMIT_CRITICAL',
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString(),
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Financial operations (transactions, transfers)
export const financialOperationsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 financial operations per 5 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // For authenticated users, use user ID, otherwise IP
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    auditLogger.warn('Financial operations rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
    
    res.status(429).json({
      success: false,
      error: 'Financial Operations Limit Exceeded',
      message: 'You have exceeded the limit for financial operations. Please try again in 5 minutes.',
      code: 'RATE_LIMIT_FINANCIAL',
      retryAfter: 5 * 60,
      timestamp: new Date().toISOString(),
    });
  },
});

// Admin operations
export const adminOperationsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 admin operations per 10 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    auditLogger.warn('Admin operations rate limit exceeded', {
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
    
    res.status(429).json({
      success: false,
      error: 'Admin Operations Limit Exceeded',
      message: 'Admin operation rate limit exceeded.',
      code: 'RATE_LIMIT_ADMIN',
      retryAfter: 10 * 60,
      timestamp: new Date().toISOString(),
    });
  },
});

// Slow down middleware for suspicious activity
export const suspiciousActivitySlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 3, // Allow 3 requests per window at full speed
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req) => {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.get('User-Agent') || ''}`)
      .digest('hex');
    return fingerprint.substring(0, 16);
  },
  onLimitReached: (req, res) => {
    auditLogger.warn('Suspicious activity detected - slow down activated', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Advanced Helmet Configuration for Financial Services
 */
export const advancedHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: [],
    },
    reportOnly: false,
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Request ID Middleware
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${uuidv4().substring(0, 8)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Security Headers Middleware
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers for financial services
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Expect-CT', 'enforce, max-age=86400');
  res.setHeader('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'");
  
  // Financial-specific headers
  res.setHeader('X-Financial-Service', 'DwayBank');
  res.setHeader('X-API-Version', config.API_VERSION);
  
  next();
};

/**
 * Input Sanitization Middleware
 */
export const inputSanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize common XSS patterns
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: schemes
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/script/gi, 'Script') // Neutralize script tags
        .trim();
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  
  next();
};

/**
 * Financial Transaction Security Middleware
 */
export const financialSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Enhanced logging for financial operations
  if (req.path.includes('/transaction') || req.path.includes('/transfer') || req.path.includes('/payment')) {
    auditLogger.info('Financial operation initiated', {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * Suspicious Activity Detection Middleware
 */
export const suspiciousActivityDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspicious = {
    score: 0,
    reasons: [] as string[],
  };

  // Check for common attack patterns
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  
  // Bot detection patterns
  if (userAgent.toLowerCase().includes('bot') || 
      userAgent.toLowerCase().includes('crawler') ||
      userAgent.toLowerCase().includes('spider')) {
    suspicious.score += 30;
    suspicious.reasons.push('BOT_USER_AGENT');
  }

  // Empty or suspicious user agents
  if (!userAgent || userAgent.length < 10) {
    suspicious.score += 20;
    suspicious.reasons.push('SUSPICIOUS_USER_AGENT');
  }

  // SQL injection patterns in query parameters
  const queryString = JSON.stringify(req.query).toLowerCase();
  if (queryString.includes('union') || queryString.includes('select') || 
      queryString.includes('drop') || queryString.includes('insert')) {
    suspicious.score += 50;
    suspicious.reasons.push('SQL_INJECTION_ATTEMPT');
  }

  // XSS patterns
  const bodyString = JSON.stringify(req.body || {}).toLowerCase();
  if (bodyString.includes('<script') || bodyString.includes('javascript:') ||
      bodyString.includes('onerror') || bodyString.includes('onload')) {
    suspicious.score += 40;
    suspicious.reasons.push('XSS_ATTEMPT');
  }

  // Multiple rapid requests (beyond rate limiting)
  if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].includes(',')) {
    suspicious.score += 15;
    suspicious.reasons.push('PROXY_CHAIN');
  }

  // Log suspicious activity
  if (suspicious.score >= 50) {
    auditLogger.warn('Suspicious activity detected', {
      ip: req.ip,
      userAgent,
      referer,
      path: req.path,
      method: req.method,
      suspiciousScore: suspicious.score,
      reasons: suspicious.reasons,
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });

    // Block highly suspicious requests
    if (suspicious.score >= 80) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Request blocked due to suspicious activity.',
        code: 'SUSPICIOUS_ACTIVITY_BLOCKED',
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    }
  }

  next();
};

/**
 * CORS Configuration for Financial Services
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = Array.isArray(config.security.corsOrigin) 
      ? config.security.corsOrigin 
      : [config.security.corsOrigin];
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      auditLogger.warn('CORS violation detected', {
        origin,
        allowedOrigins,
        timestamp: new Date().toISOString(),
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Authorization',
    'Accept',
    'X-API-Version',
    'X-Request-ID',
    'X-Device-Fingerprint',
    'X-Platform',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-API-Version',
  ],
  maxAge: 86400, // 24 hours
};

/**
 * JSON Body Parser Security Options
 */
export const jsonParserOptions = {
  limit: '10mb',
  strict: true,
  verify: (req: Request, res: Response, buf: Buffer, encoding: string) => {
    // Check for malformed JSON attacks
    try {
      JSON.parse(buf.toString(encoding));
    } catch (error) {
      auditLogger.warn('Malformed JSON detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: buf.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw new Error('Invalid JSON payload');
    }
  },
};

/**
 * URL Encoded Parser Security Options
 */
export const urlEncodedOptions = {
  extended: true,
  limit: '10mb',
  parameterLimit: 100,
  verify: (req: Request, res: Response, buf: Buffer, encoding: string) => {
    // Check for oversized payloads
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      auditLogger.warn('Oversized payload detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: buf.length,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Payload too large');
    }
  },
};

/**
 * Request Timeout Middleware
 */
export const requestTimeoutMiddleware = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        auditLogger.warn('Request timeout', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          timeout,
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        });
        
        res.status(408).json({
          success: false,
          error: 'Request Timeout',
          message: 'Request took too long to process',
          code: 'REQUEST_TIMEOUT',
          timeout: timeout,
          timestamp: new Date().toISOString(),
        });
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
};

/**
 * IP Whitelisting Middleware (for admin endpoints)
 */
export const ipWhitelistMiddleware = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      auditLogger.warn('IP not whitelisted', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        allowedIPs,
        timestamp: new Date().toISOString(),
      });
      
      return res.status(403).json({
        success: false,
        error: 'Access Denied',
        message: 'Your IP address is not authorized to access this resource',
        code: 'IP_NOT_WHITELISTED',
        timestamp: new Date().toISOString(),
      });
    }
    
    next();
  };
};

export default {
  criticalOperationsLimiter,
  financialOperationsLimiter,
  adminOperationsLimiter,
  suspiciousActivitySlowDown,
  advancedHelmet,
  requestIdMiddleware,
  securityHeadersMiddleware,
  inputSanitizationMiddleware,
  financialSecurityMiddleware,
  suspiciousActivityDetection,
  corsOptions,
  jsonParserOptions,
  urlEncodedOptions,
  requestTimeoutMiddleware,
  ipWhitelistMiddleware,
};