/**
 * DwayBank Smart Wallet - Server with Wallet Integration
 * Enhanced server including wallet aggregation functionality
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import logger from './config/logger';
import { createWalletRoutes } from './routes/wallet.routes';
import getWalletConfig from './config/wallet.config';

const app = express();
const PORT = process.env.PORT || 3004;

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dwaybank',
  user: process.env.DB_USER || 'dwaybank',
  password: process.env.DB_PASSWORD || 'dwaybank_password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Global middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.sandbox.apple.com", "https://pay.googleapis.com"]
    }
  }
}));

app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003',
    process.env.FRONTEND_URL || 'http://localhost:3001'
  ].filter((url): url is string => Boolean(url)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    error: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DwayBank Smart Wallet Backend',
      version: '1.0.0',
      database: 'connected',
      wallet_providers: {
        google_pay: !!process.env.GOOGLE_PAY_CLIENT_ID,
        apple_pay: !!process.env.APPLE_PAY_TEAM_ID,
        metamask: !!process.env.INFURA_PROJECT_ID
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'DwayBank Smart Wallet Backend',
      error: 'Database connection failed'
    });
  }
});

// API info
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: 'v1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      wallets: '/api/wallets',
      accounts: '/api/accounts'
    },
    wallet_integrations: {
      supported: ['apple_pay', 'google_pay', 'metamask'],
      configured: Object.keys(getWalletConfig())
    }
  });
});

// Mock auth endpoints (would be replaced with real auth service)
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      timestamp: new Date().toISOString()
    });
  }

  // Mock successful registration
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: 'user_' + Date.now(),
        email,
        fullName,
        emailVerified: false
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      timestamp: new Date().toISOString()
    });
  }

  // Mock successful login
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: 'user_123',
        email,
        fullName: 'Test User'
      },
      tokens: {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresIn: 3600
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Wallet Integration Routes
try {
  const walletConfig = getWalletConfig();
  const walletRoutes = createWalletRoutes({
    db,
    logger,
    googlePayConfig: walletConfig.googlePay,
    applePayConfig: walletConfig.applePay,
    metaMaskConfig: walletConfig.metaMask
  });
  
  app.use('/api/wallets', walletRoutes);
  logger.info('Wallet routes initialized successfully');
} catch (error) {
  logger.error('Failed to initialize wallet routes:', error);
}

// Mock account endpoints (for traditional banking)
app.get('/api/accounts', (req, res) => {
  // Mock account data
  res.json({
    success: true,
    data: [
      {
        id: 'acc_1',
        account_number: '****1234',
        account_type: 'checking',
        balance: 2500.75,
        available_balance: 2400.75,
        currency: 'USD',
        status: 'active',
        institution_name: 'DwayBank',
        account_name: 'Primary Checking',
        is_primary: true
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`DwayBank Smart Wallet Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log configured wallet providers
  const walletConfig = getWalletConfig();
  const configuredProviders = Object.keys(walletConfig);
  if (configuredProviders.length > 0) {
    logger.info(`Configured wallet providers: ${configuredProviders.join(', ')}`);
  } else {
    logger.warn('No wallet providers configured - check environment variables');
  }
});

export default app;