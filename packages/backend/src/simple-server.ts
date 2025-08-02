import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Pool } from 'pg';
import AccountService from './services/account.service';
import TransactionService from './services/transaction.service';

/**
 * Simple Financial Server for Testing Core APIs
 * No Redis dependency, just PostgreSQL
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Simple database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dwaybank_dev',
  user: process.env.DB_USER || 'dwaybank',
  password: process.env.DB_PASSWORD || 'dwaybank_secure_2024',
  max: 20
});

// Initialize services
const accountService = new AccountService(pool);
const transactionService = new TransactionService(pool);

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Basic auth middleware (for testing - just pass a mock user)
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: '123e4567-e89b-12d3-a456-426614174000' }; // Mock user ID
  next();
};

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    service: 'DwayBank Simple Financial API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health',
      'GET /api/v1/accounts',
      'POST /api/v1/accounts',
      'GET /api/v1/accounts/:id',
      'GET /api/v1/transactions',
      'POST /api/v1/transactions',
      'POST /api/v1/transactions/transfer',
      'GET /api/v1/transactions/categories'
    ]
  });
});

// Account routes
app.get('/api/v1/accounts', mockAuth, async (req: any, res) => {
  try {
    const result = await accountService.getUserAccounts(req.user.id, req.query);
    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: result.accounts,
      pagination: {
        total: result.total,
        limit: req.query.limit || 20,
        offset: req.query.offset || 0
      }
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/v1/accounts', mockAuth, async (req: any, res) => {
  try {
    console.log('Creating account with data:', req.body);
    const account = await accountService.createAccount(req.user.id, req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/v1/accounts/:accountId', mockAuth, async (req: any, res) => {
  try {
    const account = await accountService.getAccountById(req.params.accountId, req.user.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    res.json({
      success: true,
      message: 'Account retrieved successfully',
      data: account
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Transaction routes
app.get('/api/v1/transactions', mockAuth, async (req: any, res) => {
  try {
    const result = await transactionService.getTransactions(req.user.id, req.query);
    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: result.transactions,
      pagination: {
        total: result.total,
        limit: req.query.limit || 20,
        offset: req.query.offset || 0
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/v1/transactions', mockAuth, async (req: any, res) => {
  try {
    console.log('Creating transaction with data:', req.body);
    const transaction = await transactionService.createTransaction(req.user.id, req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/v1/transactions/transfer', mockAuth, async (req: any, res) => {
  try {
    console.log('Creating transfer with data:', req.body);
    const transaction = await transactionService.createTransfer(req.user.id, req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Transfer created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/v1/transactions/categories', async (req, res) => {
  try {
    const categories = await transactionService.getTransactionCategories();
    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connection established');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Simple Financial Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 API info: http://localhost:${PORT}/api/v1`);
      console.log('Available endpoints:');
      console.log('  GET  /api/v1/accounts');
      console.log('  POST /api/v1/accounts');
      console.log('  GET  /api/v1/accounts/:id');
      console.log('  GET  /api/v1/transactions');
      console.log('  POST /api/v1/transactions');
      console.log('  POST /api/v1/transactions/transfer');
      console.log('  GET  /api/v1/transactions/categories');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('Startup error:', error);
  process.exit(1);
});

export default app;