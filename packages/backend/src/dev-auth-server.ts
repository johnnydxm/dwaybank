/**
 * Development Authentication Server
 * Uses real authentication services with in-memory mock implementations
 * for database and Redis when not available locally
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import { createMockServices } from './mocks/mock-services';
import logger from './config/logger';

// Extend Express Request interface
interface AuthenticatedRequest extends express.Request {
  requestId?: string;
  user?: any;
  session?: any;
}

// Load development environment
dotenv.config({ path: '.env.development' });

const app = express();
const PORT = 3004;

// Initialize mock services for development
createMockServices();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: AuthenticatedRequest, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  // Add request ID for tracing
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DwayBank Backend (Development)',
    version: '1.0.0',
    environment: 'development',
    features: {
      auth: 'enabled',
      database: 'mock',
      redis: 'mock',
      jwt: 'enabled'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: 'v1',
    environment: 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth',
      health: '/health'
    },
    features: {
      registration: true,
      login: true,
      jwt_tokens: true,
      mfa: false, // Disabled in development
      rate_limiting: true
    }
  });
});

// Mount authentication routes
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use('*', (req: AuthenticatedRequest, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Global error handler
app.use((error: any, req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    requestId: req.requestId
  });

  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('DwayBank Development Server Started', {
    port: PORT,
    environment: 'development',
    cors: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    services: {
      auth: 'enabled',
      database: 'mock',
      redis: 'mock'
    }
  });

  console.log(`🚀 DwayBank Backend (Development) running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/v1/auth`);
  console.log(`🔗 CORS enabled for ports 3000-3003`);
  console.log(`📝 Using mock database and Redis for development`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});