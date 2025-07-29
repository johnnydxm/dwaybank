import { redis } from '../config/database';
import { config } from '../config/environment';
import logger from '../config/logger';
import crypto from 'crypto';

/**
 * Redis Session Store for DwayBank
 * High-performance session storage with TTL management and security features
 */

export interface SessionData {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  lastAccess: string;
  createdAt: string;
  expiresAt: string;
  scope: string[];
  mfaVerified: boolean;
  isSuspicious: boolean;
}

export interface SessionStoreOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  encryptData?: boolean;
}

export class RedisSessionService {
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(options: SessionStoreOptions = {}) {
    this.keyPrefix = options.keyPrefix || 'dwaybank:session:';
    this.defaultTTL = options.ttl || 604800; // 7 days default
    
    // Initialize encryption key from config
    this.encryptionKey = Buffer.from(config.security.encryptionKey, 'hex');
    
    logger.info('Redis session service initialized', {
      keyPrefix: this.keyPrefix,
      defaultTTL: this.defaultTTL,
      encryptionEnabled: true,
    });
  }

  /**
   * Store session data in Redis
   */
  public async setSession(
    sessionId: string, 
    data: SessionData, 
    ttl?: number
  ): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      const sessionTTL = ttl || this.defaultTTL;
      
      // Encrypt sensitive session data
      const encryptedData = this.encryptSessionData(data);
      
      // Store with expiration
      await redis.setEx(key, sessionTTL, encryptedData);
      
      // Store session index for user (for multiple session management)
      await this.addToUserSessionIndex(data.userId, sessionId, sessionTTL);
      
      // Store session metadata for analytics
      await this.storeSessionMetadata(sessionId, data, sessionTTL);
      
