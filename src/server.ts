import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config, validateCriticalConfig } from './config/environment';
import { initializeDatabases, closeDatabases, checkDatabaseHealth } from './config/database';
import { initializeMFAService, setMFAService } from './services/mfa.service';
import { initializeSecurityService, setSecurityService } from './services/security.service';
import logger, { auditLogger, httpLogger, performanceLogger } from './config/logger';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

// Import routes
import mfaRoutes from './routes/mfa.routes';
import authRoutes from './routes/auth.routes';

/**
 * DwayBank Smart Wallet Backend Server
 * Foundation Layer - Authentication System
 */

class DwayBankServer {
  private app: express.Application;
  private server: any;
  private startTime: number;

  constructor() {
    this.app = express();
    this.startTime = performance.now();
    this.initializeServer();
  }

  /**
   * Initialize Express server with middleware and routes
   */
  private async initializeServer(): Promise<void> {
    try {
      // Validate critical configuration
      validateCriticalConfig();
      
      // Initialize database connections
      const { postgres } = await initializeDatabases();
      
      // Initialize MFA service
      const mfaServiceInstance = await initializeMFAService(postgres);
      setMFAService(mfaServiceInstance);
      
      // Initialize Security service
      const securityServiceInstance = await initializeSecurityService(postgres);
      setSecurityService(securityServiceInstance);
      
      // Configure middleware
      this.configureMiddleware();
      
      // Configure routes
      this.configureRoutes();
      
      // Configure error handling
      this.configureErrorHandling();
      
      // Start server
      await this.startServer();
      
    } catch (error) {
      logger.error('Server initialization failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      process.exit(1);
    }
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.security.corsOrigin,
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
      ],
      exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    }));

    // Compression middleware
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true,
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.security.rateLimit.windowMs,
      max: config.security.rateLimit.maxRequests,
      skipSuccessfulRequests: config.security.rateLimit.skipSuccessful,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        auditLogger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        });
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000),
        });
      },
    });
    
    this.app.use('/api/', limiter);

    // Request logging middleware
    if (config.monitoring.enableRequestLogging) {
      this.app.use(this.requestLoggingMiddleware);
    }

    // Performance monitoring middleware
    if (config.monitoring.enablePerformanceMonitoring) {
      this.app.use(this.performanceMiddleware);
    }

    // Request ID middleware
    this.app.use(this.requestIdMiddleware);

    logger.info('Middleware configuration completed');
  }

  /**
   * Configure application routes
   */
  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const startTime = performance.now();
        const dbHealth = await checkDatabaseHealth();
        const responseTime = performance.now() - startTime;

        const health = {
          status: dbHealth.postgres && dbHealth.redis ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
          services: {
            postgres: dbHealth.postgres ? 'up' : 'down',
            redis: dbHealth.redis ? 'up' : 'down',
          },
          performance: {
            responseTime: `${responseTime.toFixed(2)}ms`,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
          },
        };

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);

        if (statusCode === 503) {
          logger.warn('Health check failed', { health });
        }

      } catch (error) {
        logger.error('Health check error', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // API version endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'DwayBank Smart Wallet API',
        version: config.API_VERSION,
        environment: config.NODE_ENV,
        documentation: '/api-docs',
        timestamp: new Date().toISOString(),
      });
    });

    // MFA routes
    this.app.use('/api/v1/mfa', mfaRoutes);

    // Authentication routes
    this.app.use('/api/v1/auth', authRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('Route not found', { 
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    });

    logger.info('Routes configuration completed');
  }

  /**
   * Configure error handling middleware
   */
  private configureErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = req.headers['x-request-id'] as string;
      
      logger.error('Unhandled application error', {
        error: error.message,
        stack: error.stack,
        requestId,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Security audit log for errors
      auditLogger.error('Application error occurred', {
        error: error.message,
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });

      const isDevelopment = config.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'An unexpected error occurred',
        requestId,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack }),
      });
    });

    logger.info('Error handling configuration completed');
  }

  /**
   * Request logging middleware
   */
  private requestLoggingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const startTime = performance.now();
    const requestId = req.headers['x-request-id'] as string;

    res.on('finish', () => {
      const responseTime = performance.now() - startTime;
      
      httpLogger.http('HTTP Request', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: res.get('Content-Length'),
      });
    });

    next();
  };

  /**
   * Performance monitoring middleware
   */
  private performanceMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const startTime = performance.now();

    res.on('finish', () => {
      const responseTime = performance.now() - startTime;
      
      // Log slow requests (>1000ms)
      if (responseTime > 1000) {
        performanceLogger.warn('Slow request detected', {
          path: req.path,
          method: req.method,
          responseTime: `${responseTime.toFixed(2)}ms`,
          statusCode: res.statusCode,
        });
      }

      // Log performance metrics
      if (responseTime > 500) {
        performanceLogger.info('Performance metrics', {
          path: req.path,
          method: req.method,
          responseTime: `${responseTime.toFixed(2)}ms`,
          memoryUsage: process.memoryUsage(),
        });
      }
    });

    next();
  };

  /**
   * Request ID middleware
   */
  private requestIdMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };

  /**
   * Start the HTTP server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.listen(config.PORT, () => {
          const bootTime = performance.now() - this.startTime;
          
          logger.info('DwayBank Server started successfully', {
            port: config.PORT,
            environment: config.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0',
            bootTime: `${bootTime.toFixed(2)}ms`,
            endpoints: {
              health: '/health',
              api: '/api',
              auth: '/api/v1/auth',
            },
          });

          auditLogger.info('Server startup completed', {
            port: config.PORT,
            environment: config.NODE_ENV,
            bootTime: `${bootTime.toFixed(2)}ms`,
          });

          resolve();
        });

        this.server.on('error', (error: any) => {
          logger.error('Server startup error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        logger.error('Failed to start server', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Initiating graceful shutdown...');

    return new Promise((resolve) => {
      this.server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await closeDatabases();
          logger.info('Database connections closed');
        } catch (error) {
          logger.error('Error closing databases', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        logger.info('Graceful shutdown completed');
        resolve();
      });
    });
  }
}

// Create and start server
const server = new DwayBankServer();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, initiating graceful shutdown');
  await server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, initiating graceful shutdown');
  await server.shutdown();
  process.exit(0);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise: promise.toString(),
  });
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default server;