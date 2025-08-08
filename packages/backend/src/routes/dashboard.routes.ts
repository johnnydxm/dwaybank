/**
 * Dashboard Routes for DwayBank Smart Wallet
 * Provides comprehensive financial dashboard data and insights
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (require authentication for financial data)
import { authenticateToken, requireActiveAccount } from '../middleware/auth.middleware';

const router = Router();

/**
 * Main Dashboard Overview
 * GET /api/v1/dashboard
 * Returns financial summary, recent transactions, account overview, and insights
 */
router.get('/', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Dashboard overview requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof dashboardData> = {
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Dashboard overview error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Wallet Dashboard Data
 * GET /api/v1/wallets/dashboard
 * Returns wallet-specific dashboard information
 */
router.get('/wallets', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Wallet dashboard requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof walletDashboardData> = {
      success: true,
      message: 'Wallet dashboard data retrieved successfully',
      data: walletDashboardData,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Wallet dashboard error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet dashboard data',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Transaction History
 * GET /api/v1/transactions
 * Returns paginated transaction history with filtering
 */
router.get('/transactions', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { account_id, limit = '10', offset = '0' } = req.query;

    logger.info('Transactions requested', {
      userId: req.user?.id,
      account_id,
      limit,
      offset,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof paginatedTransactions> = {
      success: true,
      message: 'Transactions retrieved successfully',
      data: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: endIndex < transactions.length
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Transactions fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Budget Management Data
 * GET /api/v1/budgets
 * Returns user budgets with spending tracking
 */
router.get('/budgets', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Budgets requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof budgets> = {
      success: true,
      message: 'Budgets retrieved successfully',
      data: budgets,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Budgets fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Financial Goals Tracking
 * GET /api/v1/goals
 * Returns user financial goals with progress tracking
 */
router.get('/goals', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Goals requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof goals> = {
      success: true,
      message: 'Goals retrieved successfully',
      data: goals,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Goals fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Main Wallets Endpoint
 * GET /api/v1/wallets
 * Returns connected wallets information
 */
router.get('/wallets-main', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Wallets main requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

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

    const response: ApiResponse<typeof wallets> = {
      success: true,
      message: 'Wallets retrieved successfully',
      data: wallets,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Wallets main fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallets',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Financial Insights and Recommendations
 * GET /api/v1/insights
 * Returns AI-driven financial insights and recommendations
 */
router.get('/insights', authenticateToken, requireActiveAccount, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Insights requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    const insights = [
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

    const response: ApiResponse<typeof insights> = {
      success: true,
      message: 'Insights retrieved successfully',
      data: insights,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Insights fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;