      logger.debug('Session stored in Redis', {
        sessionId,
        userId: data.userId,
        ttl: sessionTTL,
        keySize: encryptedData.length,
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store session in Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId: data.userId,
      });
      return false;
    }
  }

  /**
   * Retrieve session data from Redis
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = this.getSessionKey(sessionId);
      const encryptedData = await redis.get(key);
      
      if (!encryptedData) {
        return null;
      }
      
      // Decrypt and parse session data
      const sessionData = this.decryptSessionData(encryptedData);
      
      // Check if session has expired
      if (this.isSessionExpired(sessionData)) {
        await this.deleteSession(sessionId);
        return null;
      }
      
      // Update last access time
      sessionData.lastAccess = new Date().toISOString();
      await this.setSession(sessionId, sessionData);
      
      logger.debug('Session retrieved from Redis', {
        sessionId,
        userId: sessionData.userId,
        lastAccess: sessionData.lastAccess,
      });
      
      return sessionData;
    } catch (error) {
      logger.error('Failed to retrieve session from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return null;
    }
  }

  /**
   * Update session data
   */
  public async updateSession(
    sessionId: string, 
    updates: Partial<SessionData>
  ): Promise<boolean> {
    try {
      const existingData = await this.getSession(sessionId);
      if (!existingData) {
        return false;
      }
      
      const updatedData = {
        ...existingData,
        ...updates,
        lastAccess: new Date().toISOString(),
      };
      
      return await this.setSession(sessionId, updatedData);
    } catch (error) {
      logger.error('Failed to update session in Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Delete session from Redis
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      
      // Get session data before deletion for cleanup
      const sessionData = await this.getSession(sessionId);
      
      // Delete main session
      const deleted = await redis.del(key);
      
      if (sessionData) {
        // Remove from user session index
        await this.removeFromUserSessionIndex(sessionData.userId, sessionId);
        
        // Delete session metadata
        await this.deleteSessionMetadata(sessionId);
      }
      
      logger.debug('Session deleted from Redis', {
        sessionId,
        userId: sessionData?.userId,
        deleted: deleted > 0,
      });
      
      return deleted > 0;
    } catch (error) {
      logger.error('Failed to delete session from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const indexKey = this.getUserSessionIndexKey(userId);
      const sessionIds = await redis.smembers(indexKey);
      
      if (sessionIds.length === 0) {
        return [];
      }
      
      const sessions: SessionData[] = [];
      
      // Retrieve each session
      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }
      
      // Sort by last access (most recent first)
      sessions.sort((a, b) => 
        new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime()
      );
      
      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  /**
   * Delete all sessions for a user
   */
  public async deleteUserSessions(
    userId: string, 
    excludeSessionId?: string
  ): Promise<number> {
    try {
      const sessionIds = await redis.smembers(this.getUserSessionIndexKey(userId));
      let deletedCount = 0;
      
      for (const sessionId of sessionIds) {
        if (excludeSessionId && sessionId === excludeSessionId) {
          continue;
        }
        
        const deleted = await this.deleteSession(sessionId);
        if (deleted) {
          deletedCount++;
        }
      }
      
      logger.info('User sessions deleted from Redis', {
        userId,
        deletedCount,
        excludedSession: excludeSessionId,
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete user sessions from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return 0;
    }
  }

  /**
   * Check if session exists
   */
  public async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check session existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Get session TTL
   */
  public async getSessionTTL(sessionId: string): Promise<number> {
    try {
      const key = this.getSessionKey(sessionId);
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Failed to get session TTL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return -1;
    }
  }

  /**
   * Extend session TTL
   */
  public async extendSession(sessionId: string, additionalTTL: number): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      const currentTTL = await redis.ttl(key);
      
      if (currentTTL <= 0) {
        return false; // Session doesn't exist or has no expiry
      }
      
      const newTTL = currentTTL + additionalTTL;
      await redis.expire(key, newTTL);
      
      logger.debug('Session TTL extended', {
        sessionId,
        previousTTL: currentTTL,
        newTTL,
        additionalTTL,
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to extend session TTL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return false;
    }
  }

  /**
   * Get active session count for user
   */
  public async getUserSessionCount(userId: string): Promise<number> {
    try {
      const indexKey = this.getUserSessionIndexKey(userId);
      return await redis.scard(indexKey);
    } catch (error) {
      logger.error('Failed to get user session count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      let cleanedCount = 0;
      const pattern = `${this.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2) { // Key doesn't exist
          cleanedCount++;
        } else if (ttl === -1) { // Key exists but has no expiry (shouldn't happen)
          await redis.del(key);
          cleanedCount++;
        }
      }
      
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
   * Get session statistics
   */
  public async getSessionStats(): Promise<{
    totalSessions: number;
    uniqueUsers: number;
    averageSessionsPerUser: number;
  }> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      const totalSessions = keys.length;
      
      // Get unique users
      const userIndexPattern = `${this.keyPrefix}user:*`;
      const userKeys = await redis.keys(userIndexPattern);
      const uniqueUsers = userKeys.length;
      
      const averageSessionsPerUser = uniqueUsers > 0 ? totalSessions / uniqueUsers : 0;
      
      return {
        totalSessions,
        uniqueUsers,
        averageSessionsPerUser: Math.round(averageSessionsPerUser * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get session statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalSessions: 0,
        uniqueUsers: 0,
        averageSessionsPerUser: 0,
      };
    }
  }

  // Private helper methods

  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  private getUserSessionIndexKey(userId: string): string {
    return `${this.keyPrefix}user:${userId}:sessions`;
  }

  private getSessionMetadataKey(sessionId: string): string {
    return `${this.keyPrefix}meta:${sessionId}`;
  }

  private async addToUserSessionIndex(
    userId: string, 
    sessionId: string, 
    ttl: number
  ): Promise<void> {
    const indexKey = this.getUserSessionIndexKey(userId);
    await redis.sadd(indexKey, sessionId);
    await redis.expire(indexKey, ttl);
  }

  private async removeFromUserSessionIndex(
    userId: string, 
    sessionId: string
  ): Promise<void> {
    const indexKey = this.getUserSessionIndexKey(userId);
    await redis.srem(indexKey, sessionId);
  }

  private async storeSessionMetadata(
    sessionId: string, 
    data: SessionData, 
    ttl: number
  ): Promise<void> {
    const metaKey = this.getSessionMetadataKey(sessionId);
    const metadata = {
      userId: data.userId,
      createdAt: data.createdAt,
      ipAddress: data.ipAddress,
      deviceFingerprint: data.deviceFingerprint,
      isSuspicious: data.isSuspicious,
    };
    
    await redis.setEx(metaKey, ttl, JSON.stringify(metadata));
  }

  private async deleteSessionMetadata(sessionId: string): Promise<void> {
    const metaKey = this.getSessionMetadataKey(sessionId);
    await redis.del(metaKey);
  }

  private encryptSessionData(data: SessionData): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Failed to encrypt session data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private decryptSessionData(encryptedData: string): SessionData {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt session data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private isSessionExpired(sessionData: SessionData): boolean {
    const expiresAt = new Date(sessionData.expiresAt);
    return expiresAt < new Date();
  }
}

// Export singleton instance
export const redisSessionService = new RedisSessionService({
  keyPrefix: 'dwaybank:session:',
  ttl: 604800, // 7 days
  encryptData: true,
});

export default redisSessionService;