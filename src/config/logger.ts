import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

/**
 * Winston Logger Configuration
 * Structured logging with daily rotation, multiple transports, and security-focused audit trails
 */

// Define log levels and colors
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

// Add colors to winston
winston.addColors(logLevels.colors);

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    // Security: Sanitize sensitive information
    const sanitizedMeta = sanitizeLogData(meta);
    
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'dwaybank-backend',
      environment: process.env.NODE_ENV || 'development',
      ...sanitizedMeta,
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(sanitizeLogData(meta), null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaString}`;
  })
);

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');

// Daily rotate file transport for general logs
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'dwaybank-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'info',
});

// Daily rotate file transport for error logs
const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'dwaybank-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '60d',
  format: logFormat,
  level: 'error',
});

// Security audit log transport
const auditLogTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'security-audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '365d', // Keep security logs for 1 year
  format: logFormat,
  level: 'info',
});

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels.levels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: {
    service: 'dwaybank-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug',
  }));
}

/**
 * Sanitize sensitive information from log data
 */
function sanitizeLogData(data: any): any {
  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'creditCard',
    'ssn',
    'socialSecurityNumber',
    'bankAccount',
    'accountNumber',
    'routingNumber',
    'cvv',
    'pin',
    'otp',
    'mfaCode',
    'verificationCode',
  ];

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };

  Object.keys(sanitized).forEach((key) => {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    const isSensitive = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Security audit logger - separate instance for security events
 */
export const auditLogger = winston.createLogger({
  levels: logLevels.levels,
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        service: 'dwaybank-security',
        environment: process.env.NODE_ENV || 'development',
        audit: true,
        ...sanitizeLogData(meta),
      });
    })
  ),
  transports: [auditLogTransport],
});

/**
 * HTTP request logger - for Express middleware
 */
export const httpLogger = winston.createLogger({
  levels: logLevels.levels,
  level: 'http',
  format: logFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),
  ],
});

/**
 * Performance logger - for monitoring performance metrics
 */
export const performanceLogger = winston.createLogger({
  levels: logLevels.levels,
  level: 'info',
  format: logFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    }),
  ],
});

export default logger;