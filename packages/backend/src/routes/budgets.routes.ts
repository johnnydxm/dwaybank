/**
 * Budgets Routes for DwayBank Smart Wallet
 * Provides budget management and tracking endpoints
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (using optional auth for mock data)
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Budget Management Data
 * GET /api/v1/budgets
 * Returns user budgets with spending tracking
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
 * Create New Budget
 * POST /api/v1/budgets  
 * Creates a new budget for the user
 */
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, amount, period } = req.body;

    logger.info('Budget creation requested', {
      userId: req.user?.id,
      name,
      category,
      amount,
      period,
      timestamp: new Date().toISOString()
    });

    if (!name || !category || !amount || !period) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, category, amount, period',
        error: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const newBudget = {
      id: `budget_${Date.now()}`,
      name,
      category,
      amount: parseFloat(amount),
      spent: 0.00,
      remaining: parseFloat(amount),
      period,
      status: 'on_track',
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    };

    const response: ApiResponse<typeof newBudget> = {
      success: true,
      data: newBudget,
      message: 'Budget created successfully',
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);

  } catch (error) {
    logger.error('Budget creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create budget',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update Budget
 * PUT /api/v1/budgets/:id
 * Updates an existing budget
 */
router.put('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, category, amount, period } = req.body;

    logger.info('Budget update requested', {
      userId: req.user?.id,
      budgetId: id,
      name,
      category,
      amount,
      period,
      timestamp: new Date().toISOString()
    });

    const updatedBudget = {
      id,
      name: name || 'Updated Budget',
      category: category || 'General',
      amount: amount ? parseFloat(amount) : 100.00,
      spent: 25.00, // Mock spent amount
      remaining: amount ? parseFloat(amount) - 25.00 : 75.00,
      period: period || 'monthly',
      status: 'on_track',
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    };

    const response: ApiResponse<typeof updatedBudget> = {
      success: true,
      data: updatedBudget,
      message: 'Budget updated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Budget update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update budget',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete Budget
 * DELETE /api/v1/budgets/:id
 * Deletes a budget
 */
router.delete('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Budget deletion requested', {
      userId: req.user?.id,
      budgetId: id,
      timestamp: new Date().toISOString()
    });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Budget deleted successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Budget deletion error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete budget',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;