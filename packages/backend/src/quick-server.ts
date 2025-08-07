import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = 3004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
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

  // SECURITY FIX: Actually validate credentials instead of accepting everything
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

  // Mock successful login for valid credentials only
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

// Dashboard Overview Endpoint
app.get('/api/v1/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString()
  });
});

// Wallet Dashboard Endpoint
app.get('/api/v1/wallets/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString()
  });
});

// Transactions Endpoint
app.get('/api/v1/transactions', (req, res) => {
  const { account_id, limit = 10, offset = 0 } = req.query;
  
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
  const startIndex = parseInt(offset as string);
  const endIndex = startIndex + parseInt(limit as string);
  const paginatedTransactions = transactions.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedTransactions,
    pagination: {
      total: transactions.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      has_more: endIndex < transactions.length
    },
    timestamp: new Date().toISOString()
  });
});

// Transaction Categories Endpoint
app.get('/api/v1/transactions/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'cat_1', name: 'Income', color: '#10B981', icon: '💰' },
      { id: 'cat_2', name: 'Groceries', color: '#F59E0B', icon: '🛒' },
      { id: 'cat_3', name: 'Transportation', color: '#EF4444', icon: '🚗' },
      { id: 'cat_4', name: 'Housing', color: '#8B5CF6', icon: '🏠' },
      { id: 'cat_5', name: 'Utilities', color: '#06B6D4', icon: '⚡' },
      { id: 'cat_6', name: 'Entertainment', color: '#EC4899', icon: '🎬' },
      { id: 'cat_7', name: 'Healthcare', color: '#84CC16', icon: '🏥' },
      { id: 'cat_8', name: 'Education', color: '#6366F1', icon: '📚' }
    ],
    timestamp: new Date().toISOString()
  });
});

// Transfer Endpoint
app.post('/api/v1/transactions/transfer', (req, res) => {
  const { from_account_id, to_account_id, amount, description } = req.body;
  
  if (!from_account_id || !to_account_id || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: from_account_id, to_account_id, amount',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: {
      id: `txn_${Date.now()}`,
      type: 'transfer',
      amount: parseFloat(amount),
      currency: 'USD',
      description: description || 'Account Transfer',
      timestamp: new Date().toISOString(),
      from_account_id,
      to_account_id,
      status: 'completed'
    },
    message: 'Transfer completed successfully',
    timestamp: new Date().toISOString()
  });
});

// Budgets Endpoint
app.get('/api/v1/budgets', (req, res) => {
  res.json({
    success: true,
    data: [
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
    ],
    timestamp: new Date().toISOString()
  });
});

// Goals Endpoint
app.get('/api/v1/goals', (req, res) => {
  res.json({
    success: true,
    data: [
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
    ],
    timestamp: new Date().toISOString()
  });
});

// Wallets Main Endpoint
app.get('/api/v1/wallets', (req, res) => {
  res.json({
    success: true,
    data: [
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
    ],
    timestamp: new Date().toISOString()
  });
});

// Insights Endpoint
app.get('/api/v1/insights', (req, res) => {
  res.json({
    success: true,
    data: [
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
    ],
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
  console.log(`🔗 CORS enabled for ports 3000-3003`);
});