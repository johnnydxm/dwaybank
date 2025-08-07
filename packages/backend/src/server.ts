import express from 'express';
import cors from 'cors';
import compression from 'compression';
import securityHardening from './middleware/security-hardening.middleware';
import { config, validateCriticalConfig } from './config/environment';
import { initializeDatabases, closeDatabases, checkDatabaseHealth } from './config/database';
import { initializeMFAService, setMFAService } from './services/mfa.service';
import { initializeSecurityService, setSecurityService } from './services/security.service';
import { initializeKYCService, setKYCService } from './services/kyc.service';
import { initializeUserProfileService, setUserProfileService } from './services/user-profile.service';
import logger, { auditLogger, httpLogger, performanceLogger } from './config/logger';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

// Import routes
import mfaRoutes from './routes/mfa.routes';
import authRoutes from './routes/auth.routes';
import oauthRoutes from './routes/oauth.routes';
import kycRoutes from './routes/kyc.routes';
import userProfileRoutes from './routes/user-profile.routes';
import accountRoutes from './routes/account.routes';
import transactionRoutes from './routes/transaction.routes';

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
      
      // Initialize KYC service
      const kycServiceInstance = await initializeKYCService(postgres);
      setKYCService(kycServiceInstance);
      
      // Initialize User Profile service
      const userProfileServiceInstance = await initializeUserProfileService(postgres);
      setUserProfileService(userProfileServiceInstance);
      
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
    // Request ID middleware (must be first)
    this.app.use(securityHardening.requestIdMiddleware);

    // Advanced security headers
    this.app.use(securityHardening.advancedHelmet);
    this.app.use(securityHardening.securityHeadersMiddleware);

    // Request timeout middleware
    this.app.use(securityHardening.requestTimeoutMiddleware(30000)); // 30 seconds

    // Suspicious activity detection
    this.app.use(securityHardening.suspiciousActivityDetection);

    // CORS configuration with enhanced security
    this.app.use(cors(securityHardening.corsOptions));

    // Input sanitization middleware
    this.app.use(securityHardening.inputSanitizationMiddleware);

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

    // Enhanced body parsing with security validation
    this.app.use(express.json(securityHardening.jsonParserOptions));
    this.app.use(express.urlencoded(securityHardening.urlEncodedOptions));

    // Financial transaction security middleware
    this.app.use(securityHardening.financialSecurityMiddleware);

    // Request logging middleware
    if (config.monitoring.enableRequestLogging) {
      this.app.use(this.requestLoggingMiddleware);
    }

    // Performance monitoring middleware
    if (config.monitoring.enablePerformanceMonitoring) {
      this.app.use(this.performanceMiddleware);
    }

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

    // OAuth 2.0 and OpenID Connect routes
    this.app.use('/oauth/v1', oauthRoutes);
    this.app.use('/.well-known', oauthRoutes);

    // KYC routes
    this.app.use('/api/v1/kyc', kycRoutes);

    // User Profile routes
    this.app.use('/api/v1/profile', userProfileRoutes);

    // Financial routes
    this.app.use('/api/v1/accounts', accountRoutes);
    this.app.use('/api/v1/transactions', transactionRoutes);

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
              oauth: '/oauth/v1',
              oidc: '/.well-known/openid_configuration',
              kyc: '/api/v1/kyc',
              profile: '/api/v1/profile',
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

// Prevent memory leaks from event listeners
process.setMaxListeners(20);

// Global shutdown handler to prevent duplicate listeners
let shutdownInProgress = false;

const gracefulShutdown = async (signal: string) => {
  if (shutdownInProgress) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  
  shutdownInProgress = true;
  logger.info(`${signal} received, initiating graceful shutdown`);
  
  try {
    await server.shutdown();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
};

// Graceful shutdown handlers (only register once)
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.once('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise: promise.toString(),
  });
  
  if (!shutdownInProgress) {
    gracefulShutdown('unhandledRejection');
  }
});

// Uncaught exception handler
process.once('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack,
  });
  
  if (!shutdownInProgress) {
    process.exit(1);
  }
});

export default server;