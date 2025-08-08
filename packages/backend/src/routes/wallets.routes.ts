/**
 * Wallets Routes for DwayBank Smart Wallet
 * Provides wallet management and wallet dashboard endpoints
 */

import { Router, Response } from 'express';
import logger from '../config/logger';
import type { AuthenticatedRequest, ApiResponse } from '../types';

// Import middleware (using optional auth for mock data)
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Main Wallets Endpoint
 * GET /api/v1/wallets
 * Returns connected wallets information
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
 * Wallet Dashboard Data
 * GET /api/v1/wallets/dashboard
 * Returns wallet-specific dashboard information
 */
router.get('/dashboard', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

export default router;