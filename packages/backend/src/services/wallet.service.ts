/**
 * DwayBank Smart Wallet - Base Wallet Service
 * Handles wallet integration, synchronization, and data aggregation
 */

import { Pool } from 'pg';
import { encrypt, decrypt } from './encryption.service';
import { Logger } from '../config/logger';
import {
  WalletConnection,
  WalletType,
  WalletStatus,
  PaymentMethod,
  WalletBalance,
  WalletTransaction,
  ConnectWalletRequest,
  ConnectWalletResponse,
  SyncWalletRequest,
  SyncWalletResponse,
  WalletDashboardData,
  ApiResponse
} from '../types';

export interface WalletProvider {
  connect(request: ConnectWalletRequest): Promise<ConnectWalletResponse>;
  sync(connection: WalletConnection): Promise<SyncWalletResponse>;
  disconnect(connection: WalletConnection): Promise<void>;
  getPaymentMethods(connection: WalletConnection): Promise<PaymentMethod[]>;
  getBalances(connection: WalletConnection): Promise<WalletBalance[]>;
  getTransactions(connection: WalletConnection, since?: Date): Promise<WalletTransaction[]>;
}

export class WalletService {
  private db: Pool;
  private logger: Logger;
  private providers: Map<WalletType, WalletProvider> = new Map();

  constructor(db: Pool, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Register a wallet provider for a specific wallet type
   */
  registerProvider(walletType: WalletType, provider: WalletProvider): void {
    this.providers.set(walletType, provider);
    this.logger.info(`Registered wallet provider for ${walletType}`);
  }

  /**
   * Get wallet provider for a specific wallet type
   */
  private getProvider(walletType: WalletType): WalletProvider {
    const provider = this.providers.get(walletType);
    if (!provider) {
      throw new Error(`No provider registered for wallet type: ${walletType}`);
    }
    return provider;
  }

  /**
   * Connect a new wallet for a user
   */
  async connectWallet(userId: string, request: ConnectWalletRequest): Promise<ApiResponse<ConnectWalletResponse>> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if wallet already connected
      const existingCheck = await client.query(
        'SELECT id FROM wallet_connections WHERE user_id = $1 AND wallet_type = $2 AND external_wallet_id = $3 AND deleted_at IS NULL',
        [userId, request.wallet_type, request.metadata?.external_id || 'unknown']
      );

      if (existingCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Wallet already connected',
          error: 'WALLET_ALREADY_CONNECTED',
          timestamp: new Date().toISOString()
        };
      }

      // Get provider and connect
      const provider = this.getProvider(request.wallet_type);
      const connectionResult = await provider.connect(request);

      // Encrypt tokens if provided
      const encryptedAccessToken = connectionResult.auth_url ? null : 
        request.access_token ? await encrypt(request.access_token) : null;

      // Insert wallet connection
      const connectionInsert = await client.query(`
        INSERT INTO wallet_connections (
          user_id, wallet_type, external_wallet_id, display_name, status,
          access_token, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        userId,
        request.wallet_type,
        request.metadata?.external_id || connectionResult.connection_id,
        request.display_name || `${request.wallet_type} Wallet`,
        connectionResult.status,
        encryptedAccessToken,
        JSON.stringify(request.metadata || {}),
        userId
      ]);

      const walletConnection = connectionInsert.rows[0];

      // Log sync start
      await this.logSyncStart(walletConnection.id, 'manual');

      // If connection successful, sync initial data
      if (connectionResult.status === 'connected') {
        try {
          await this.syncWalletData(walletConnection);
          await this.logSyncComplete(walletConnection.id, 'completed');
        } catch (syncError) {
          this.logger.warn(`Initial sync failed for wallet ${walletConnection.id}:`, syncError);
          await this.logSyncComplete(walletConnection.id, 'partial', syncError.message);
        }
      }

      await client.query('COMMIT');

      this.logger.info(`Wallet connected: ${request.wallet_type} for user ${userId}`);

      return {
        success: true,
        message: 'Wallet connected successfully',
        data: {
          ...connectionResult,
          connection_id: walletConnection.id
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to connect wallet:', error);
      
      await this.logSyncComplete(null, 'failed', error.message);

      return {
        success: false,
        message: 'Failed to connect wallet',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Sync wallet data (balances, transactions, payment methods)
   */
  async syncWallet(connectionId: string, request: SyncWalletRequest = {}): Promise<ApiResponse<SyncWalletResponse>> {
    const client = await this.db.connect();
    
    try {
      // Get wallet connection
      const connectionResult = await client.query(
        'SELECT * FROM wallet_connections WHERE id = $1 AND deleted_at IS NULL',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        return {
          success: false,
          message: 'Wallet connection not found',
          error: 'WALLET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
      }

      const connection = connectionResult.rows[0];
      
      // Log sync start
      await this.logSyncStart(connectionId, 'manual');

      // Decrypt access token if needed
      if (connection.access_token) {
        connection.access_token = await decrypt(connection.access_token);
      }

      // Perform sync
      const syncResult = await this.syncWalletData(connection, request.force_refresh);
      
      // Log sync completion
      await this.logSyncComplete(connectionId, 'completed');

      return {
        success: true,
        message: 'Wallet synced successfully',
        data: syncResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Failed to sync wallet ${connectionId}:`, error);
      
