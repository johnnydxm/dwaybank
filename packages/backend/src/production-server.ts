/**
 * DwayBank Production Server
 * Replaces quick-server.ts with real backend services and authentication
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabases, checkDatabaseHealth } from './config/database';
import logger from './config/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request.middleware';

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
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
    'http://localhost:3003',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-id'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DwayBank Production Backend',
      version: '1.0.0',
      database: {
        postgres: dbHealth.postgres ? 'connected' : 'disconnected',
        redis: dbHealth.redis ? 'connected' : 'disconnected',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'DwayBank Production Backend',
      version: '1.0.0',
      error: 'Database connection failed',
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: 'v1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
    auth: {
      login: 'POST /api/v1/auth/login',
      register: 'POST /api/v1/auth/register',
      profile: 'GET /api/v1/auth/profile',
      refresh: 'POST /api/v1/auth/refresh',
    },
    accounts: {
      list: 'GET /api/v1/accounts',
      create: 'POST /api/v1/accounts',
      details: 'GET /api/v1/accounts/:id',
    },
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/accounts', accountRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: 'NOT_FOUND',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

// Initialize databases and start server
async function startServer() {
  try {
    // Initialize database connections
    logger.info('Initializing database connections...');
    await initializeDatabases();
    logger.info('Database connections established');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info('DwayBank Production Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      });

      console.log(`🚀 DwayBank Production Backend running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 API info: http://localhost:${PORT}/api`);
      console.log(`🔐 Authentication: http://localhost:${PORT}/api/v1/auth`);
      console.log(`🏦 Accounts: http://localhost:${PORT}/api/v1/accounts`);
      console.log(`🔗 CORS enabled for frontend applications`);
    });

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start the server
startServer();