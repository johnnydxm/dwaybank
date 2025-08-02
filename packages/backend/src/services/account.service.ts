import { Pool } from 'pg';
import { z } from 'zod';
import logger from '../config/logger';

// Type definitions
export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'investment' | 'credit';
  account_name: string;
  institution_name?: string;
  balance: number;
  available_balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  is_primary: boolean;
  is_external: boolean;
  routing_number?: string;
  external_bank_name?: string;
  external_account_id?: string;
  daily_limit?: number;
  monthly_limit?: number;
  overdraft_limit: number;
  requires_additional_auth: boolean;
  risk_level: number;
  interest_rate: number;
  monthly_fee: number;
  overdraft_fee: number;
  account_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Validation schemas
export const createAccountSchema = z.object({
  account_type: z.enum(['checking', 'savings', 'investment', 'credit']),
  account_name: z.string().min(1).max(100),
  institution_name: z.string().max(100).optional(),
  currency: z.string().length(3).default('USD'),
  is_primary: z.boolean().default(false),
  is_external: z.boolean().default(false),
  routing_number: z.string().length(9).optional(),
  external_bank_name: z.string().max(100).optional(),
  external_account_id: z.string().max(100).optional(),
  daily_limit: z.number().positive().optional(),
  monthly_limit: z.number().positive().optional(),
  overdraft_limit: z.number().min(0).default(0),
  requires_additional_auth: z.boolean().default(false),
  interest_rate: z.number().min(0).max(1).default(0),
  monthly_fee: z.number().min(0).default(0),
  overdraft_fee: z.number().min(0).default(0),
  account_metadata: z.record(z.any()).default({})
});

export const updateAccountSchema = createAccountSchema.partial().omit({
  account_type: true, // Account type cannot be changed
  is_external: true   // External flag cannot be changed
});

