import { Pool } from 'pg';
import { z } from 'zod';
import logger from '../config/logger';

// Type definitions
export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  merchant_name?: string;
  reference_id: string;
  external_transaction_id?: string;
  category_id?: string;
  category?: TransactionCategory;
  tags: string[];
  balance_after?: number;
  fee_amount: number;
  exchange_rate?: number;
  original_amount?: number;
  original_currency?: string;
  location_latitude?: number;
  location_longitude?: number;
  location_address?: string;
  transaction_date: string;
  posted_date?: string;
  pending: boolean;
  transfer_pair_id?: string;
  parent_transaction_id?: string;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  transaction_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface TransactionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_category_id?: string;
  budget_limit?: number;
}

export interface TransferRequest {
  from_account_id: string;
  to_account_id?: string;
  to_external_account?: {
    routing_number: string;
    account_number: string;
    account_name: string;
    bank_name: string;
  };
  amount: number;
  currency: string;
  description?: string;
  scheduled_date?: string;
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    end_date?: string;
    occurrences?: number;
  };
}

// Validation schemas
export const transactionSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  type: z.enum(['credit', 'debit']),
  description: z.string().min(1).max(500),
  merchant_name: z.string().max(200).optional(),
  external_transaction_id: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  fee_amount: z.number().min(0).default(0),
  exchange_rate: z.number().positive().optional(),
  original_amount: z.number().positive().optional(),
  original_currency: z.string().length(3).optional(),
  location_latitude: z.number().min(-90).max(90).optional(),
  location_longitude: z.number().min(-180).max(180).optional(),
  location_address: z.string().optional(),
  transaction_date: z.string().datetime().optional(),
  requires_approval: z.boolean().default(false),
  transaction_metadata: z.record(z.any()).default({})
});

export const transferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid().optional(),
  to_external_account: z.object({
    routing_number: z.string().length(9),
    account_number: z.string().min(1),
    account_name: z.string().min(1),
    bank_name: z.string().min(1)
  }).optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  description: z.string().max(500).optional(),
  scheduled_date: z.string().datetime().optional(),
  recurring: z.object({
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
    end_date: z.string().datetime().optional(),
    occurrences: z.number().positive().optional()
  }).optional()
}).refine(data => data.to_account_id || data.to_external_account, {
  message: "Either to_account_id or to_external_account must be provided"
});

