/**
 * Transactions Routes for DwayBank Smart Wallet
 * Provides transaction history and transaction management endpoints
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (using optional auth for mock data)
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Transaction History
 * GET /api/v1/transactions
 * Returns paginated transaction history with filtering
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
 * Transaction Categories
 * GET /api/v1/transactions/categories
 * Returns available transaction categories
 */
router.get('/categories', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Transaction categories requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    const categories = [
      { id: 'cat_1', name: 'Income', color: '#10B981', icon: '💰' },
      { id: 'cat_2', name: 'Groceries', color: '#F59E0B', icon: '🛒' },
      { id: 'cat_3', name: 'Transportation', color: '#EF4444', icon: '🚗' },
      { id: 'cat_4', name: 'Housing', color: '#8B5CF6', icon: '🏠' },
      { id: 'cat_5', name: 'Utilities', color: '#06B6D4', icon: '⚡' },
      { id: 'cat_6', name: 'Entertainment', color: '#EC4899', icon: '🎬' },
      { id: 'cat_7', name: 'Healthcare', color: '#84CC16', icon: '🏥' },
      { id: 'cat_8', name: 'Education', color: '#6366F1', icon: '📚' }
    ];

    const response: ApiResponse<typeof categories> = {
      success: true,
      message: 'Transaction categories retrieved successfully',
      data: categories,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Transaction categories fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction categories',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Transfer Money
 * POST /api/v1/transactions/transfer
 * Creates a transfer between accounts
 */
router.post('/transfer', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { from_account_id, to_account_id, amount, description } = req.body;

    logger.info('Transfer requested', {
      userId: req.user?.id,
      from_account_id,
      to_account_id,
      amount,
      timestamp: new Date().toISOString()
    });

    if (!from_account_id || !to_account_id || !amount) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: from_account_id, to_account_id, amount',
        error: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const transferData = {
      id: `txn_${Date.now()}`,
      type: 'transfer',
      amount: parseFloat(amount),
      currency: 'USD',
      description: description || 'Account Transfer',
      timestamp: new Date().toISOString(),
      from_account_id,
      to_account_id,
      status: 'completed'
    };

    const response: ApiResponse<typeof transferData> = {
      success: true,
      data: transferData,
      message: 'Transfer completed successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Transfer error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to process transfer',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;