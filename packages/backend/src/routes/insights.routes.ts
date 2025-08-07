/**
 * Insights Routes for DwayBank Smart Wallet
 * Provides AI-driven financial insights and recommendations
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (using optional auth for mock data)
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Financial Insights and Recommendations
 * GET /api/v1/insights
 * Returns AI-driven financial insights and recommendations
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, severity } = req.query;

    logger.info('Insights requested', {
      userId: req.user?.id,
      category,
      severity,
      timestamp: new Date().toISOString()
    });

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
        timestamp: new Date().toISOString(),
        data: {
          current_month: 285.50,
          previous_month: 248.26,
          increase_percentage: 15.0
        }
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
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        data: {
          goal_progress: 0.567,
          target_progress: 0.45,
          ahead_by_days: 45
        }
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
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        data: {
          budget_amount: 150.00,
          spent_amount: 175.00,
          overage_amount: 25.00
        }
      },
      {
        id: 'insight_4',
        type: 'investment_opportunity',
        title: 'Excess Cash Available',
        message: 'You have $500 in excess cash that could be invested',
        severity: 'medium',
        category: 'investment',
        actionable: true,
        suggestion: 'Consider investing in a diversified portfolio',
        timestamp: new Date(Date.now() - 259200000).toISOString(),
        data: {
          excess_cash: 500.00,
          recommended_allocation: {
            stocks: 0.6,
            bonds: 0.3,
            cash: 0.1
          }
        }
      },
      {
        id: 'insight_5',
        type: 'recurring_payment',
        title: 'Unused Subscription Detected',
        message: 'You have not used your streaming service subscription for 2 months',
        severity: 'low',
        category: 'subscriptions',
        actionable: true,
        suggestion: 'Consider canceling unused subscriptions to save money',
        timestamp: new Date(Date.now() - 345600000).toISOString(),
        data: {
          subscription_name: 'Premium Streaming Service',
          monthly_cost: 15.99,
          last_used: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
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

    const response: ApiResponse<typeof insights> = {
      success: true,
      data: insights,
      metadata: {
        total_insights: insights.length,
        actionable_insights: insights.filter(i => i.actionable).length,
        categories: [...new Set(insights.map(i => i.category))],
        severity_distribution: {
          high: insights.filter(i => i.severity === 'high').length,
          medium: insights.filter(i => i.severity === 'medium').length,
          low: insights.filter(i => i.severity === 'low').length,
          positive: insights.filter(i => i.severity === 'positive').length
        }
      },
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

/**
 * Get Insight Categories
 * GET /api/v1/insights/categories
 * Returns available insight categories
 */
router.get('/categories', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Insight categories requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    const categories = [
      {
        id: 'spending',
        name: 'Spending Patterns',
        description: 'Analysis of spending behaviors and trends',
        icon: '💳'
      },
      {
        id: 'savings',
        name: 'Savings Opportunities',
        description: 'Recommendations for improving savings rate',
        icon: '💰'
      },
      {
        id: 'budget',
        name: 'Budget Management',
        description: 'Budget tracking and optimization insights',
        icon: '📊'
      },
      {
        id: 'investment',
        name: 'Investment Opportunities',
        description: 'Investment recommendations and portfolio analysis',
        icon: '📈'
      },
      {
        id: 'subscriptions',
        name: 'Subscription Management',
        description: 'Recurring payment optimization',
        icon: '🔄'
      },
      {
        id: 'goals',
        name: 'Goal Progress',
        description: 'Financial goal tracking and recommendations',
        icon: '🎯'
      }
    ];

    const response: ApiResponse<typeof categories> = {
      success: true,
      data: categories,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Insight categories fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch insight categories',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Mark Insight as Read
 * POST /api/v1/insights/:id/read
 * Marks an insight as read by the user
 */
router.post('/:id/read', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Insight marked as read', {
      userId: req.user?.id,
      insightId: id,
      timestamp: new Date().toISOString()
    });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Insight marked as read',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Mark insight as read error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to mark insight as read',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Dismiss Insight
 * DELETE /api/v1/insights/:id
 * Dismisses an insight for the user
 */
router.delete('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Insight dismissed', {
      userId: req.user?.id,
      insightId: id,
      timestamp: new Date().toISOString()
    });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Insight dismissed successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Insight dismissal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Failed to dismiss insight',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;