      await this.logSyncComplete(connectionId, 'failed', error.message);

      return {
        success: false,
        message: 'Failed to sync wallet',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet dashboard data for a user
   */
  async getWalletDashboard(userId: string): Promise<ApiResponse<WalletDashboardData>> {
    try {
      // Get wallet overview from view
      const walletQuery = await this.db.query(`
        SELECT * FROM wallet_dashboard_view 
        WHERE user_id = $1 
        ORDER BY wallet_name
      `, [userId]);

      // Get payment methods with balances
      const paymentMethodsQuery = await this.db.query(`
        SELECT 
          pmb.*,
          wc.wallet_type,
          wc.display_name as wallet_name
        FROM payment_methods_with_balances pmb
        JOIN wallet_connections wc ON pmb.wallet_connection_id = wc.id
        WHERE wc.user_id = $1 AND pmb.is_active = true
        ORDER BY pmb.display_name
      `, [userId]);

      // Get recent transactions
      const transactionsQuery = await this.db.query(`
        SELECT 
          wt.*,
          wc.wallet_type,
          wc.display_name as wallet_name,
          wpm.display_name as payment_method_name
        FROM wallet_transactions wt
        JOIN wallet_connections wc ON wt.wallet_connection_id = wc.id
        LEFT JOIN wallet_payment_methods wpm ON wt.payment_method_id = wpm.id
        WHERE wc.user_id = $1 AND wt.deleted_at IS NULL
        ORDER BY wt.transaction_date DESC
        LIMIT 50
      `, [userId]);

      // Get sync status
      const syncStatusQuery = await this.db.query(`
        SELECT 
          MAX(last_sync) as last_full_sync,
          COUNT(CASE WHEN status = 'syncing' THEN 1 END) as pending_syncs,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_syncs
        FROM wallet_connections 
        WHERE user_id = $1 AND deleted_at IS NULL
      `, [userId]);

      // Calculate total balance
      const totalBalance = paymentMethodsQuery.rows.reduce((sum, pm) => {
        return sum + (parseFloat(pm.balance_usd) || 0);
      }, 0);

      const dashboardData: WalletDashboardData = {
        total_balance_usd: totalBalance,
        connected_wallets: walletQuery.rows,
        payment_methods: paymentMethodsQuery.rows,
        recent_transactions: transactionsQuery.rows,
        sync_status: {
          last_full_sync: syncStatusQuery.rows[0]?.last_full_sync || null,
          pending_syncs: parseInt(syncStatusQuery.rows[0]?.pending_syncs) || 0,
          failed_syncs: parseInt(syncStatusQuery.rows[0]?.failed_syncs) || 0
        }
      };

      return {
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: dashboardData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Failed to get wallet dashboard for user ${userId}:`, error);
      
      return {
        success: false,
        message: 'Failed to retrieve dashboard data',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Disconnect a wallet
   */
  async disconnectWallet(connectionId: string, userId: string): Promise<ApiResponse<void>> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get wallet connection
      const connectionResult = await client.query(
        'SELECT * FROM wallet_connections WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [connectionId, userId]
      );

      if (connectionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Wallet connection not found',
          error: 'WALLET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
      }

      const connection = connectionResult.rows[0];

      // Call provider disconnect if available
      try {
        const provider = this.getProvider(connection.wallet_type);
        await provider.disconnect(connection);
      } catch (error) {
        this.logger.warn(`Provider disconnect failed for ${connection.wallet_type}:`, error);
      }

      // Soft delete wallet connection and related data
      await client.query(
        'UPDATE wallet_connections SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2',
        [userId, connectionId]
      );

      await client.query(
        'UPDATE wallet_payment_methods SET deleted_at = CURRENT_TIMESTAMP WHERE wallet_connection_id = $1',
        [connectionId]
      );

      await client.query(
        'UPDATE wallet_transactions SET deleted_at = CURRENT_TIMESTAMP WHERE wallet_connection_id = $1',
        [connectionId]
      );

      await client.query('COMMIT');

      this.logger.info(`Wallet disconnected: ${connectionId} for user ${userId}`);

      return {
        success: true,
        message: 'Wallet disconnected successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to disconnect wallet ${connectionId}:`, error);
      
      return {
        success: false,
        message: 'Failed to disconnect wallet',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Internal method to sync wallet data using provider
   */
  private async syncWalletData(connection: WalletConnection, forceRefresh = false): Promise<SyncWalletResponse> {
    const provider = this.getProvider(connection.wallet_type);
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update connection status to syncing
      await client.query(
        'UPDATE wallet_connections SET status = $1 WHERE id = $2',
        ['syncing', connection.id]
      );

      // Get payment methods from provider
      const paymentMethods = await provider.getPaymentMethods(connection);
      let paymentMethodsUpdated = 0;

      // Upsert payment methods
      for (const pm of paymentMethods) {
        const result = await client.query(`
          INSERT INTO wallet_payment_methods (
            wallet_connection_id, external_method_id, type, display_name,
            last_four_digits, card_brand, expiry_month, expiry_year, currency, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (wallet_connection_id, external_method_id) 
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            last_four_digits = EXCLUDED.last_four_digits,
            card_brand = EXCLUDED.card_brand,
            expiry_month = EXCLUDED.expiry_month,
            expiry_year = EXCLUDED.expiry_year,
            currency = EXCLUDED.currency,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          connection.id,
          pm.external_method_id,
          pm.type,
          pm.display_name,
          pm.last_four_digits,
          pm.card_brand,
          pm.expiry_month,
          pm.expiry_year,
          pm.currency,
          JSON.stringify(pm.metadata || {})
        ]);
        
        if (result.rows.length > 0) {
          paymentMethodsUpdated++;
        }
      }

      // Get balances from provider
      const balances = await provider.getBalances(connection);
      let balancesUpdated = 0;

      // Update balances
      for (const balance of balances) {
        const result = await client.query(`
          INSERT INTO wallet_balances (
            payment_method_id, current_balance, available_balance, pending_balance,
            currency, exchange_rate_usd, balance_source, last_updated, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
          ON CONFLICT (payment_method_id) 
          DO UPDATE SET
            current_balance = EXCLUDED.current_balance,
            available_balance = EXCLUDED.available_balance,
            pending_balance = EXCLUDED.pending_balance,
            currency = EXCLUDED.currency,
            exchange_rate_usd = EXCLUDED.exchange_rate_usd,
            balance_source = EXCLUDED.balance_source,
            last_updated = CURRENT_TIMESTAMP,
            metadata = EXCLUDED.metadata
          RETURNING id
        `, [
          balance.payment_method_id,
          balance.current_balance,
          balance.available_balance,
          balance.pending_balance,
          balance.currency,
          balance.exchange_rate_usd,
          balance.balance_source,
          JSON.stringify({})
        ]);
        
        if (result.rows.length > 0) {
          balancesUpdated++;
        }
      }

      // Get transactions from provider (last 30 days if not force refresh)
      const since = forceRefresh ? null : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const transactions = await provider.getTransactions(connection, since);
      let transactionsUpdated = 0;

      // Upsert transactions
      for (const tx of transactions) {
        const result = await client.query(`
          INSERT INTO wallet_transactions (
            wallet_connection_id, payment_method_id, external_transaction_id,
            amount, currency, description, merchant_name, merchant_category,
            transaction_type, status, transaction_date, posted_date,
            exchange_rate_usd, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (wallet_connection_id, external_transaction_id) 
          DO UPDATE SET
            amount = EXCLUDED.amount,
            currency = EXCLUDED.currency,
            description = EXCLUDED.description,
            merchant_name = EXCLUDED.merchant_name,
            merchant_category = EXCLUDED.merchant_category,
            transaction_type = EXCLUDED.transaction_type,
            status = EXCLUDED.status,
            posted_date = EXCLUDED.posted_date,
            exchange_rate_usd = EXCLUDED.exchange_rate_usd,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          connection.id,
          tx.payment_method_id,
          tx.external_transaction_id,
          tx.amount,
          tx.currency,
          tx.description,
          tx.merchant_name,
          tx.merchant_category,
          tx.transaction_type,
          tx.status,
          tx.transaction_date,
          tx.posted_date,
          tx.exchange_rate_usd,
          JSON.stringify(tx.metadata || {})
        ]);
        
        if (result.rows.length > 0) {
          transactionsUpdated++;
        }
      }

      // Update connection status and last sync time
      await client.query(
        'UPDATE wallet_connections SET status = $1, last_sync = CURRENT_TIMESTAMP, sync_count = sync_count + 1 WHERE id = $2',
        ['connected', connection.id]
      );

      await client.query('COMMIT');

      return {
        connection_id: connection.id,
        status: 'connected',
        payment_methods_synced: paymentMethodsUpdated,
        transactions_synced: transactionsUpdated,
        balances_updated: balancesUpdated,
        last_sync: new Date(),
        errors: []
      };

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update connection with error status
      await this.db.query(
        'UPDATE wallet_connections SET status = $1, error_message = $2 WHERE id = $3',
        ['error', error.message, connection.id]
      );
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log sync start
   */
  private async logSyncStart(connectionId: string, syncType: string): Promise<void> {
    if (!connectionId) return;
    
    try {
      await this.db.query(`
        INSERT INTO wallet_sync_log (wallet_connection_id, sync_type, status, started_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [connectionId, syncType, 'started']);
    } catch (error) {
      this.logger.warn('Failed to log sync start:', error);
    }
  }

  /**
   * Log sync completion
   */
  private async logSyncComplete(
    connectionId: string, 
    status: string, 
    errorMessage?: string,
    paymentMethodsFound = 0,
    paymentMethodsUpdated = 0,
    transactionsFound = 0,
    transactionsUpdated = 0,
    balancesUpdated = 0
  ): Promise<void> {
    if (!connectionId) return;
    
    try {
      await this.db.query(`
        UPDATE wallet_sync_log 
        SET status = $1, completed_at = CURRENT_TIMESTAMP, 
            duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
            error_message = $2, payment_methods_found = $3, payment_methods_updated = $4,
            transactions_found = $5, transactions_updated = $6, balances_updated = $7
        WHERE wallet_connection_id = $8 AND completed_at IS NULL
      `, [
        status, errorMessage, paymentMethodsFound, paymentMethodsUpdated,
        transactionsFound, transactionsUpdated, balancesUpdated, connectionId
      ]);
    } catch (error) {
      this.logger.warn('Failed to log sync completion:', error);
    }
  }

  /**
   * Schedule automatic sync for all active wallets
   */
  async scheduleAutoSync(): Promise<void> {
    try {
      const dueForSync = await this.db.query(`
        SELECT * FROM wallet_connections 
        WHERE auto_sync_enabled = true 
          AND status = 'connected' 
          AND deleted_at IS NULL
          AND (
            last_sync IS NULL 
            OR last_sync < CURRENT_TIMESTAMP - INTERVAL '1 minute' * sync_frequency
          )
        ORDER BY last_sync ASC NULLS FIRST
        LIMIT 10
      `);

      for (const connection of dueForSync.rows) {
        try {
          await this.syncWalletData(connection);
          this.logger.info(`Auto-synced wallet ${connection.id}`);
        } catch (error) {
          this.logger.error(`Auto-sync failed for wallet ${connection.id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Failed to run scheduled auto-sync:', error);
    }
  }
}

export default WalletService;