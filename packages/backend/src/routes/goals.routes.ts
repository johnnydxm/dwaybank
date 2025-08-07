/**
 * Goals Routes for DwayBank Smart Wallet
 * Provides financial goals tracking and management endpoints
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (using optional auth for mock data)
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Financial Goals Tracking
 * GET /api/v1/goals
 * Returns user financial goals with progress tracking
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
 * Create New Goal
 * POST /api/v1/goals
 * Creates a new financial goal for the user
 */
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description, target_amount, target_date, category, monthly_contribution } = req.body;

    logger.info('Goal creation requested', {
      userId: req.user?.id,
      name,
      target_amount,
      category,
      timestamp: new Date().toISOString()
    });

    if (!name || !target_amount || !target_date || !category) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, target_amount, target_date, category',
        error: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const newGoal = {
      id: `goal_${Date.now()}`,
      name,
      description: description || '',
      target_amount: parseFloat(target_amount),
      current_amount: 0.00,
      progress: 0.00,
      target_date,
      status: 'on_track',
      category,
      monthly_contribution: monthly_contribution ? parseFloat(monthly_contribution) : 0.00
    };

    const response: ApiResponse<typeof newGoal> = {
      success: true,
      data: newGoal,
      message: 'Goal created successfully',
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);

  } catch (error) {
    logger.error('Goal creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create goal',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update Goal
 * PUT /api/v1/goals/:id
 * Updates an existing financial goal
 */
router.put('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, target_amount, current_amount, target_date, category, monthly_contribution } = req.body;

    logger.info('Goal update requested', {
      userId: req.user?.id,
      goalId: id,
      name,
      target_amount,
      timestamp: new Date().toISOString()
    });

    // Calculate progress if both target and current amounts are provided
    const targetAmt = target_amount ? parseFloat(target_amount) : 1000.00;
    const currentAmt = current_amount ? parseFloat(current_amount) : 100.00;
    const progress = targetAmt > 0 ? currentAmt / targetAmt : 0;

    const updatedGoal = {
      id,
      name: name || 'Updated Goal',
      description: description || 'Updated description',
      target_amount: targetAmt,
      current_amount: currentAmt,
      progress: Math.min(progress, 1.0), // Cap at 100%
      target_date: target_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: progress >= 1.0 ? 'completed' : progress >= 0.8 ? 'on_track' : 'behind',
      category: category || 'General',
      monthly_contribution: monthly_contribution ? parseFloat(monthly_contribution) : 0.00
    };

    const response: ApiResponse<typeof updatedGoal> = {
      success: true,
      data: updatedGoal,
      message: 'Goal updated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Goal update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update goal',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete Goal
 * DELETE /api/v1/goals/:id
 * Deletes a financial goal
 */
router.delete('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Goal deletion requested', {
      userId: req.user?.id,
      goalId: id,
      timestamp: new Date().toISOString()
    });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Goal deleted successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Goal deletion error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete goal',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Add Contribution to Goal
 * POST /api/v1/goals/:id/contribute
 * Adds a contribution to a financial goal
 */
router.post('/:id/contribute', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    logger.info('Goal contribution requested', {
      userId: req.user?.id,
      goalId: id,
      amount,
      timestamp: new Date().toISOString()
    });

    if (!amount || parseFloat(amount) <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid contribution amount',
        error: 'INVALID_AMOUNT',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const contribution = {
      id: `contrib_${Date.now()}`,
      goal_id: id,
      amount: parseFloat(amount),
      description: description || 'Manual contribution',
      timestamp: new Date().toISOString()
    };

    const response: ApiResponse<typeof contribution> = {
      success: true,
      data: contribution,
      message: 'Contribution added successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Goal contribution error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to add contribution',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;