import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { config } from '../config/environment';
import logger, { auditLogger } from '../config/logger';
import type { 
  User, 
  UserProfile, 
  CreateUserInput, 
  UpdateUserInput, 
  LoginCredentials 
} from '../types';

/**
 * User Service for DwayBank Authentication System
 * Handles user CRUD operations, password management, and security features
 */

export interface UserLookupResult {
  user: User | null;
  isLocked: boolean;
  lockExpiry?: Date;
}

export interface LoginAttemptResult {
  success: boolean;
  user?: UserProfile;
  remainingAttempts?: number;
  lockExpiry?: Date;
  error?: string;
}

export class UserService {
  private readonly bcryptRounds: number;

  constructor() {
    this.bcryptRounds = config.security.bcryptRounds;
  }

  /**
   * Create a new user account
   */
  public async createUser(input: CreateUserInput): Promise<UserProfile> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [input.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(input.password);

      // Insert new user
      const result = await client.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, 
          phone_number, timezone, locale, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING id, email, first_name, last_name, phone_number, 
                  status, email_verified, phone_verified, kyc_status,
                  timezone, locale, created_at
      `, [
        input.email.toLowerCase(),
        passwordHash,
        input.first_name.trim(),
        input.last_name.trim(),
        input.phone_number || null,
        input.timezone || 'UTC',
        input.locale || 'en-US'
      ]);

      await client.query('COMMIT');

      const user = result.rows[0];

      // Log user creation
      auditLogger.info('User account created', {
        userId: user.id,
        email: user.email,
        registrationMethod: 'email',
      });

      return {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        status: user.status,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        kyc_status: user.kyc_status,
        timezone: user.timezone,
        locale: user.locale,
        created_at: user.created_at,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: input.email,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const result = await pool.query(`
        SELECT id, email, first_name, last_name, phone_number, 
               status, email_verified, phone_verified, kyc_status,
               profile_picture, timezone, locale, created_at, last_login
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user by email for authentication
   */
  public async getUserForAuth(email: string): Promise<UserLookupResult> {
    try {
      const result = await pool.query(`
        SELECT id, email, password_hash, first_name, last_name, phone_number,
               status, email_verified, phone_verified, kyc_status,
               failed_login_attempts, locked_until, timezone, locale,
               created_at, last_login
        FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return { user: null, isLocked: false };
      }

      const user = result.rows[0];
      
      // Check if account is locked
      const isLocked = await this.isAccountLocked(user.id);
      const lockExpiry = user.locked_until ? new Date(user.locked_until) : undefined;

      return {
        user,
        isLocked,
        lockExpiry,
      };

    } catch (error) {
      logger.error('Failed to get user for authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
      });
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  public async authenticateUser(
    credentials: LoginCredentials,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginAttemptResult> {
    try {
      const userLookup = await this.getUserForAuth(credentials.email);

      // Check if user exists
      if (!userLookup.user) {
        // Still hash password to prevent timing attacks
        await bcrypt.hash('dummy_password', this.bcryptRounds);
        
        auditLogger.warn('Login attempt for non-existent user', {
          email: credentials.email,
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      const user = userLookup.user;

      // Check if account is locked
      if (userLookup.isLocked) {
        auditLogger.warn('Login attempt on locked account', {
          userId: user.id,
          email: user.email,
          ipAddress,
          lockExpiry: userLookup.lockExpiry,
        });

        return {
          success: false,
          error: 'Account is temporarily locked due to failed login attempts',
          lockExpiry: userLookup.lockExpiry,
        };
      }

      // Check account status
      if (user.status !== 'active' && user.status !== 'pending') {
        auditLogger.warn('Login attempt on inactive account', {
          userId: user.id,
          email: user.email,
          status: user.status,
          ipAddress,
        });

        return {
          success: false,
          error: 'Account is not active',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);

      if (!isPasswordValid) {
        // Handle failed login attempt
        await this.handleFailedLogin(user.email, ipAddress, userAgent);
        
        const updatedUser = await this.getUserForAuth(user.email);
        const remainingAttempts = Math.max(0, 5 - (updatedUser.user?.failed_login_attempts || 0));

        return {
          success: false,
          error: 'Invalid email or password',
          remainingAttempts,
          lockExpiry: updatedUser.lockExpiry,
        };
      }

      // Handle successful login
      await this.handleSuccessfulLogin(user.email, ipAddress, userAgent);

      // Return user profile (excluding sensitive data)
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        status: user.status,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        kyc_status: user.kyc_status,
        profile_picture: user.profile_picture,
        timezone: user.timezone,
        locale: user.locale,
        created_at: user.created_at,
        last_login: new Date(), // Will be updated in handleSuccessfulLogin
      };

      return {
        success: true,
        user: userProfile,
      };

    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: credentials.email,
        ipAddress,
      });

      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Update user profile
   */
  public async updateUser(userId: string, input: UpdateUserInput): Promise<UserProfile | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
      });

      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return await this.getUserById(userId);
      }

      // Add updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add user ID for WHERE clause
      paramCount++;
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING id, email, first_name, last_name, phone_number, 
                  status, email_verified, phone_verified, kyc_status,
                  profile_picture, timezone, locale, created_at, last_login
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');

      auditLogger.info('User profile updated', {
        userId,
        updatedFields: Object.keys(input),
      });

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current password hash
      const result = await client.query(
        'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword, 
        result.rows[0].password_hash
      );

      if (!isCurrentPasswordValid) {
        auditLogger.warn('Invalid current password in password change attempt', {
          userId,
        });
        return false;
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await client.query(`
        UPDATE users 
        SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newPasswordHash, userId]);

      await client.query('COMMIT');

      auditLogger.info('Password changed successfully', {
        userId,
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to change password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify user email
   */
  public async verifyEmail(userId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `, [userId]);

      if (result.rowCount === 0) {
        return false;
      }

      auditLogger.info('Email verified', {
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to verify email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    }
  }

  /**
   * Generate password reset token
   */
  public async generatePasswordResetToken(userId: string): Promise<string> {
    try {
      // Generate a secure random token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await pool.query(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET token = $2, expires_at = $3, created_at = CURRENT_TIMESTAMP
      `, [userId, token, expiresAt]);

      auditLogger.info('Password reset token generated', {
        userId,
        expiresAt,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate password reset token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw new Error('Failed to generate password reset token');
    }
  }

  /**
   * Reset password using token
   */
  public async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify token and get user
      const tokenResult = await client.query(`
        SELECT rt.user_id, rt.expires_at, u.email
        FROM password_reset_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = $1 AND rt.expires_at > CURRENT_TIMESTAMP
          AND u.deleted_at IS NULL
      `, [token]);

      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const { user_id: userId, email } = tokenResult.rows[0];

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await client.query(`
        UPDATE users 
        SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newPasswordHash, userId]);

      // Delete the used token
      await client.query(`
        DELETE FROM password_reset_tokens WHERE token = $1
      `, [token]);

      await client.query('COMMIT');

      auditLogger.info('Password reset successful', {
        userId,
        email,
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to reset password', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate email verification token
   */
  public async generateEmailVerificationToken(userId: string): Promise<string> {
    try {
      // Generate a secure random token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await pool.query(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET token = $2, expires_at = $3, created_at = CURRENT_TIMESTAMP
      `, [userId, token, expiresAt]);

      auditLogger.info('Email verification token generated', {
        userId,
        expiresAt,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate email verification token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw new Error('Failed to generate email verification token');
    }
  }

  /**
   * Verify email using token
   */
  public async verifyEmailWithToken(token: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify token and get user
      const tokenResult = await client.query(`
        SELECT et.user_id, et.expires_at, u.email
        FROM email_verification_tokens et
        JOIN users u ON et.user_id = u.id
        WHERE et.token = $1 AND et.expires_at > CURRENT_TIMESTAMP
          AND u.deleted_at IS NULL
      `, [token]);

      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const { user_id: userId, email } = tokenResult.rows[0];

      // Mark email as verified
      await client.query(`
        UPDATE users 
        SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);

      // Delete the used token
      await client.query(`
        DELETE FROM email_verification_tokens WHERE token = $1
      `, [token]);

      await client.query('COMMIT');

      auditLogger.info('Email verified with token', {
        userId,
        email,
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to verify email with token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify user phone number
   */
  public async verifyPhone(userId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET phone_verified = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `, [userId]);

      if (result.rowCount === 0) {
        return false;
      }

      auditLogger.info('Phone verified', {
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to verify phone', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    }
  }

  /**
   * Soft delete user account
   */
  public async deleteUser(userId: string, deletedBy?: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE users 
        SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `, [userId, deletedBy || userId]);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');

      auditLogger.info('User account deleted', {
        userId,
        deletedBy: deletedBy || userId,
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.bcryptRounds);
    } catch (error) {
      logger.error('Failed to hash password', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Check if account is locked
   */
  private async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT is_account_locked($1) as is_locked',
        [userId]
      );

      return result.rows[0]?.is_locked || false;
    } catch (error) {
      logger.warn('Failed to check account lock status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false; // Fail open for availability
    }
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      await pool.query('SELECT handle_failed_login($1)', [email]);

      auditLogger.warn('Failed login attempt', {
        email,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error('Failed to handle failed login', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        ipAddress,
      });
    }
  }

  /**
   * Handle successful login
   */
  private async handleSuccessfulLogin(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      await pool.query(
        'SELECT handle_successful_login($1, $2, $3)',
        [email, ipAddress, userAgent]
      );

      auditLogger.info('Successful login', {
        email,
        ipAddress,
        userAgent: userAgent.substring(0, 100), // Truncate for logging
      });
    } catch (error) {
      logger.error('Failed to handle successful login', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        ipAddress,
      });
    }
  }

  /**
   * Get user statistics
   */
  public async getUserStats(userId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    lastLogin?: Date;
    accountAge: number;
  } | null> {
    try {
      const result = await pool.query(`
        SELECT 
          u.created_at,
          u.last_login,
          COALESCE(s.total_sessions, 0) as total_sessions,
          COALESCE(s.active_sessions, 0) as active_sessions
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'active' AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_sessions
          FROM user_sessions
          WHERE user_id = $1
          GROUP BY user_id
        ) s ON u.id = s.user_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const accountAge = Math.floor(
        (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        totalSessions: parseInt(row.total_sessions),
        activeSessions: parseInt(row.active_sessions),
        lastLogin: row.last_login ? new Date(row.last_login) : undefined,
        accountAge,
      };
    } catch (error) {
      logger.error('Failed to get user stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return null;
    }
  }
}

// Export singleton instance
export const userService = new UserService();