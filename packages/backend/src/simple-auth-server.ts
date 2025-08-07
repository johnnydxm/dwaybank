/**
 * Simple Authentication Server for DwayBank
 * Demonstrates working JWT authentication with basic functionality
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 3004;

// In-memory user storage for demo
const users = new Map<string, any>();

// JWT Configuration
const JWT_SECRET = 'dwaybank_super_secret_jwt_key_for_development_only_32_chars_minimum';
const JWT_REFRESH_SECRET = 'dwaybank_super_secret_refresh_jwt_key_for_development_only_32_chars_minimum';

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
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Helper functions
function generateTokens(user: any) {
  const payload = {
    sub: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '15m',
    algorithm: 'HS256' 
  });
  
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: '7d',
    algorithm: 'HS256' 
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900, // 15 minutes
    token_type: 'Bearer'
  };
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
      error: 'MISSING_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  req.user = decoded;
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DwayBank Simple Auth Backend',
    version: '1.0.0',
    environment: 'development',
    features: {
      auth: 'enabled',
      jwt: 'enabled',
      cors: 'enabled'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Simple Authentication API',
    version: 'v1',
    environment: 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/v1/auth/register',
      login: 'POST /api/v1/auth/login',
      profile: 'GET /api/v1/auth/profile',
      refresh: 'POST /api/v1/auth/refresh'
    },
    demo_credentials: [
      { email: 'demo@dwaybank.com', password: 'Demo123456' },
      { email: 'user@dwaybank.com', password: 'User123456' },
      { email: 'test@example.com', password: 'Test123456' }
    ]
  });
});

// Registration endpoint
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required',
        error: 'MISSING_FIELDS',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user already exists
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        error: 'USER_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user = {
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name,
      last_name,
      status: 'active',
      email_verified: false,
      created_at: new Date().toISOString()
    };
    
    users.set(email.toLowerCase(), user);

    // Return user profile (without password)
    const userProfile = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      email_verified: user.email_verified,
      created_at: user.created_at
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userProfile,
        verification_required: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: 'REGISTRATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        error: 'MISSING_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    // Find user
    const user = users.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    // Generate tokens
    const tokens = generateTokens(user);
    
    // Return user profile and tokens
    const userProfile = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      email_verified: user.email_verified,
      created_at: user.created_at
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userProfile,
        tokens
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: 'LOGIN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Profile endpoint
app.get('/api/v1/auth/profile', authenticateToken, (req: any, res) => {
  try {
    const user = users.get(req.user.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const userProfile = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      email_verified: user.email_verified,
      created_at: user.created_at
    };

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: userProfile
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: 'PROFILE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Token refresh endpoint
app.post('/api/v1/auth/refresh', (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        error: 'MISSING_REFRESH_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    // Find user
    const decodedPayload = decoded as any;
    const user = users.get(decodedPayload.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        tokens
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: 'REFRESH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Mock accounts endpoint for testing
app.get('/api/v1/accounts', authenticateToken, (req: any, res) => {
  res.json({
    success: true,
    data: {
      accounts: [
        {
          id: 'acc_1',
          account_number: '****1234',
          account_type: 'checking',
          account_name: 'Primary Checking',
          balance: 2500.75,
          available_balance: 2500.75,
          currency: 'USD',
          status: 'active',
          is_primary: true
        },
        {
          id: 'acc_2',
          account_number: '****5678',
          account_type: 'savings',
          account_name: 'Emergency Savings',
          balance: 10000.00,
          available_balance: 10000.00,
          currency: 'USD',
          status: 'active',
          is_primary: false
        }
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DwayBank Simple Auth Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/v1/auth`);
  console.log(`🔗 CORS enabled for ports 3000-3003`);
  console.log(`📝 Ready for testing with real JWT tokens!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});