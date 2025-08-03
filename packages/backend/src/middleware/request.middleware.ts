/**
 * Request Middleware for DwayBank
 * Handles request logging, ID generation, and common request processing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

// Extend Request interface
declare module 'express' {
  interface Request {
    requestId?: string;
    startTime?: number;
  }
}

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
  });

  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
    });
  });

  next();
};

/**
 * Request ID middleware (simpler version)
 */
export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Response time middleware
 */
export const responseTime = (req: Request, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server identification
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

/**
 * Request size limit middleware
 */
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        message: 'Request entity too large',
        error: 'PAYLOAD_TOO_LARGE',
        maxSize: `${maxSize} bytes`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  };
};