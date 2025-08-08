/**
 * User Profile Service for DwayBank
 * Handles user profile management, preferences, and device management
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import crypto from 'crypto';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';

/**
 * User Profile Interfaces
 */
export interface UserProfile {
  id?: string;
  user_id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  display_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone_number?: string;
  phone_verified?: boolean;
  phone_verified_at?: Date;
  secondary_email?: string;
  secondary_email_verified?: boolean;
  secondary_email_verified_at?: Date;
  street_address?: string;
  street_address_2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country_code?: string;
  occupation?: string;
  employer?: string;
  annual_income_range?: string;
  profile_picture_url?: string;
  bio?: string;
  completion_status?: 'incomplete' | 'basic_complete' | 'full_complete' | 'verified';
  completion_percentage?: number;
  profile_visibility?: string;
  allow_search?: boolean;
  show_online_status?: boolean;
  data_retention_consent?: boolean;
  marketing_consent?: boolean;
  analytics_consent?: boolean;
  created_at?: Date;
  updated_at?: Date;
  last_profile_update?: Date;
  profile_views?: number;
}

export interface UserPreferences {
  id?: string;
  user_id: string;
  language?: string;
  country_code?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  primary_currency?: string;
  secondary_currency?: string;
  decimal_places?: number;
  thousand_separator?: string;
  decimal_separator?: string;
  currency_symbol_position?: string;
  theme?: 'light' | 'dark' | 'system';
  font_size?: string;
  high_contrast?: boolean;
  reduce_animations?: boolean;
  compact_view?: boolean;
  dashboard_layout?: any;
  default_account_view?: string;
  transaction_grouping?: string;
  chart_type?: string;
  session_timeout_minutes?: number;
  require_mfa_for_sensitive?: boolean;
  logout_on_browser_close?: boolean;
  remember_device_days?: number;
  data_sharing_analytics?: boolean;
  data_sharing_marketing?: boolean;
  data_sharing_partners?: boolean;
  activity_tracking?: boolean;
  personalized_ads?: boolean;
  contact_method_preference?: string;
  auto_backup?: boolean;
  sync_across_devices?: boolean;
  offline_access?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface NotificationPreference {
  id?: string;
  user_id: string;
  notification_type: 'email' | 'sms' | 'push' | 'in_app';
  category: string;
  enabled: boolean;
  delivery_method?: any;
  quiet_hours?: any;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserDevice {
  id?: string;
  user_id: string;
  device_id: string;
  device_name?: string;
  device_type?: string;
  platform?: string;
  browser?: string;
  user_agent?: string;
  ip_address?: string;
  is_trusted?: boolean;
  is_active?: boolean;
  push_token?: string;
  last_seen_at?: Date;
  location_info?: any;
  created_at?: Date;
  updated_at?: Date;
}

export interface ProfileUpdateRequest {
  user_id: string;
  profile_data: Partial<UserProfile>;
  changed_by?: string;
  change_reason?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface ProfileSearchFilters {
  country_code?: string;
  completion_status?: string;
  date_range?: { start: Date; end: Date };
  page?: number;
  limit?: number;
}

export class UserProfileService {
  private db: Pool;
  private encryptionKey: Buffer;

  constructor(database: Pool) {
    this.db = database;
    this.encryptionKey = Buffer.from(config.security.encryptionKey, 'hex');
    
    logger.info('UserProfile Service initialized');
  }

  /**
   * Create user profile
   */
  async createProfile(profileData: UserProfile): Promise<UserProfile> {
    const profileId = uuidv4();
    
    logger.info('Creating user profile', { 
      userId: profileData.user_id, 
      profileId 
    });

    try {
      const result = await this.db.query(`
        INSERT INTO user_profiles (
          id, user_id, first_name, middle_name, last_name, display_name,
          date_of_birth, gender, phone_number, secondary_email,
          street_address, street_address_2, city, state_province, 
          postal_code, country_code, occupation, employer, 
          annual_income_range, profile_picture_url, bio,
          profile_visibility, allow_search, show_online_status,
          data_retention_consent, marketing_consent, analytics_consent
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )
        RETURNING *
      `, [
        profileId,
        profileData.user_id,
        profileData.first_name,
        profileData.middle_name,
        profileData.last_name,
        profileData.display_name,
        profileData.date_of_birth,
        profileData.gender,
        profileData.phone_number,
        profileData.secondary_email,
        profileData.street_address,
        profileData.street_address_2,
        profileData.city,
        profileData.state_province,
        profileData.postal_code,
        profileData.country_code,
        profileData.occupation,
        profileData.employer,
        profileData.annual_income_range,
        profileData.profile_picture_url,
        profileData.bio,
        profileData.profile_visibility || 'private',
        profileData.allow_search || false,
        profileData.show_online_status !== false,
        profileData.data_retention_consent !== false,
        profileData.marketing_consent || false,
        profileData.analytics_consent !== false,
      ]);

      auditLogger.info('User profile created', {
        userId: profileData.user_id,
        profileId,
        hasPersonalInfo: !!(profileData.first_name && profileData.last_name),
        hasAddress: !!profileData.street_address,
        hasProfessionalInfo: !!profileData.occupation,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Profile creation failed', { error, userId: profileData.user_id });
      throw error;
    }
  }

  /**
   * Get user profile by user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM user_profiles WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      // Increment profile views (async, non-blocking)
      this.incrementProfileViews(userId).catch(error => 
        logger.warn('Failed to increment profile views', { error, userId })
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Profile retrieval failed', { error, userId });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updateRequest: ProfileUpdateRequest): Promise<UserProfile> {
    const { user_id, profile_data, changed_by, change_reason, ip_address, user_agent } = updateRequest;
    
    logger.info('Updating user profile', { 
      userId: user_id, 
      fieldsUpdated: Object.keys(profile_data).length 
    });

    try {
      // Build dynamic UPDATE query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(profile_data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'user_id' && key !== 'created_at' && value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Add user_id to WHERE clause
      values.push(user_id);
      const userIdParam = paramIndex;

      const updateQuery = `
        UPDATE user_profiles 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${userIdParam}
        RETURNING *
      `;

      const result = await this.db.query(updateQuery, values);

      if (result.rows.length === 0) {
        throw new Error('Profile not found or update failed');
      }

      auditLogger.info('User profile updated', {
        userId: user_id,
        fieldsUpdated: Object.keys(profile_data),
        changedBy: changed_by,
        changeReason: change_reason,
        ipAddress: ip_address,
        completionPercentage: result.rows[0].completion_percentage,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Profile update failed', { error, userId: user_id });
      throw error;
    }
  }

  /**
   * Create or update user preferences
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    logger.info('Updating user preferences', { userId, preferencesCount: Object.keys(preferences).length });

    try {
      // Check if preferences exist
      const existingResult = await this.db.query(`
        SELECT id FROM user_preferences WHERE user_id = $1
      `, [userId]);

      if (existingResult.rows.length === 0) {
        // Create new preferences
        return await this.createPreferences(userId, preferences);
      } else {
        // Update existing preferences
        return await this.updateExistingPreferences(userId, preferences);
      }
    } catch (error) {
      logger.error('Preferences update failed', { error, userId });
      throw error;
    }
  }

  /**
   * Create new user preferences
   */
  private async createPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const preferencesId = uuidv4();
    
    const result = await this.db.query(`
      INSERT INTO user_preferences (
        id, user_id, language, country_code, timezone, date_format, time_format,
        primary_currency, secondary_currency, decimal_places, thousand_separator,
        decimal_separator, currency_symbol_position, theme, font_size,
        high_contrast, reduce_animations, compact_view, dashboard_layout,
        default_account_view, transaction_grouping, chart_type,
        session_timeout_minutes, require_mfa_for_sensitive, logout_on_browser_close,
        remember_device_days, data_sharing_analytics, data_sharing_marketing,
        data_sharing_partners, activity_tracking, personalized_ads,
        contact_method_preference, auto_backup, sync_across_devices, offline_access
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35
      )
      RETURNING *
    `, [
      preferencesId,
      userId,
      preferences.language || 'en',
      preferences.country_code,
      preferences.timezone || 'UTC',
      preferences.date_format || 'MM/DD/YYYY',
      preferences.time_format || '12h',
      preferences.primary_currency || 'USD',
      preferences.secondary_currency,
      preferences.decimal_places ?? 2,
      preferences.thousand_separator || ',',
      preferences.decimal_separator || '.',
      preferences.currency_symbol_position || 'before',
      preferences.theme || 'system',
      preferences.font_size || 'medium',
      preferences.high_contrast || false,
      preferences.reduce_animations || false,
      preferences.compact_view || false,
      preferences.dashboard_layout || { widgets: ['balance', 'recent_transactions', 'budget_summary'], columns: 2 },
      preferences.default_account_view || 'all_accounts',
      preferences.transaction_grouping || 'date',
      preferences.chart_type || 'line',
      preferences.session_timeout_minutes ?? 30,
      preferences.require_mfa_for_sensitive !== false,
      preferences.logout_on_browser_close || false,
      preferences.remember_device_days ?? 30,
      preferences.data_sharing_analytics !== false,
      preferences.data_sharing_marketing || false,
      preferences.data_sharing_partners || false,
      preferences.activity_tracking !== false,
      preferences.personalized_ads || false,
      preferences.contact_method_preference || 'email',
      preferences.auto_backup !== false,
      preferences.sync_across_devices !== false,
      preferences.offline_access !== false,
    ]);

    auditLogger.info('User preferences created', {
      userId,
      preferencesId,
      language: preferences.language,
      currency: preferences.primary_currency,
      theme: preferences.theme,
    });

    return result.rows[0];
  }

  /**
   * Update existing user preferences
   */
  private async updateExistingPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(preferences).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at' && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      // Return existing preferences if no updates
      const result = await this.db.query(`
        SELECT * FROM user_preferences WHERE user_id = $1
      `, [userId]);
      return result.rows[0];
    }

    // Add user_id to WHERE clause
    values.push(userId);
    const userIdParam = paramIndex;

    const updateQuery = `
      UPDATE user_preferences 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${userIdParam}
      RETURNING *
    `;

    const result = await this.db.query(updateQuery, values);

    auditLogger.info('User preferences updated', {
      userId,
      fieldsUpdated: Object.keys(preferences),
      updatedPreferences: Object.keys(preferences).length,
    });

    return result.rows[0];
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM user_preferences WHERE user_id = $1
      `, [userId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Preferences retrieval failed', { error, userId });
      throw error;
    }
  }

  /**
   * Manage notification preferences
   */
  async updateNotificationPreferences(
    userId: string, 
    preferences: NotificationPreference[]
  ): Promise<NotificationPreference[]> {
    logger.info('Updating notification preferences', { 
      userId, 
      preferencesCount: preferences.length 
    });

    try {
      // Delete existing preferences for this user
      await this.db.query(`
        DELETE FROM notification_preferences WHERE user_id = $1
      `, [userId]);

      // Insert new preferences
      const insertedPreferences: NotificationPreference[] = [];

      for (const pref of preferences) {
        const result = await this.db.query(`
          INSERT INTO notification_preferences (
            id, user_id, notification_type, category, enabled, 
            delivery_method, quiet_hours
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          uuidv4(),
          userId,
          pref.notification_type,
          pref.category,
          pref.enabled,
          pref.delivery_method || { immediate: true, digest: false, frequency: 'immediate' },
          pref.quiet_hours,
        ]);

        insertedPreferences.push(result.rows[0]);
      }

      auditLogger.info('Notification preferences updated', {
        userId,
        totalPreferences: insertedPreferences.length,
        enabledCount: insertedPreferences.filter(p => p.enabled).length,
      });

      return insertedPreferences;
    } catch (error) {
      logger.error('Notification preferences update failed', { error, userId });
      throw error;
    }
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM notification_preferences 
        WHERE user_id = $1 
        ORDER BY notification_type, category
      `, [userId]);

      return result.rows;
    } catch (error) {
      logger.error('Notification preferences retrieval failed', { error, userId });
      throw error;
    }
  }

  /**
   * Register or update user device
   */
  async registerDevice(deviceData: UserDevice): Promise<UserDevice> {
    logger.info('Registering user device', { 
      userId: deviceData.user_id, 
      deviceType: deviceData.device_type,
      platform: deviceData.platform 
    });

    try {
      // Check if device already exists
      const existingResult = await this.db.query(`
        SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2
      `, [deviceData.user_id, deviceData.device_id]);

      if (existingResult.rows.length > 0) {
        // Update existing device
        const result = await this.db.query(`
          UPDATE user_devices SET
            device_name = $3,
            device_type = $4,
            platform = $5,
            browser = $6,
            user_agent = $7,
            ip_address = $8,
            is_active = $9,
            push_token = $10,
            location_info = $11,
            last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND device_id = $2
          RETURNING *
        `, [
          deviceData.user_id,
          deviceData.device_id,
          deviceData.device_name,
          deviceData.device_type,
          deviceData.platform,
          deviceData.browser,
          deviceData.user_agent,
          deviceData.ip_address,
          deviceData.is_active !== false,
          deviceData.push_token,
          deviceData.location_info,
        ]);

        return result.rows[0];
      } else {
        // Insert new device
        const result = await this.db.query(`
          INSERT INTO user_devices (
            id, user_id, device_id, device_name, device_type, platform,
            browser, user_agent, ip_address, is_trusted, is_active,
            push_token, location_info
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          uuidv4(),
          deviceData.user_id,
          deviceData.device_id,
          deviceData.device_name,
          deviceData.device_type,
          deviceData.platform,
          deviceData.browser,
          deviceData.user_agent,
          deviceData.ip_address,
          deviceData.is_trusted || false,
          deviceData.is_active !== false,
          deviceData.push_token,
          deviceData.location_info,
        ]);

        auditLogger.info('New device registered', {
          userId: deviceData.user_id,
          deviceId: deviceData.device_id,
          deviceType: deviceData.device_type,
          platform: deviceData.platform,
          ipAddress: deviceData.ip_address,
        });

        return result.rows[0];
      }
    } catch (error) {
      logger.error('Device registration failed', { error, userId: deviceData.user_id });
      throw error;
    }
  }

  /**
   * Get user devices
   */
  async getUserDevices(userId: string, activeOnly: boolean = false): Promise<UserDevice[]> {
    try {
      const query = activeOnly 
        ? `SELECT * FROM user_devices WHERE user_id = $1 AND is_active = true ORDER BY last_seen_at DESC`
        : `SELECT * FROM user_devices WHERE user_id = $1 ORDER BY last_seen_at DESC`;

      const result = await this.db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('User devices retrieval failed', { error, userId });
      throw error;
    }
  }

  /**
   * Trust/untrust a device
   */
  async updateDeviceTrustStatus(userId: string, deviceId: string, isTrusted: boolean): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE user_devices 
        SET is_trusted = $3, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND device_id = $2
        RETURNING id
      `, [userId, deviceId, isTrusted]);

      if (result.rows.length > 0) {
        auditLogger.info('Device trust status updated', {
          userId,
          deviceId,
          isTrusted,
        });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Device trust update failed', { error, userId, deviceId });
      throw error;
    }
  }

  /**
   * Remove user device
   */
  async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        DELETE FROM user_devices 
        WHERE user_id = $1 AND device_id = $2
        RETURNING id
      `, [userId, deviceId]);

      if (result.rows.length > 0) {
        auditLogger.info('Device removed', { userId, deviceId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Device removal failed', { error, userId, deviceId });
      throw error;
    }
  }

  /**
   * Get profile history
   */
  async getProfileHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          ph.*,
          u.email as changed_by_email
        FROM user_profile_history ph
        LEFT JOIN users u ON ph.changed_by = u.id
        WHERE ph.user_id = $1
        ORDER BY ph.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      logger.error('Profile history retrieval failed', { error, userId });
      throw error;
    }
  }

  /**
   * Search profiles (admin function)
   */
  async searchProfiles(filters: ProfileSearchFilters): Promise<{ profiles: UserProfile[]; total: number }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.country_code) {
        paramCount++;
        whereClause += ` AND country_code = $${paramCount}`;
        params.push(filters.country_code);
      }

      if (filters.completion_status) {
        paramCount++;
        whereClause += ` AND completion_status = $${paramCount}`;
        params.push(filters.completion_status);
      }

      if (filters.date_range) {
        paramCount++;
        whereClause += ` AND created_at >= $${paramCount}`;
        params.push(filters.date_range.start);
        paramCount++;
        whereClause += ` AND created_at <= $${paramCount}`;
        params.push(filters.date_range.end);
      }

      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*) as total FROM user_profiles ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;

      paramCount++;
      const limitParam = paramCount;
      paramCount++;
      const offsetParam = paramCount;

      const result = await this.db.query(`
        SELECT 
          up.*,
          u.email as user_email
        FROM user_profiles up
        LEFT JOIN users u ON up.user_id = u.id
        ${whereClause}
        ORDER BY up.updated_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, [...params, limit, offset]);

      return {
        profiles: result.rows,
        total,
      };
    } catch (error) {
      logger.error('Profile search failed', { error, filters });
      throw error;
    }
  }

  /**
   * Get profile statistics (admin function)
   */
  async getProfileStatistics(): Promise<any> {
    try {
      const results = await Promise.all([
        // Total profiles by completion status
        this.db.query(`
          SELECT completion_status, COUNT(*) as count 
          FROM user_profiles 
          GROUP BY completion_status
        `),
        // Profiles by country
        this.db.query(`
          SELECT country_code, COUNT(*) as count 
          FROM user_profiles 
          WHERE country_code IS NOT NULL
          GROUP BY country_code 
          ORDER BY count DESC 
          LIMIT 10
        `),
        // Average completion percentage
        this.db.query(`
          SELECT AVG(completion_percentage) as avg_completion
          FROM user_profiles
        `),
        // Recent profile activity (last 30 days)
        this.db.query(`
          SELECT DATE(created_at) as date, COUNT(*) as profiles_created
          FROM user_profiles 
          WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `),
        // Device statistics
        this.db.query(`
          SELECT 
            platform,
            COUNT(*) as count,
            COUNT(CASE WHEN is_active THEN 1 END) as active_count,
            COUNT(CASE WHEN is_trusted THEN 1 END) as trusted_count
          FROM user_devices
          GROUP BY platform
          ORDER BY count DESC
        `),
      ]);

      return {
        completionStatus: results[0].rows.reduce((acc, row) => {
          acc[row.completion_status] = parseInt(row.count);
          return acc;
        }, {}),
        topCountries: results[1].rows.map(row => ({
          country: row.country_code,
          count: parseInt(row.count),
        })),
        averageCompletion: parseFloat(results[2].rows[0]?.avg_completion || '0'),
        recentActivity: results[3].rows.map(row => ({
          date: row.date,
          profilesCreated: parseInt(row.profiles_created),
        })),
        deviceStatistics: results[4].rows.map(row => ({
          platform: row.platform,
          totalDevices: parseInt(row.count),
          activeDevices: parseInt(row.active_count),
          trustedDevices: parseInt(row.trusted_count),
        })),
      };
    } catch (error) {
      logger.error('Profile statistics retrieval failed', { error });
      throw error;
    }
  }

  /**
   * Delete user profile (GDPR compliance)
   */
  async deleteProfile(userId: string, reason: string = 'user_request'): Promise<boolean> {
    logger.info('Deleting user profile', { userId, reason });

    try {
      // Start transaction
      await this.db.query('BEGIN');

      // Delete related data first (due to foreign key constraints)
      await this.db.query(`DELETE FROM user_devices WHERE user_id = $1`, [userId]);
      await this.db.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
      await this.db.query(`DELETE FROM user_profile_history WHERE user_id = $1`, [userId]);
      await this.db.query(`DELETE FROM user_preferences WHERE user_id = $1`, [userId]);
      
      // Delete main profile
      const result = await this.db.query(`
        DELETE FROM user_profiles WHERE user_id = $1 RETURNING id
      `, [userId]);

      await this.db.query('COMMIT');

      if (result.rows.length > 0) {
        auditLogger.info('User profile deleted', {
          userId,
          reason,
          deletedProfileId: result.rows[0].id,
        });
        return true;
      }
      return false;
    } catch (error) {
      await this.db.query('ROLLBACK');
      logger.error('Profile deletion failed', { error, userId });
      throw error;
    }
  }

  /**
   * Increment profile views (internal method)
   */
  private async incrementProfileViews(userId: string): Promise<void> {
    await this.db.query(`
      UPDATE user_profiles 
      SET profile_views = profile_views + 1 
      WHERE user_id = $1
    `, [userId]);
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService(
  // This will be injected by the server initialization
  {} as Pool
);

// Export function to set the database instance
export const setUserProfileService = (instance: UserProfileService) => {
  Object.assign(userProfileService, instance);
};

// Export initialization function
export const initializeUserProfileService = async (database: Pool): Promise<UserProfileService> => {
  return new UserProfileService(database);
};