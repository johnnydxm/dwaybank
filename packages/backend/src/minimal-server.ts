import express from 'express';
import cors from 'cors';
import { config } from './config/environment';

/**
 * Minimal DwayBank Backend Server for Testing
 * Runs without database dependencies
 */

const app = express();

// Basic middleware
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'DwayBank Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    endpoints: [
      'GET /health - Health check',
      'GET /api - API information',
      'POST /api/v1/auth/register - User registration (mock)',
      'POST /api/v1/auth/login - User login (mock)'
    ],
    timestamp: new Date().toISOString()
  });
});

// Mock authentication endpoints
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (!email || !password || !fullName) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'password', 'fullName']
    });
  }

  // Mock successful registration
  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: 'mock-user-id-' + Date.now(),
      email,
      fullName,
      status: 'pending_verification'
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'password']
    });
  }

  // Mock successful login
  res.json({
    message: 'Login successful',
    user: {
      id: 'mock-user-id-12345',
      email,
      fullName: 'Test User',
      status: 'verified'
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl
  });
});

// Start server
const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ DwayBank Backend running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API info: http://localhost:${PORT}/api`);
  console.log(`🔧 Environment: ${config.NODE_ENV}`);
});

export default app;