import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool, redis } from '../config/database';
import logger, { auditLogger } from '../config/logger';
import type { UserSession, SessionInfo, User } from '../types';

/**
 * Session Service for DwayBank Authentication System
 * Handles user session lifecycle, tracking, and security monitoring
 */

export interface CreateSessionOptions {
  rememberMe?: boolean;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'api';
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
}

export interface SessionCreationResult {
  session: UserSession;
  sessionId: string;
  tokenFamily: string;
}

export interface DeviceInfo {
  fingerprint: string;
  type: string;
  browser?: string;
  os?: string;
}

export class SessionService {
  /**
   * Create a new user session
   */
  public async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    options: CreateSessionOptions = {}
  ): Promise<SessionCreationResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Generate session identifiers
      const sessionId = this.generateSessionId();
      const tokenFamily = this.generateTokenFamily();
      const refreshTokenHash = this.hashToken(crypto.randomBytes(32).toString('hex'));

      // Parse device information
      const deviceInfo = this.parseDeviceInfo(userAgent);
      const deviceFingerprint = this.generateDeviceFingerprint(
        ipAddress,
        userAgent,
        options.deviceType || deviceInfo.type
      );

      // Check for suspicious activity
      const isSuspicious = await this.detectSuspiciousActivity(
        userId,
        ipAddress,
        userAgent,
        deviceFingerprint
      );

      // Calculate session expiry
      const expiresAt = this.calculateSessionExpiry(options.rememberMe);

      // Insert session record
      const result = await client.query(`
        INSERT INTO user_sessions (
          user_id, session_id, refresh_token_hash, token_family,
          ip_address, user_agent, device_fingerprint,
          country_code, city, device_type, browser, os,
          expires_at, is_suspicious, login_method, scope
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        userId,
        sessionId,
        refreshTokenHash,
        tokenFamily,
        ipAddress,
        userAgent,
        deviceFingerprint,
        options.country || null,
        options.city || null,
        options.deviceType || deviceInfo.type,
        options.browser || deviceInfo.browser,
        options.os || deviceInfo.os,
        expiresAt,
        isSuspicious,
        'password', // Default login method
        ['read', 'write'] // Default scope
      ]);

      await client.query('COMMIT');

      const session = result.rows[0];

      // Store session in Redis for fast lookup
      await this.cacheSession(sessionId, session);

      // Log session creation
      auditLogger.info('User session created', {
        userId,
        sessionId,
        ipAddress,
        deviceType: session.device_type,
        isSuspicious,
        expiresAt: session.expires_at,
      });

      return {
        session,
        sessionId,
        tokenFamily,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        ipAddress,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get session by session ID
   */
  public async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      // Try Redis cache first
      const cached = await this.getCachedSession(sessionId);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const result = await pool.query(`
        SELECT * FROM user_sessions 
        WHERE session_id = $1 AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
      `, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows[0];

      // Cache for future requests
      await this.cacheSession(sessionId, session);

      return session;
    } catch (error) {
      logger.error('Failed to get session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return null;
    }
  }

  /**
   * Update session activity
   */
  public async updateSessionActivity(
    sessionId: string,
    accessTokenJti?: string
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT update_session_activity($1, $2) as updated',
        [sessionId, accessTokenJti]
      );

      if (result.rows[0]?.updated) {
        // Update Redis cache
        await this.invalidateSessionCache(sessionId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to update session activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Revoke session
   */
  public async revokeSession(
    sessionId: string,
    reason: string = 'user_logout'
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE user_sessions 
        SET 
          status = 'revoked',
          revoked_at = CURRENT_TIMESTAMP,
          revoked_reason = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND status = 'active'
        RETURNING user_id
      `, [sessionId, reason]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');

      // Remove from Redis cache
      await this.invalidateSessionCache(sessionId);

      auditLogger.info('Session revoked', {
        sessionId,
        reason,
        userId: result.rows[0].user_id,
      });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to revoke session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke all user sessions except current
   */
  public async revokeUserSessions(
    userId: string,
    excludeSessionId?: string,
    reason: string = 'user_logout_all'
  ): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT revoke_user_sessions($1, $2, $3) as revoked_count',
        [userId, excludeSessionId, reason]
      );

      const revokedCount = result.rows[0]?.revoked_count || 0;

      if (revokedCount > 0) {
        // Clear Redis cache for user sessions
        await this.clearUserSessionCache(userId);

        auditLogger.info('Multiple sessions revoked', {
          userId,
          revokedCount,
          excludeSessionId,
          reason,
        });
      }

      return revokedCount;
    } catch (error) {
      logger.error('Failed to revoke user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return 0;
    }
  }

  /**
   * Get user's active sessions
   */
  public async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const result = await pool.query(`
        SELECT 
          id, session_id, ip_address, user_agent, device_type, browser, os,
          country_code, city, created_at, last_used, expires_at, is_suspicious
        FROM user_sessions 
        WHERE user_id = $1 AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_used DESC
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at,
        last_used: row.last_used,
        is_current: false, // Will be determined by caller
        location: this.formatLocation(row.country_code, row.city),
        device: this.formatDevice(row.device_type, row.browser, row.os),
      }));
    } catch (error) {
      logger.error('Failed to get user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  /**
   * Cleanup expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await pool.query('SELECT cleanup_expired_sessions() as cleaned_count');
      const cleanedCount = result.rows[0]?.cleaned_count || 0;

      if (cleanedCount > 0) {
        logger.info('Expired sessions cleaned up', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Detect suspicious session activity
   */
  private async detectSuspiciousActivity(
    userId: string,
    ipAddress: string,
    userAgent: string,
    deviceFingerprint: string
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT detect_suspicious_session($1, $2, $3, $4) as is_suspicious',
        [userId, ipAddress, userAgent, deviceFingerprint]
      );

      return result.rows[0]?.is_suspicious || false;
    } catch (error) {
      logger.warn('Failed to detect suspicious activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        ipAddress,
      });
      return false; // Fail open
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Generate token family for refresh token rotation
   */
  private generateTokenFamily(): string {
    return `fam_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(
    ipAddress: string,
    userAgent: string,
    deviceType: string
  ): string {
    const data = `${ipAddress}:${userAgent}:${deviceType}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Parse device information from user agent
   */
  private parseDeviceInfo(userAgent: string): DeviceInfo {
    const ua = userAgent.toLowerCase();
    
    // Device type detection
    let type = 'desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      type = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      type = 'tablet';
    }

    // Browser detection
    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('edge')) browser = 'edge';
    else if (ua.includes('opera')) browser = 'opera';

    // OS detection
    let os = 'unknown';
    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('macos') || ua.includes('mac os')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('ios')) os = 'ios';

    return {
      fingerprint: this.generateDeviceFingerprint('', userAgent, type),
      type,
      browser,
      os,
    };
  }

  /**
   * Calculate session expiry based on remember me option
   */
  private calculateSessionExpiry(rememberMe: boolean = false): Date {
    const now = new Date();
    
    if (rememberMe) {
      // 30 days for remember me sessions
      now.setDate(now.getDate() + 30);
    } else {
      // 7 days for regular sessions
      now.setDate(now.getDate() + 7);
    }

    return now;
  }

  /**
   * Cache session in Redis
   */
  private async cacheSession(sessionId: string, session: UserSession): Promise<void> {
    try {
      const cacheKey = `session:${sessionId}`;
      const cacheValue = JSON.stringify({
        ...session,
        cached_at: new Date().toISOString(),
      });

      // Cache for 1 hour
      await redis.setEx(cacheKey, 3600, cacheValue);
    } catch (error) {
      logger.warn('Failed to cache session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
    }
  }

  /**
   * Get cached session from Redis
   */
  private async getCachedSession(sessionId: string): Promise<UserSession | null> {
    try {
      const cacheKey = `session:${sessionId}`;
      const cached = await redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      const session = JSON.parse(cached);
      delete session.cached_at; // Remove cache metadata

      return session;
    } catch (error) {
      logger.warn('Failed to get cached session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return null;
    }
  }

  /**
   * Invalidate session cache
   */
  private async invalidateSessionCache(sessionId: string): Promise<void> {
    try {
      const cacheKey = `session:${sessionId}`;
      await redis.del(cacheKey);
    } catch (error) {
      logger.warn('Failed to invalidate session cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
    }
  }

  /**
   * Clear all cached sessions for a user
   */
  private async clearUserSessionCache(userId: string): Promise<void> {
    try {
      const pattern = `session:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Failed to clear user session cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    }
  }

  /**
   * Format location string
   */
  private formatLocation(countryCode?: string, city?: string): string {
    if (!countryCode && !city) return 'Unknown';
    if (city && countryCode) return `${city}, ${countryCode.toUpperCase()}`;
    if (countryCode) return countryCode.toUpperCase();
    if (city) return city;
    return 'Unknown';
  }

  /**
   * Format device string
   */
  private formatDevice(deviceType?: string, browser?: string, os?: string): string {
    const parts: string[] = [];
    
    if (browser && browser !== 'unknown') {
      parts.push(browser.charAt(0).toUpperCase() + browser.slice(1));
    }
    
    if (os && os !== 'unknown') {
      parts.push(os.charAt(0).toUpperCase() + os.slice(1));
    }
    
    if (deviceType && deviceType !== 'desktop') {
      parts.push(deviceType.charAt(0).toUpperCase() + deviceType.slice(1));
    }

    return parts.length > 0 ? parts.join(' • ') : 'Unknown Device';
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    suspiciousCount: number;
    topDeviceTypes: Array<{ type: string; count: number }>;
  }> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(CASE WHEN status = 'active' AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as total_active,
          COUNT(CASE WHEN status = 'expired' OR expires_at <= CURRENT_TIMESTAMP THEN 1 END) as total_expired,
          COUNT(CASE WHEN is_suspicious = TRUE THEN 1 END) as suspicious_count,
          ARRAY_AGG(DISTINCT device_type) as device_types
        FROM user_sessions
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
      `);

      const stats = result.rows[0];

      // Get device type distribution
      const deviceResult = await pool.query(`
        SELECT device_type, COUNT(*) as count
        FROM user_sessions
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY device_type
        ORDER BY count DESC
        LIMIT 5
      `);

      return {
        totalActive: parseInt(stats.total_active) || 0,
        totalExpired: parseInt(stats.total_expired) || 0,
        suspiciousCount: parseInt(stats.suspicious_count) || 0,
        topDeviceTypes: deviceResult.rows.map(row => ({
          type: row.device_type,
          count: parseInt(row.count),
        })),
      };
    } catch (error) {
      logger.error('Failed to get session statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalActive: 0,
        totalExpired: 0,
        suspiciousCount: 0,
        topDeviceTypes: [],
      };
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService();