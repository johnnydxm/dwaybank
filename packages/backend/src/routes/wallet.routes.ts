/**
 * DwayBank Smart Wallet - Wallet API Routes
 * RESTful API endpoints for wallet integration operations
 */

import { Router } from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { Logger } from '../config/logger';
import WalletService from '../services/wallet.service';
import GooglePayService from '../services/google-pay.service';
import ApplePayService from '../services/apple-pay.service';
import MetaMaskService from '../services/metamask.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

export interface WalletRoutesConfig {
  db: Pool;
  logger: Logger;
  googlePayConfig?: any;
  applePayConfig?: any;
  metaMaskConfig?: any;
}

export function createWalletRoutes(config: WalletRoutesConfig): Router {
  const router = Router();
  const { db, logger } = config;

  // Initialize wallet service and providers
  const walletService = new WalletService(db, logger);

  // Register wallet providers if configurations are provided
  if (config.googlePayConfig) {
    const googlePayService = new GooglePayService(config.googlePayConfig, logger);
    walletService.registerProvider('google_pay', googlePayService);
  }

  if (config.applePayConfig) {
    const applePayService = new ApplePayService(config.applePayConfig, logger);
    walletService.registerProvider('apple_pay', applePayService);
  }

  if (config.metaMaskConfig) {
    const metaMaskService = new MetaMaskService(config.metaMaskConfig, logger);
    walletService.registerProvider('metamask', metaMaskService);
  }

  // Rate limiting for wallet operations
  const walletRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many wallet requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Stricter rate limiting for connection operations
  const connectionRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 connection attempts per hour
    message: {
      success: false,
      message: 'Too many connection attempts, please try again later',
      error: 'CONNECTION_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    }
  });

  // Apply middleware
  router.use(authMiddleware);
  router.use(walletRateLimit);

  // Validation middleware
  const validateRequest = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        data: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };

  /**
   * GET /api/wallets/dashboard
   * Get wallet dashboard data for authenticated user
   */
  router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
    try {
      logger.info(`Getting wallet dashboard for user: ${req.user?.id}`);
      
      const result = await walletService.getWalletDashboard(req.user!.id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Failed to get wallet dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/wallets/connections
   * Get all wallet connections for authenticated user
   */
  router.get('/connections', async (req: AuthenticatedRequest, res) => {
    try {
      const connections = await db.query(`
        SELECT 
          id, wallet_type, display_name, status, last_sync, sync_count,
          is_primary, auto_sync_enabled, created_at, updated_at
        FROM wallet_connections 
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `, [req.user!.id]);

      res.json({
        success: true,
        message: 'Wallet connections retrieved successfully',
        data: connections.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get wallet connections:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallet connections',
        error: 'DATABASE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/wallets/connect
   * Connect a new wallet for the authenticated user
   */
  router.post('/connect',
    connectionRateLimit,
    [
      body('wallet_type')
        .isIn(['apple_pay', 'google_pay', 'metamask', 'samsung_pay', 'paypal', 'manual'])
        .withMessage('Invalid wallet type'),
      body('display_name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Display name must be 1-100 characters'),
      body('auth_code')
        .optional()
        .isString()
        .withMessage('Auth code must be a string'),
      body('access_token')
        .optional()
        .isString()
        .withMessage('Access token must be a string'),
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        logger.info(`Connecting ${req.body.wallet_type} wallet for user: ${req.user?.id}`);
        
        const connectRequest = {
          wallet_type: req.body.wallet_type,
          auth_code: req.body.auth_code,
          access_token: req.body.access_token,
          display_name: req.body.display_name,
          metadata: req.body.metadata
        };

        const result = await walletService.connectWallet(req.user!.id, connectRequest);
        
        res.status(result.success ? 201 : 400).json(result);
      } catch (error) {
        logger.error('Failed to connect wallet:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to connect wallet',
          error: 'CONNECTION_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /api/wallets/:connectionId/sync
   * Sync wallet data for a specific connection
   */
  router.post('/:connectionId/sync',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID'),
      body('force_refresh')
        .optional()
        .isBoolean()
        .withMessage('Force refresh must be a boolean')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        logger.info(`Syncing wallet ${connectionId} for user: ${req.user?.id}`);
        
        // Verify user owns this wallet connection
        const ownershipCheck = await db.query(
          'SELECT id FROM wallet_connections WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [connectionId, req.user!.id]
        );

        if (ownershipCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Wallet connection not found',
            error: 'WALLET_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        const syncRequest = {
          connection_id: connectionId,
          force_refresh: req.body.force_refresh || false
        };

        const result = await walletService.syncWallet(connectionId, syncRequest);
        
        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        logger.error('Failed to sync wallet:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to sync wallet',
          error: 'SYNC_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * DELETE /api/wallets/:connectionId
   * Disconnect a wallet connection
   */
  router.delete('/:connectionId',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        logger.info(`Disconnecting wallet ${connectionId} for user: ${req.user?.id}`);
        
        const result = await walletService.disconnectWallet(connectionId, req.user!.id);
        
        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        logger.error('Failed to disconnect wallet:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to disconnect wallet',
          error: 'DISCONNECTION_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/wallets/:connectionId/payment-methods
   * Get payment methods for a specific wallet connection
   */
  router.get('/:connectionId/payment-methods',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        
        // Verify user owns this wallet connection
        const ownershipCheck = await db.query(
          'SELECT id FROM wallet_connections WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [connectionId, req.user!.id]
        );

        if (ownershipCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Wallet connection not found',
            error: 'WALLET_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        const paymentMethods = await db.query(`
          SELECT 
            pmb.*,
            wc.wallet_type,
            wc.display_name as wallet_name
          FROM payment_methods_with_balances pmb
          JOIN wallet_connections wc ON pmb.wallet_connection_id = wc.id
          WHERE pmb.wallet_connection_id = $1 AND pmb.is_active = true
          ORDER BY pmb.display_name
        `, [connectionId]);

        res.json({
          success: true,
          message: 'Payment methods retrieved successfully',
          data: paymentMethods.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to get payment methods:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve payment methods',
          error: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/wallets/:connectionId/transactions
   * Get transactions for a specific wallet connection
   */
  router.get('/:connectionId/transactions',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),
      query('since')
        .optional()
        .isISO8601()
        .withMessage('Since must be a valid ISO 8601 date')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const since = req.query.since as string;
        
        // Verify user owns this wallet connection
        const ownershipCheck = await db.query(
          'SELECT id FROM wallet_connections WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [connectionId, req.user!.id]
        );

        if (ownershipCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Wallet connection not found',
            error: 'WALLET_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        let query = `
          SELECT 
            wt.*,
            wpm.display_name as payment_method_name
          FROM wallet_transactions wt
          LEFT JOIN wallet_payment_methods wpm ON wt.payment_method_id = wpm.id
          WHERE wt.wallet_connection_id = $1 AND wt.deleted_at IS NULL
        `;
        const params: any[] = [connectionId];

        if (since) {
          query += ` AND wt.transaction_date >= $${params.length + 1}`;
          params.push(since);
        }

        query += ` ORDER BY wt.transaction_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const transactions = await db.query(query, params);

        res.json({
          success: true,
          message: 'Transactions retrieved successfully',
          data: {
            transactions: transactions.rows,
            pagination: {
              limit,
              offset,
              total: transactions.rows.length
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to get transactions:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve transactions',
          error: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/wallets/:connectionId/balances
   * Get balances for a specific wallet connection
   */
  router.get('/:connectionId/balances',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        
        // Verify user owns this wallet connection
        const ownershipCheck = await db.query(
          'SELECT id FROM wallet_connections WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [connectionId, req.user!.id]
        );

        if (ownershipCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Wallet connection not found',
            error: 'WALLET_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        const balances = await db.query(`
          SELECT 
            wb.*,
            wpm.display_name as payment_method_name,
            wpm.type as payment_method_type,
            wpm.currency as payment_method_currency
          FROM wallet_balances wb
          JOIN wallet_payment_methods wpm ON wb.payment_method_id = wpm.id
          WHERE wpm.wallet_connection_id = $1 AND wpm.deleted_at IS NULL
          ORDER BY wb.last_updated DESC
        `, [connectionId]);

        res.json({
          success: true,
          message: 'Balances retrieved successfully',
          data: balances.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to get balances:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve balances',
          error: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/wallets/sync/status
   * Get sync status for all user's wallets
   */
  router.get('/sync/status', async (req: AuthenticatedRequest, res) => {
    try {
      const syncStatus = await db.query(`
        SELECT 
          wc.id,
          wc.wallet_type,
          wc.display_name,
          wc.status,
          wc.last_sync,
          wc.sync_count,
          wc.error_message,
          wsl.status as last_sync_status,
          wsl.duration_ms as last_sync_duration,
          wsl.completed_at as last_sync_completed
        FROM wallet_connections wc
        LEFT JOIN LATERAL (
          SELECT * FROM wallet_sync_log 
          WHERE wallet_connection_id = wc.id 
          ORDER BY started_at DESC 
          LIMIT 1
        ) wsl ON true
        WHERE wc.user_id = $1 AND wc.deleted_at IS NULL
        ORDER BY wc.created_at DESC
      `, [req.user!.id]);

      res.json({
        success: true,
        message: 'Sync status retrieved successfully',
        data: syncStatus.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sync status',
        error: 'DATABASE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * PUT /api/wallets/:connectionId/settings
   * Update wallet connection settings
   */
  router.put('/:connectionId/settings',
    [
      param('connectionId')
        .isUUID()
        .withMessage('Connection ID must be a valid UUID'),
      body('display_name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Display name must be 1-100 characters'),
      body('auto_sync_enabled')
        .optional()
        .isBoolean()
        .withMessage('Auto sync enabled must be a boolean'),
      body('sync_frequency')
        .optional()
        .isInt({ min: 5, max: 1440 })
        .withMessage('Sync frequency must be between 5 and 1440 minutes')
    ],
    validateRequest,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { connectionId } = req.params;
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (req.body.display_name !== undefined) {
          updates.push(`display_name = $${paramIndex++}`);
          params.push(req.body.display_name);
        }

        if (req.body.auto_sync_enabled !== undefined) {
          updates.push(`auto_sync_enabled = $${paramIndex++}`);
          params.push(req.body.auto_sync_enabled);
        }

        if (req.body.sync_frequency !== undefined) {
          updates.push(`sync_frequency = $${paramIndex++}`);
          params.push(req.body.sync_frequency);
        }

        if (updates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No valid updates provided',
            error: 'NO_UPDATES',
            timestamp: new Date().toISOString()
          });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        updates.push(`updated_by = $${paramIndex++}`);
        params.push(req.user!.id);

        params.push(connectionId, req.user!.id);

        const result = await db.query(`
          UPDATE wallet_connections 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} AND deleted_at IS NULL
          RETURNING id, display_name, auto_sync_enabled, sync_frequency, updated_at
        `, params);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Wallet connection not found',
            error: 'WALLET_NOT_FOUND',
            timestamp: new Date().toISOString()
          });
        }

        res.json({
          success: true,
          message: 'Wallet settings updated successfully',
          data: result.rows[0],
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to update wallet settings:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to update wallet settings',
          error: 'UPDATE_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  return router;
}

export default createWalletRoutes;