export const transactionQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  type: z.enum(['credit', 'debit']).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
  merchant_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sort_by: z.enum(['transaction_date', 'amount', 'created_at']).default('transaction_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type CreateTransactionData = z.infer<typeof transactionSchema>;
export type TransferData = z.infer<typeof transferSchema>;
export type TransactionQueryParams = z.infer<typeof transactionQuerySchema>;

export class TransactionService {
  constructor(private db: Pool) {}

  /**
   * Create a new transaction
   */
  async createTransaction(userId: string, transactionData: CreateTransactionData, createdBy?: string): Promise<Transaction> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate input
      const validatedData = transactionSchema.parse(transactionData);
      
      // Verify account ownership
      const { rows: accountRows } = await client.query(
        'SELECT id, balance, available_balance, overdraft_limit FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [validatedData.account_id, userId]
      );
      
      if (accountRows.length === 0) {
        throw new Error('Account not found or access denied');
      }
      
      const account = accountRows[0];
      
      // Check if debit transaction would exceed available balance + overdraft
      if (validatedData.type === 'debit') {
        const availableWithOverdraft = parseFloat(account.available_balance) + parseFloat(account.overdraft_limit);
        if (validatedData.amount > availableWithOverdraft) {
          throw new Error('Insufficient funds');
        }
      }
      
      // Insert transaction
      const { rows } = await client.query(`
        INSERT INTO transactions (
          account_id, amount, currency, type, description, merchant_name,
          external_transaction_id, category_id, tags, fee_amount, exchange_rate,
          original_amount, original_currency, location_latitude, location_longitude,
          location_address, transaction_date, requires_approval, transaction_metadata,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `, [
        validatedData.account_id,
        validatedData.amount,
        validatedData.currency,
        validatedData.type,
        validatedData.description,
        validatedData.merchant_name,
        validatedData.external_transaction_id,
        validatedData.category_id,
        validatedData.tags,
        validatedData.fee_amount,
        validatedData.exchange_rate,
        validatedData.original_amount,
        validatedData.original_currency,
        validatedData.location_latitude,
        validatedData.location_longitude,
        validatedData.location_address,
        validatedData.transaction_date || new Date().toISOString(),
        validatedData.requires_approval,
        JSON.stringify(validatedData.transaction_metadata),
        createdBy || userId
      ]);
      
      // If transaction doesn't require approval, mark as completed
      if (!validatedData.requires_approval) {
        await client.query(
          'UPDATE transactions SET status = $1, pending = FALSE, posted_date = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', rows[0].id]
        );
        rows[0].status = 'completed';
        rows[0].pending = false;
        rows[0].posted_date = new Date().toISOString();
      }
      
      await client.query('COMMIT');
      
      const transaction = await this.getTransactionById(rows[0].id, userId);
      
      logger.info('Transaction created successfully', {
        transactionId: transaction!.id,
        userId,
        accountId: validatedData.account_id,
        amount: validatedData.amount,
        type: validatedData.type
      });
      
      return transaction!;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create transaction', { error, userId, transactionData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a transfer between accounts
   */
  async createTransfer(userId: string, transferData: TransferData, createdBy?: string): Promise<Transaction> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate input
      const validatedData = transferSchema.parse(transferData);
      
      // Verify source account ownership
      const { rows: fromAccountRows } = await client.query(
        'SELECT id, balance, available_balance, overdraft_limit FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [validatedData.from_account_id, userId]
      );
      
      if (fromAccountRows.length === 0) {
        throw new Error('Source account not found or access denied');
      }
      
      const fromAccount = fromAccountRows[0];
      
      // Check if transfer amount would exceed available balance + overdraft
      const availableWithOverdraft = parseFloat(fromAccount.available_balance) + parseFloat(fromAccount.overdraft_limit);
      if (validatedData.amount > availableWithOverdraft) {
        throw new Error('Insufficient funds');
      }
      
      let toAccount = null;
      
      // If internal transfer, verify destination account
      if (validatedData.to_account_id) {
        const { rows: toAccountRows } = await client.query(
          'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [validatedData.to_account_id, userId]
        );
        
        if (toAccountRows.length === 0) {
          throw new Error('Destination account not found or access denied');
        }
        
        toAccount = toAccountRows[0];
      }
      
      // Generate transfer pair ID for linking transactions
      const { rows: transferPairRows } = await client.query('SELECT uuid_generate_v4() as id');
      const transferPairId = transferPairRows[0].id;
      
      // Create debit transaction (from account)
      const debitDescription = validatedData.description || 
        (toAccount ? `Transfer to account ${validatedData.to_account_id}` : 
         `Transfer to ${validatedData.to_external_account!.account_name}`);
      
      const { rows: debitRows } = await client.query(`
        INSERT INTO transactions (
          account_id, amount, currency, type, status, description,
          transfer_pair_id, transaction_date, pending, created_by
        ) VALUES (
          $1, $2, $3, 'debit', 'completed', $4, $5, $6, FALSE, $7
        ) RETURNING *
      `, [
        validatedData.from_account_id,
        validatedData.amount,
        validatedData.currency,
        debitDescription,
        transferPairId,
        validatedData.scheduled_date || new Date().toISOString(),
        createdBy || userId
      ]);
      
      // Create credit transaction (to account) - only for internal transfers
      if (toAccount) {
        const creditDescription = `Transfer from account ${validatedData.from_account_id}`;
        
        await client.query(`
          INSERT INTO transactions (
            account_id, amount, currency, type, status, description,
            transfer_pair_id, transaction_date, pending, created_by
          ) VALUES (
            $1, $2, $3, 'credit', 'completed', $4, $5, $6, FALSE, $7
          )
        `, [
          validatedData.to_account_id,
          validatedData.amount,
          validatedData.currency,
          creditDescription,
          transferPairId,
          validatedData.scheduled_date || new Date().toISOString(),
          createdBy || userId
        ]);
      }
      
      await client.query('COMMIT');
      
      const transaction = await this.getTransactionById(debitRows[0].id, userId);
      
      logger.info('Transfer created successfully', {
        transactionId: transaction!.id,
        userId,
        fromAccountId: validatedData.from_account_id,
        toAccountId: validatedData.to_account_id,
        amount: validatedData.amount,
        transferPairId
      });
      
      return transaction!;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create transfer', { error, userId, transferData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get transactions with filtering and pagination
   */
  async getTransactions(userId: string, params: Partial<TransactionQueryParams> = {}): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const validatedParams = transactionQuerySchema.parse(params);
      
      let whereConditions = ['a.user_id = $1', 't.deleted_at IS NULL'];
      let queryParams: any[] = [userId];
      let paramIndex = 2;
      
      // Add optional filters
      if (validatedParams.account_id) {
        whereConditions.push(`t.account_id = $${paramIndex}`);
        queryParams.push(validatedParams.account_id);
        paramIndex++;
      }
      
      if (validatedParams.category_id) {
        whereConditions.push(`t.category_id = $${paramIndex}`);
        queryParams.push(validatedParams.category_id);
        paramIndex++;
      }
      
      if (validatedParams.type) {
        whereConditions.push(`t.type = $${paramIndex}`);
        queryParams.push(validatedParams.type);
        paramIndex++;
      }
      
      if (validatedParams.status) {
        whereConditions.push(`t.status = $${paramIndex}`);
        queryParams.push(validatedParams.status);
        paramIndex++;
      }
      
      if (validatedParams.start_date) {
        whereConditions.push(`t.transaction_date >= $${paramIndex}`);
        queryParams.push(validatedParams.start_date);
        paramIndex++;
      }
      
      if (validatedParams.end_date) {
        whereConditions.push(`t.transaction_date <= $${paramIndex}`);
        queryParams.push(validatedParams.end_date);
        paramIndex++;
      }
      
      if (validatedParams.min_amount) {
        whereConditions.push(`t.amount >= $${paramIndex}`);
        queryParams.push(validatedParams.min_amount);
        paramIndex++;
      }
      
      if (validatedParams.max_amount) {
        whereConditions.push(`t.amount <= $${paramIndex}`);
        queryParams.push(validatedParams.max_amount);
        paramIndex++;
      }
      
      if (validatedParams.merchant_name) {
        whereConditions.push(`t.merchant_name ILIKE $${paramIndex}`);
        queryParams.push(`%${validatedParams.merchant_name}%`);
        paramIndex++;
      }
      
      if (validatedParams.tags && validatedParams.tags.length > 0) {
        whereConditions.push(`t.tags && $${paramIndex}`);
        queryParams.push(validatedParams.tags);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        WHERE ${whereClause}
      `;
      const { rows: countRows } = await this.db.query(countQuery, queryParams);
      const total = parseInt(countRows[0].total);
      
      // Get transactions with pagination
      const orderClause = `ORDER BY t.${validatedParams.sort_by} ${validatedParams.sort_order}`;
      
      const transactionsQuery = `
        SELECT t.*, tc.name as category_name, tc.icon as category_icon, tc.color as category_color
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        LEFT JOIN transaction_categories tc ON t.category_id = tc.id
        WHERE ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const { rows } = await this.db.query(transactionsQuery, [
        ...queryParams,
        validatedParams.limit,
        validatedParams.offset
      ]);
      
      const transactions = rows.map(row => this.mapTransactionRow(row));
      
      return { transactions, total };
      
    } catch (error) {
      logger.error('Failed to get transactions', { error, userId, params });
      throw error;
    }
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransactionById(transactionId: string, userId?: string): Promise<Transaction | null> {
    try {
      let query = `
        SELECT t.*, tc.name as category_name, tc.icon as category_icon, tc.color as category_color
        FROM transactions t 
        LEFT JOIN transaction_categories tc ON t.category_id = tc.id
        WHERE t.id = $1 AND t.deleted_at IS NULL
      `;
      let params = [transactionId];
      
      if (userId) {
        query = `
          SELECT t.*, tc.name as category_name, tc.icon as category_icon, tc.color as category_color
          FROM transactions t 
          JOIN accounts a ON t.account_id = a.id 
          LEFT JOIN transaction_categories tc ON t.category_id = tc.id
          WHERE t.id = $1 AND a.user_id = $2 AND t.deleted_at IS NULL
        `;
        params.push(userId);
      }
      
      const { rows } = await this.db.query(query, params);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapTransactionRow(rows[0]);
      
    } catch (error) {
      logger.error('Failed to get transaction by ID', { error, transactionId, userId });
      throw error;
    }
  }

  /**
   * Update transaction category
   */
  async updateTransactionCategory(transactionId: string, categoryId: string, userId: string): Promise<Transaction> {
    try {
      // Verify transaction ownership and category exists
      const { rows: verifyRows } = await this.db.query(`
        SELECT t.id 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        WHERE t.id = $1 AND a.user_id = $2 AND t.deleted_at IS NULL
      `, [transactionId, userId]);
      
      if (verifyRows.length === 0) {
        throw new Error('Transaction not found or access denied');
      }
      
      const { rows: categoryRows } = await this.db.query(
        'SELECT id FROM transaction_categories WHERE id = $1 AND is_active = TRUE',
        [categoryId]
      );
      
      if (categoryRows.length === 0) {
        throw new Error('Invalid category');
      }
      
      // Update transaction
      await this.db.query(
        'UPDATE transactions SET category_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [categoryId, transactionId]
      );
      
      const transaction = await this.getTransactionById(transactionId, userId);
      
      logger.info('Transaction category updated', { transactionId, categoryId, userId });
      
      return transaction!;
      
    } catch (error) {
      logger.error('Failed to update transaction category', { error, transactionId, categoryId, userId });
      throw error;
    }
  }

  /**
   * Get transaction categories
   */
  async getTransactionCategories(): Promise<TransactionCategory[]> {
    try {
      const { rows } = await this.db.query(`
        SELECT id, name, icon, color, parent_category_id
        FROM transaction_categories 
        WHERE is_active = TRUE 
        ORDER BY name
      `);
      
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        parent_category_id: row.parent_category_id
      }));
      
    } catch (error) {
      logger.error('Failed to get transaction categories', { error });
      throw error;
    }
  }

  /**
   * Get monthly spending summary
   */
  async getMonthlySpending(userId: string, year: number, month: number): Promise<{
    month: string;
    total: number;
    categories: Record<string, {
      name: string;
      amount: number;
      percentage: number;
      transactions_count: number;
    }>;
  }> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      const { rows } = await this.db.query(`
        SELECT 
          tc.id as category_id,
          tc.name as category_name,
          SUM(t.amount) as total_amount,
          COUNT(t.id) as transaction_count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN transaction_categories tc ON t.category_id = tc.id
        WHERE a.user_id = $1 
        AND t.type = 'debit'
        AND t.status = 'completed'
        AND t.transaction_date >= $2 
        AND t.transaction_date <= $3
        AND t.deleted_at IS NULL
        GROUP BY tc.id, tc.name
        ORDER BY total_amount DESC
      `, [userId, startDate.toISOString(), endDate.toISOString()]);
      
      const totalSpending = rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
      
      const categories: Record<string, any> = {};
      
      rows.forEach(row => {
        const amount = parseFloat(row.total_amount);
        categories[row.category_id || 'uncategorized'] = {
          name: row.category_name || 'Uncategorized',
          amount,
          percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
          transactions_count: parseInt(row.transaction_count)
        };
      });
      
      return {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        total: totalSpending,
        categories
      };
      
    } catch (error) {
      logger.error('Failed to get monthly spending', { error, userId, year, month });
      throw error;
    }
  }

  /**
   * Map database row to Transaction interface
   */
  private mapTransactionRow(row: any): Transaction {
    return {
      id: row.id,
      account_id: row.account_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.type,
      status: row.status,
      description: row.description,
      merchant_name: row.merchant_name,
      reference_id: row.reference_id,
      external_transaction_id: row.external_transaction_id,
      category_id: row.category_id,
      category: row.category_name ? {
        id: row.category_id,
        name: row.category_name,
        icon: row.category_icon,
        color: row.category_color,
        parent_category_id: row.parent_category_id
      } : undefined,
      tags: row.tags || [],
      balance_after: row.balance_after ? parseFloat(row.balance_after) : undefined,
      fee_amount: parseFloat(row.fee_amount),
      exchange_rate: row.exchange_rate ? parseFloat(row.exchange_rate) : undefined,
      original_amount: row.original_amount ? parseFloat(row.original_amount) : undefined,
      original_currency: row.original_currency,
      location_latitude: row.location_latitude,
      location_longitude: row.location_longitude,
      location_address: row.location_address,
      transaction_date: row.transaction_date,
      posted_date: row.posted_date,
      pending: row.pending,
      transfer_pair_id: row.transfer_pair_id,
      parent_transaction_id: row.parent_transaction_id,
      requires_approval: row.requires_approval,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      transaction_metadata: row.transaction_metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by
    };
  }
}

export default TransactionService;