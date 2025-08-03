import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = 3004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DwayBank Backend',
    version: '1.0.0'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: 'v1',
    environment: 'development',
    timestamp: new Date().toISOString()
  });
});

// Mock auth endpoints
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
    message: 'Registration successful. Please check your email for verification.',
    data: {
      user: {
        id: '12345',
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
        id: '12345',
        email,
        fullName: 'Test User',
        emailVerified: true
      },
      tokens: {
        accessToken: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token-12345'
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      timestamp: new Date().toISOString()
    });
  }

  // Mock user profile
  res.json({
    success: true,
    data: {
      user: {
        id: '12345',
        email: 'user@example.com',
        fullName: 'Test User',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Mock accounts endpoint
app.get('/api/v1/accounts', (req, res) => {
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
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 DwayBank Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api`);
});