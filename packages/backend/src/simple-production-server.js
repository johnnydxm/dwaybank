/**
 * Simple Production Server for DwayBank
 * JavaScript version to avoid TypeScript compilation issues
 * Contains all dashboard endpoints needed by the frontend
 */

const express = require('express');
const cors = require('cors');

// Input sanitization function to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove potential script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
};

// Sanitize object recursively
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
});

// Authentication middleware - requires Bearer token for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // For production, this would validate JWT token
  // For now, just check if token exists and is not empty
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      error: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  // Mock user for authenticated requests (in production this would decode JWT)
  req.user = { 
    id: 'auth-user-12345',
    email: 'authenticated@dwaybank.com',
    fullName: 'Authenticated User' 
  };
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DwayBank Production Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'DwayBank Smart Wallet API',
    version: 'v1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: 'GET /api/v1/dashboard',
      wallets_dashboard: 'GET /api/v1/wallets/dashboard',
      transactions: 'GET /api/v1/transactions',
      budgets: 'GET /api/v1/budgets',
      goals: 'GET /api/v1/goals',
      wallets: 'GET /api/v1/wallets',
      insights: 'GET /api/v1/insights'
    }
  });
});

// ==============================================================================
// DASHBOARD ENDPOINTS
// ==============================================================================

// Main Dashboard Overview - Requires Authentication
app.get('/api/v1/dashboard', authenticateToken, (req, res) => {
  try {
    console.log('Dashboard overview requested');
    
    const dashboardData = {
      summary: {
        total_balance: 12500.75,
        monthly_income: 5000.00,
        monthly_expenses: 3200.50,
        savings_rate: 0.36
      },
      recent_transactions: [
        {
          id: 'txn_1',
          type: 'incoming',
          amount: 150.00,
          currency: 'USD',
          description: 'Salary Payment',
          timestamp: new Date().toISOString(),
          account_id: 'acc_1'
        },
        {
          id: 'txn_2',
          type: 'outgoing',
          amount: 85.50,
          currency: 'USD',
          description: 'Grocery Shopping',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          account_id: 'acc_1'
        },
        {
          id: 'txn_3',
          type: 'outgoing',
          amount: 45.00,
          currency: 'USD',
          description: 'Gas Station',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          account_id: 'acc_1'
        }
      ],
      account_summary: [
        {
          id: 'acc_1',
          name: 'Primary Checking',
          balance: 2500.75,
          currency: 'USD'
        },
        {
          id: 'acc_2', 
          name: 'Emergency Savings',
          balance: 10000.00,
          currency: 'USD'
        }
      ],
      financial_insights: [
        {
          type: 'spending_alert',
          message: 'You spent 15% more on groceries this month',
          severity: 'medium'
        },
        {
          type: 'savings_goal',
          message: 'You are on track to reach your emergency fund goal',
          severity: 'positive'
        }
      ]
    };

    res.json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard overview error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Wallet Dashboard Data - Requires Authentication
app.get('/api/v1/wallets/dashboard', authenticateToken, (req, res) => {
  try {
    console.log('Wallet dashboard requested');
    
    const walletDashboardData = {
      total_balance: 12500.75,
      connected_wallets: [
        {
          id: 'wallet_1',
          name: 'Apple Pay',
          type: 'apple_pay',
          balance: 1250.50,
          currency: 'USD',
          status: 'connected',
          last_sync: new Date().toISOString()
        },
        {
          id: 'wallet_2',
          name: 'Google Pay',
          type: 'google_pay', 
          balance: 750.25,
          currency: 'USD',
          status: 'connected',
          last_sync: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'wallet_3',
          name: 'MetaMask',
          type: 'metamask',
          balance: 0.15,
          currency: 'ETH',
          status: 'syncing',
          last_sync: new Date(Date.now() - 1800000).toISOString()
        }
      ],
      recent_activity: [
        {
          id: 'activity_1',
          type: 'payment',
          amount: 150.00,
          currency: 'USD',
          description: 'Coffee Shop Payment',
          timestamp: new Date().toISOString(),
          wallet_id: 'wallet_1'
        },
        {
          id: 'activity_2',
          type: 'transfer',
          amount: 50.00,
          currency: 'USD',
          description: 'Transfer to Savings',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          wallet_id: 'wallet_2'
        }
      ],
      portfolio_performance: {
        total_value: 12500.75,
        change_24h: 125.50,
        change_percent: 1.02
      }
    };

    res.json({
      success: true,
      message: 'Wallet dashboard data retrieved successfully',
      data: walletDashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Wallet dashboard error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet dashboard data',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Transaction History - Requires Authentication
app.get('/api/v1/transactions', authenticateToken, (req, res) => {
  try {
    const { account_id, limit = '10', offset = '0' } = req.query;
    console.log('Transactions requested', { account_id, limit, offset });

    let transactions = [
      {
        id: 'txn_1',
        type: 'incoming',
        amount: 2500.00,
        currency: 'USD',
        description: 'Salary Payment',
        timestamp: new Date().toISOString(),
        account_id: 'acc_1',
        category: 'Income',
        status: 'completed'
      },
      {
        id: 'txn_2',
        type: 'outgoing',
        amount: 85.50,
        currency: 'USD',
        description: 'Whole Foods Market',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        account_id: 'acc_1',
        category: 'Groceries',
        status: 'completed'
      },
      {
        id: 'txn_3',
        type: 'outgoing',
        amount: 45.00,
        currency: 'USD',
        description: 'Shell Gas Station',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        account_id: 'acc_1',
        category: 'Transportation',
        status: 'completed'
      },
      {
        id: 'txn_4',
        type: 'outgoing',
        amount: 1200.00,
        currency: 'USD',
        description: 'Rent Payment',
        timestamp: new Date(Date.now() - 259200000).toISOString(),
        account_id: 'acc_1',
        category: 'Housing',
        status: 'completed'
      },
      {
        id: 'txn_5',
        type: 'outgoing',
        amount: 75.00,
        currency: 'USD',
        description: 'Electric Bill',
        timestamp: new Date(Date.now() - 345600000).toISOString(),
        account_id: 'acc_1',
        category: 'Utilities',
        status: 'completed'
      }
    ];

    // Filter by account_id if provided
    if (account_id) {
      transactions = transactions.filter(txn => txn.account_id === account_id);
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: endIndex < transactions.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transactions fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Budget Management Data - Requires Authentication
app.get('/api/v1/budgets', authenticateToken, (req, res) => {
  try {
    console.log('Budgets requested');
    
    const budgets = [
      {
        id: 'budget_1',
        name: 'Monthly Groceries',
        category: 'Groceries',
        amount: 400.00,
        spent: 285.50,
        remaining: 114.50,
        period: 'monthly',
        status: 'on_track',
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      },
      {
        id: 'budget_2',
        name: 'Transportation',
        category: 'Transportation',
        amount: 200.00,
        spent: 145.00,
        remaining: 55.00,
        period: 'monthly',
        status: 'on_track',
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      },
      {
        id: 'budget_3',
        name: 'Entertainment',
        category: 'Entertainment',
        amount: 150.00,
        spent: 175.00,
        remaining: -25.00,
        period: 'monthly',
        status: 'over_budget',
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      }
    ];

    res.json({
      success: true,
      message: 'Budgets retrieved successfully',
      data: budgets,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Budgets fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Goals Tracking - Requires Authentication
app.get('/api/v1/goals', authenticateToken, (req, res) => {
  try {
    console.log('Goals requested');
    
    const goals = [
      {
        id: 'goal_1',
        name: 'Emergency Fund',
        description: '6 months of expenses',
        target_amount: 15000.00,
        current_amount: 8500.00,
        progress: 0.567,
        target_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'on_track',
        category: 'Emergency',
        monthly_contribution: 500.00
      },
      {
        id: 'goal_2',
        name: 'Vacation Fund',
        description: 'Europe trip next summer',
        target_amount: 5000.00,
        current_amount: 1200.00,
        progress: 0.24,
        target_date: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'behind',
        category: 'Travel',
        monthly_contribution: 200.00
      },
      {
        id: 'goal_3',
        name: 'New Car',
        description: 'Down payment for new vehicle',
        target_amount: 8000.00,
        current_amount: 3500.00,
        progress: 0.4375,
        target_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'on_track',
        category: 'Vehicle',
        monthly_contribution: 750.00
      }
    ];

    res.json({
      success: true,
      message: 'Goals retrieved successfully',
      data: goals,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Goals fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Main Wallets Endpoint - Requires Authentication
app.get('/api/v1/wallets', authenticateToken, (req, res) => {
  try {
    console.log('Wallets main requested');
    
    const wallets = [
      {
        id: 'wallet_1',
        name: 'Apple Pay',
        type: 'apple_pay',
        balance: 1250.50,
        currency: 'USD',
        status: 'connected',
        last_sync: new Date().toISOString(),
        display_name: 'Apple Pay',
        auto_sync_enabled: true
      },
      {
        id: 'wallet_2',
        name: 'Google Pay',
        type: 'google_pay',
        balance: 750.25,
        currency: 'USD',
        status: 'connected',
        last_sync: new Date(Date.now() - 3600000).toISOString(),
        display_name: 'Google Pay',
        auto_sync_enabled: true
      },
      {
        id: 'wallet_3',
        name: 'MetaMask',
        type: 'metamask',
        balance: 0.15,
        currency: 'ETH',
        status: 'syncing',
        last_sync: new Date(Date.now() - 1800000).toISOString(),
        display_name: 'MetaMask Wallet',
        auto_sync_enabled: false
      }
    ];

    res.json({
      success: true,
      message: 'Wallets retrieved successfully',
      data: wallets,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Wallets main fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallets',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Insights and Recommendations - Requires Authentication
app.get('/api/v1/insights', authenticateToken, (req, res) => {
  try {
    const { category, severity } = req.query;
    console.log('Insights requested', { category, severity });

    let insights = [
      {
        id: 'insight_1',
        type: 'spending_pattern',
        title: 'Grocery Spending Increase',
        message: 'Your grocery spending has increased by 15% compared to last month',
        severity: 'medium',
        category: 'spending',
        actionable: true,
        suggestion: 'Consider meal planning to reduce grocery costs',
        timestamp: new Date().toISOString()
      },
      {
        id: 'insight_2',
        type: 'savings_opportunity',
        title: 'Savings Goal Progress',
        message: 'You are ahead of schedule on your emergency fund goal',
        severity: 'positive',
        category: 'savings',
        actionable: false,
        suggestion: 'Keep up the great work!',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'insight_3',
        type: 'budget_alert',
        title: 'Entertainment Budget Exceeded',
        message: 'You have exceeded your entertainment budget by $25 this month',
        severity: 'high',
        category: 'budget',
        actionable: true,
        suggestion: 'Consider reducing entertainment expenses for the rest of the month',
        timestamp: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    // Filter by category if provided
    if (category) {
      insights = insights.filter(insight => insight.category === category);
    }

    // Filter by severity if provided
    if (severity) {
      insights = insights.filter(insight => insight.severity === severity);
    }

    res.json({
      success: true,
      message: 'Insights retrieved successfully',
      data: insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Insights fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// ==============================================================================
// MOCK AUTH ENDPOINTS (from quick-server.ts)
// ==============================================================================

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      timestamp: new Date().toISOString()
    });
  }

  // Valid credentials for testing
  const validCredentials = [
    { email: 'demo@dwaybank.com', password: 'Demo123456' },
    { email: 'user@dwaybank.com', password: 'User123456' },
    { email: 'test@example.com', password: 'Test123456' }
  ];

  const validUser = validCredentials.find(
    cred => cred.email === email && cred.password === password
  );

  if (!validUser) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      error: 'INVALID_CREDENTIALS',
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
    message: 'Profile retrieved successfully',
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

// Mock accounts endpoint - Requires Authentication
app.get('/api/v1/accounts', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Accounts retrieved successfully',
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
    message: 'Endpoint not found',
    error: 'NOT_FOUND',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DwayBank Production Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api`);
  console.log(`📱 Dashboard endpoints available:`);
  console.log(`  📋 Dashboard: GET /api/v1/dashboard`);
  console.log(`  💰 Wallets Dashboard: GET /api/v1/wallets/dashboard`);
  console.log(`  💳 Transactions: GET /api/v1/transactions`);
  console.log(`  📊 Budgets: GET /api/v1/budgets`);
  console.log(`  🎯 Goals: GET /api/v1/goals`);
  console.log(`  💰 Wallets: GET /api/v1/wallets`);
  console.log(`  💡 Insights: GET /api/v1/insights`);
  console.log(`🔐 Auth endpoints available for testing`);
  console.log(`🔗 CORS enabled for frontend applications`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});