export const accountQuerySchema = z.object({
  account_type: z.enum(['checking', 'savings', 'investment', 'credit']).optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  is_primary: z.boolean().optional(),
  is_external: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

export type CreateAccountData = z.infer<typeof createAccountSchema>;
export type UpdateAccountData = z.infer<typeof updateAccountSchema>;
export type AccountQueryParams = z.infer<typeof accountQuerySchema>;

export class AccountService {
  constructor(private db: Pool) {}

  /**
   * Create a new account for a user
   */
  async createAccount(userId: string, accountData: CreateAccountData, createdBy?: string): Promise<Account> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate input
      const validatedData = createAccountSchema.parse(accountData);
      
      // Generate account number
      const accountNumber = await this.generateAccountNumber(validatedData.account_type);
      
      // If this is being set as primary, unset other primary accounts
      if (validatedData.is_primary) {
        await client.query(
          'UPDATE accounts SET is_primary = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_primary = TRUE AND deleted_at IS NULL',
          [userId]
        );
      }
      
      // Check if this is the user's first account (auto-set as primary)
      const { rows: existingAccounts } = await client.query(
        'SELECT COUNT(*) as count FROM accounts WHERE user_id = $1 AND deleted_at IS NULL',
        [userId]
      );
      
      const isFirstAccount = parseInt(existingAccounts[0].count) === 0;
      const isPrimary = validatedData.is_primary || isFirstAccount;
      
      // Insert new account
      const { rows } = await client.query(`
        INSERT INTO accounts (
          user_id, account_number, account_type, account_name, institution_name,
          currency, is_primary, is_external, routing_number, external_bank_name,
          external_account_id, daily_limit, monthly_limit, overdraft_limit,
          requires_additional_auth, interest_rate, monthly_fee, overdraft_fee,
          account_metadata, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `, [
        userId,
        accountNumber,
        validatedData.account_type,
        validatedData.account_name,
        validatedData.institution_name,
        validatedData.currency,
        isPrimary,
        validatedData.is_external,
        validatedData.routing_number,
        validatedData.external_bank_name,
        validatedData.external_account_id,
        validatedData.daily_limit,
        validatedData.monthly_limit,
        validatedData.overdraft_limit,
        validatedData.requires_additional_auth,
        validatedData.interest_rate,
        validatedData.monthly_fee,
        validatedData.overdraft_fee,
        JSON.stringify(validatedData.account_metadata),
        createdBy || userId
      ]);
      
      await client.query('COMMIT');
      
      const account = this.mapAccountRow(rows[0]);
      
      logger.info('Account created successfully', {
        accountId: account.id,
        userId,
        accountType: account.account_type,
        isPrimary: account.is_primary
      });
      
      return account;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create account', { error, userId, accountData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all accounts for a user
   */
  async getUserAccounts(userId: string, params: AccountQueryParams = {}): Promise<{ accounts: Account[]; total: number }> {
    try {
      const validatedParams = accountQuerySchema.parse(params);
      
      let whereConditions = ['user_id = $1', 'deleted_at IS NULL'];
      let queryParams: any[] = [userId];
      let paramIndex = 2;
      
      // Add optional filters
      if (validatedParams.account_type) {
        whereConditions.push(`account_type = $${paramIndex}`);
        queryParams.push(validatedParams.account_type);
        paramIndex++;
      }
      
      if (validatedParams.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(validatedParams.status);
        paramIndex++;
      }
      
      if (validatedParams.is_primary !== undefined) {
        whereConditions.push(`is_primary = $${paramIndex}`);
        queryParams.push(validatedParams.is_primary);
        paramIndex++;
      }
      
      if (validatedParams.is_external !== undefined) {
        whereConditions.push(`is_external = $${paramIndex}`);
        queryParams.push(validatedParams.is_external);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM accounts WHERE ${whereClause}`;
      const { rows: countRows } = await this.db.query(countQuery, queryParams);
      const total = parseInt(countRows[0].total);
      
      // Get accounts with pagination
      const accountsQuery = `
        SELECT * FROM accounts 
        WHERE ${whereClause}
        ORDER BY is_primary DESC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const { rows } = await this.db.query(accountsQuery, [
        ...queryParams,
        validatedParams.limit,
        validatedParams.offset
      ]);
      
      const accounts = rows.map(row => this.mapAccountRow(row));
      
      return { accounts, total };
      
    } catch (error) {
      logger.error('Failed to get user accounts', { error, userId, params });
      throw error;
    }
  }

  /**
   * Get a specific account by ID
   */
  async getAccountById(accountId: string, userId?: string): Promise<Account | null> {
    try {
      let query = 'SELECT * FROM accounts WHERE id = $1 AND deleted_at IS NULL';
      let params = [accountId];
      
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId);
      }
      
      const { rows } = await this.db.query(query, params);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.mapAccountRow(rows[0]);
      
    } catch (error) {
      logger.error('Failed to get account by ID', { error, accountId, userId });
      throw error;
    }
  }

  /**
   * Update an account
   */
  async updateAccount(accountId: string, userId: string, updateData: UpdateAccountData, updatedBy?: string): Promise<Account> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate input
      const validatedData = updateAccountSchema.parse(updateData);
      
      // Check if account exists and belongs to user
      const { rows: existingRows } = await client.query(
        'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [accountId, userId]
      );
      
      if (existingRows.length === 0) {
        throw new Error('Account not found or access denied');
      }
      
      // Handle primary account changes
      if (validatedData.is_primary === true) {
        await client.query(
          'UPDATE accounts SET is_primary = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND is_primary = TRUE AND deleted_at IS NULL',
          [userId, accountId]
        );
      }
      
      // Build update query
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;
      
      Object.entries(validatedData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateParams.push(key === 'account_metadata' ? JSON.stringify(value) : value);
          paramIndex++;
        }
      });
      
      if (updateFields.length === 0) {
        return this.mapAccountRow(existingRows[0]);
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`updated_by = $${paramIndex}`);
      updateParams.push(updatedBy || userId);
      paramIndex++;
      
      const updateQuery = `
        UPDATE accounts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `;
      
      const { rows } = await client.query(updateQuery, [...updateParams, accountId, userId]);
      
      await client.query('COMMIT');
      
      const account = this.mapAccountRow(rows[0]);
      
      logger.info('Account updated successfully', {
        accountId,
        userId,
        updatedFields: Object.keys(validatedData)
      });
      
      return account;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update account', { error, accountId, userId, updateData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Soft delete an account
   */
  async deleteAccount(accountId: string, userId: string, deletedBy?: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if account exists and belongs to user
      const { rows: existingRows } = await client.query(
        'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [accountId, userId]
      );
      
      if (existingRows.length === 0) {
        throw new Error('Account not found or access denied');
      }
      
      const account = existingRows[0];
      
      // Check if this is the primary account and user has other accounts
      if (account.is_primary) {
        const { rows: otherAccounts } = await client.query(
          'SELECT id FROM accounts WHERE user_id = $1 AND id != $2 AND deleted_at IS NULL LIMIT 1',
          [userId, accountId]
        );
        
        if (otherAccounts.length > 0) {
          // Set another account as primary
          await client.query(
            'UPDATE accounts SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [otherAccounts[0].id]
          );
        }
      }
      
      // Check if account has a balance
      if (parseFloat(account.balance) !== 0) {
        throw new Error('Cannot delete account with non-zero balance');
      }
      
      // Soft delete the account
      await client.query(
        'UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [deletedBy || userId, accountId]
      );
      
      await client.query('COMMIT');
      
      logger.info('Account deleted successfully', { accountId, userId });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete account', { error, accountId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get account balance information
   */
  async getAccountBalance(accountId: string, userId?: string): Promise<{
    current_balance: number;
    available_balance: number;
    pending_balance: number;
  }> {
    try {
      let query = 'SELECT * FROM get_account_balance($1)';
      let params = [accountId];
      
      // If userId provided, verify ownership
      if (userId) {
        const account = await this.getAccountById(accountId, userId);
        if (!account) {
          throw new Error('Account not found or access denied');
        }
      }
      
      const { rows } = await this.db.query(query, params);
      
      if (rows.length === 0) {
        throw new Error('Account not found');
      }
      
      return {
        current_balance: parseFloat(rows[0].current_balance),
        available_balance: parseFloat(rows[0].available_balance),
        pending_balance: parseFloat(rows[0].pending_balance)
      };
      
    } catch (error) {
      logger.error('Failed to get account balance', { error, accountId, userId });
      throw error;
    }
  }

  /**
   * Set an account as primary
   */
  async setPrimaryAccount(accountId: string, userId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify account exists and belongs to user
      const { rows: accountRows } = await client.query(
        'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [accountId, userId]
      );
      
      if (accountRows.length === 0) {
        throw new Error('Account not found or access denied');
      }
      
      // Unset current primary account
      await client.query(
        'UPDATE accounts SET is_primary = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_primary = TRUE AND deleted_at IS NULL',
        [userId]
      );
      
      // Set new primary account
      await client.query(
        'UPDATE accounts SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [accountId]
      );
      
      await client.query('COMMIT');
      
      logger.info('Primary account updated', { accountId, userId });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to set primary account', { error, accountId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate account number based on account type
   */
  private async generateAccountNumber(accountType: string): Promise<string> {
    try {
      const { rows } = await this.db.query(
        'SELECT generate_account_number($1::account_type) as account_number',
        [accountType]
      );
      
      return rows[0].account_number;
    } catch (error) {
      logger.error('Failed to generate account number', { error, accountType });
      throw error;
    }
  }

  /**
   * Map database row to Account interface
   */
  private mapAccountRow(row: any): Account {
    return {
      id: row.id,
      user_id: row.user_id,
      account_number: row.account_number,
      account_type: row.account_type,
      account_name: row.account_name,
      institution_name: row.institution_name,
      balance: parseFloat(row.balance),
      available_balance: parseFloat(row.available_balance),
      currency: row.currency,
      status: row.status,
      is_primary: row.is_primary,
      is_external: row.is_external,
      routing_number: row.routing_number,
      external_bank_name: row.external_bank_name,
      external_account_id: row.external_account_id,
      daily_limit: row.daily_limit ? parseFloat(row.daily_limit) : undefined,
      monthly_limit: row.monthly_limit ? parseFloat(row.monthly_limit) : undefined,
      overdraft_limit: parseFloat(row.overdraft_limit),
      requires_additional_auth: row.requires_additional_auth,
      risk_level: row.risk_level,
      interest_rate: parseFloat(row.interest_rate),
      monthly_fee: parseFloat(row.monthly_fee),
      overdraft_fee: parseFloat(row.overdraft_fee),
      account_metadata: row.account_metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by
    };
  }
}

export default AccountService;