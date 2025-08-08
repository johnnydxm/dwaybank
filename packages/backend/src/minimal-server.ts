/**
 * DwayBank Minimal Server
 * Simplified server for Docker testing and deployment validation
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import logger from './config/logger';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

/**
 * Minimal DwayBank Server for Docker Testing
 */
class MinimalDwayBankServer {
  private app: express.Application;
  private server: any;
  private startTime: number;

  constructor() {
    this.app = express();
    this.startTime = performance.now();
    this.initializeServer();
  }

  /**
   * Initialize Express server with basic middleware
   */
  private async initializeServer(): Promise<void> {
    try {
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
        logger.warn('Rate limit exceeded', {
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
        const responseTime = performance.now() - startTime;

        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
          services: {
            postgres: 'simulated',
            redis: 'simulated',
          },
          performance: {
            responseTime: `${responseTime.toFixed(2)}ms`,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
          },
        };

        res.status(200).json(health);

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
        endpoints: {
          health: '/health',
          auth: '/api/v1/auth',
          accounts: '/api/v1/accounts',
        },
      });
    });

    // Mock authentication endpoints
    this.app.post('/api/v1/auth/login', (req, res) => {
      const { email, password } = req.body;
      
      // Mock authentication logic
      if (email === 'demo@dwaybank.com' && password === 'DwayBank2024!') {
        res.json({
          success: true,
          message: 'Login successful',
          data: {
            token: 'mock-jwt-token-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now(),
            user: {
              id: 'user-123',
              email: 'demo@dwaybank.com',
              firstName: 'Demo',
              lastName: 'User',
            },
          },
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS',
        });
      }
    });

    this.app.post('/api/v1/auth/register', (req, res) => {
      res.json({
        success: true,
        message: 'Registration successful',
        data: {
          message: 'Account created successfully. Please verify your email.',
        },
      });
    });

    this.app.get('/api/v1/auth/profile', (req, res) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'MISSING_TOKEN',
        });
      }

      res.json({
        success: true,
        data: {
          id: 'user-123',
          email: 'demo@dwaybank.com',
          firstName: 'Demo',
          lastName: 'User',
          isVerified: true,
          mfaEnabled: false,
        },
      });
    });

    // Mock accounts endpoints
    this.app.get('/api/v1/accounts', (req, res) => {
      res.json({
        success: true,
        data: [
          {
            id: 'account-123',
            accountType: 'checking',
            accountName: 'Primary Checking',
            balance: 1000.00,
            currency: 'USD',
            isActive: true,
          },
          {
            id: 'account-456',
            accountType: 'savings',
            accountName: 'Emergency Savings',
            balance: 5000.00,
            currency: 'USD',
            isActive: true,
          },
        ],
      });
    });

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
          
          logger.info('DwayBank Minimal Server started successfully', {
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
        logger.info('Graceful shutdown completed');
        resolve();
      });
    });
  }
}

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

// Create and start server
const server = new MinimalDwayBankServer();

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