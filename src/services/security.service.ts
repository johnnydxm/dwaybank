import { Pool } from 'pg';
import { config } from '../config/environment';
import logger, { auditLogger } from '../config/logger';

/**
 * Security Service for DwayBank
 * Handles security controls, threat detection, and risk assessment
 */

export interface SecurityEvent {
  type: 'login' | 'mfa_setup' | 'mfa_verify' | 'password_change' | 'suspicious_activity' | 'rate_limit' | 'failed_auth';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: any;
  riskScore: number;
  blocked: boolean;
  timestamp: Date;
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommended_actions: string[];
  blocked: boolean;
}

export interface SecurityConfig {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  suspiciousPatterns: {
    rapidRequests: number;
    multipleLocations: number;
    unusualHours: boolean;
  };
}

class SecurityService {
  private db: Pool;
  private securityConfig: SecurityConfig;
  private ipCache: Map<string, any> = new Map();
  private userCache: Map<string, any> = new Map();

  constructor(database: Pool) {
    this.db = database;
    this.securityConfig = {
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
      riskThresholds: {
        low: 25,
        medium: 50,
        high: 75,
        critical: 90,
      },
      suspiciousPatterns: {
        rapidRequests: 10, // requests per minute
        multipleLocations: 3, // different locations in short time
        unusualHours: true, // activity outside normal hours
      },
    };
  }

  /**
   * Assess risk for a security event
   */
  async assessRisk(event: Omit<SecurityEvent, 'riskScore' | 'blocked' | 'timestamp'>): Promise<RiskAssessment> {
    try {
      let riskScore = 0;
      const factors: string[] = [];
      const recommendedActions: string[] = [];

      // Base risk by event type
      const baseRisks = {
        login: 10,
        mfa_setup: 15,
        mfa_verify: 5,
        password_change: 20,
        suspicious_activity: 50,
        rate_limit: 30,
        failed_auth: 25,
      };

      riskScore += baseRisks[event.type] || 10;

      // IP-based risk assessment
      const ipRisk = await this.assessIPRisk(event.ipAddress);
      riskScore += ipRisk.score;
      factors.push(...ipRisk.factors);

      // User-based risk assessment (if user is known)
      if (event.userId) {
        const userRisk = await this.assessUserRisk(event.userId, event.ipAddress);
        riskScore += userRisk.score;
        factors.push(...userRisk.factors);
      }

      // Time-based risk assessment
      const timeRisk = this.assessTimeRisk();
      riskScore += timeRisk.score;
      factors.push(...timeRisk.factors);

      // Device/User-Agent risk assessment
      const deviceRisk = this.assessDeviceRisk(event.userAgent);
      riskScore += deviceRisk.score;
      factors.push(...deviceRisk.factors);

      // Determine risk level
      let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (riskScore >= this.securityConfig.riskThresholds.critical) {
        level = 'critical';
        recommendedActions.push('Block request immediately');
        recommendedActions.push('Require additional verification');
        recommendedActions.push('Alert security team');
      } else if (riskScore >= this.securityConfig.riskThresholds.high) {
        level = 'high';
        recommendedActions.push('Require MFA verification');
        recommendedActions.push('Monitor closely');
        recommendedActions.push('Limit access');
      } else if (riskScore >= this.securityConfig.riskThresholds.medium) {
        level = 'medium';
        recommendedActions.push('Additional security checks');
        recommendedActions.push('Log for review');
      } else {
        level = 'low';
        recommendedActions.push('Standard processing');
      }

      const blocked = level === 'critical' || riskScore >= 90;

      return {
        score: Math.min(riskScore, 100),
        level,
        factors,
        recommended_actions: recommendedActions,
        blocked,
      };

    } catch (error) {
      logger.error('Risk assessment failed', { error, event });
      
      // Return conservative high-risk assessment on error
      return {
        score: 75,
        level: 'high',
        factors: ['Risk assessment error'],
        recommended_actions: ['Manual review required'],
        blocked: false,
      };
    }
  }

  /**
   * Assess IP address risk
   */
  private async assessIPRisk(ipAddress: string): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Check if IP is in cache
      const cached = this.ipCache.get(ipAddress);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
        return cached.risk;
      }

      // Check recent failed attempts from this IP
      const failedAttemptsResult = await this.db.query(`
        SELECT COUNT(*) as count
        FROM mfa_verification_attempts
        WHERE ip_address = $1 
        AND is_successful = false 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `, [ipAddress]);

      const failedAttempts = parseInt(failedAttemptsResult.rows[0].count) || 0;
      if (failedAttempts > 10) {
        score += 40;
        factors.push(`High failed attempts: ${failedAttempts}`);
      } else if (failedAttempts > 5) {
        score += 20;
        factors.push(`Multiple failed attempts: ${failedAttempts}`);
      }

      // Check request frequency
      const recentRequestsResult = await this.db.query(`
        SELECT COUNT(*) as count
        FROM mfa_verification_attempts
        WHERE ip_address = $1 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
      `, [ipAddress]);

      const recentRequests = parseInt(recentRequestsResult.rows[0].count) || 0;
      if (recentRequests > this.securityConfig.suspiciousPatterns.rapidRequests) {
        score += 25;
        factors.push(`Rapid requests: ${recentRequests}/10min`);
      }

      // Check if IP has been used by multiple users recently
      const multiUserResult = await this.db.query(`
        SELECT COUNT(DISTINCT user_id) as user_count
        FROM mfa_verification_attempts
        WHERE ip_address = $1 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `, [ipAddress]);

      const userCount = parseInt(multiUserResult.rows[0].user_count) || 0;
      if (userCount > 3) {
        score += 30;
        factors.push(`Multiple users from same IP: ${userCount}`);
      }

      // TODO: Add geolocation-based risk assessment
      // TODO: Add IP reputation checks against threat intelligence feeds

      const result = { score, factors };
      
      // Cache the result
      this.ipCache.set(ipAddress, {
        risk: result,
        timestamp: Date.now(),
      });

      return result;

    } catch (error) {
      logger.error('IP risk assessment failed', { error, ipAddress });
      return { score: 15, factors: ['IP assessment error'] };
    }
  }

  /**
   * Assess user-specific risk
   */
  private async assessUserRisk(userId: string, currentIP: string): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Check if user is in cache
      const cacheKey = `${userId}:${currentIP}`;
      const cached = this.userCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
        return cached.risk;
      }

      // Check user's recent failed attempts
      const userFailedResult = await this.db.query(`
        SELECT COUNT(*) as count
        FROM mfa_verification_attempts
        WHERE user_id = $1 
        AND is_successful = false 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `, [userId]);

      const userFailed = parseInt(userFailedResult.rows[0].count) || 0;
      if (userFailed > 5) {
        score += 35;
        factors.push(`User failed attempts: ${userFailed}`);
      }

      // Check if user is accessing from new location
      const knownIPsResult = await this.db.query(`
        SELECT DISTINCT ip_address
        FROM mfa_verification_attempts
        WHERE user_id = $1 
        AND is_successful = true 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        LIMIT 10
      `, [userId]);

      const knownIPs = knownIPsResult.rows.map(row => row.ip_address);
      if (!knownIPs.includes(currentIP)) {
        score += 20;
        factors.push('New IP address for user');
      }

      // Check for rapid location changes (if we had geolocation)
      // This would require geolocation service integration

      // Check account status
      const userResult = await this.db.query(`
        SELECT status, failed_login_attempts, locked_until
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        if (user.status === 'suspended') {
          score += 60;
          factors.push('Account suspended');
        }

        if (user.failed_login_attempts > 3) {
          score += 15;
          factors.push(`Recent login failures: ${user.failed_login_attempts}`);
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          score += 50;
          factors.push('Account currently locked');
        }
      }

      const result = { score, factors };
      
      // Cache the result
      this.userCache.set(cacheKey, {
        risk: result,
        timestamp: Date.now(),
      });

      return result;

    } catch (error) {
      logger.error('User risk assessment failed', { error, userId });
      return { score: 10, factors: ['User assessment error'] };
    }
  }

  /**
   * Assess time-based risk
   */
  private assessTimeRisk(): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    if (!this.securityConfig.suspiciousPatterns.unusualHours) {
      return { score, factors };
    }

    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6; // Sunday = 0, Saturday = 6

    // Consider late night/early morning hours as higher risk
    if (hour >= 1 && hour <= 5) {
      score += 10;
      factors.push('Late night activity');
    }

    // Weekend activity might be less common for business accounts
    if (isWeekend) {
      score += 5;
      factors.push('Weekend activity');
    }

    return { score, factors };
  }

  /**
   * Assess device/user-agent risk
   */
  private assessDeviceRisk(userAgent: string): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    if (!userAgent || userAgent.length < 10) {
      score += 20;
      factors.push('Missing or suspicious user agent');
      return { score, factors };
    }

    // Check for bot-like user agents
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
    ];

    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      score += 30;
      factors.push('Bot-like user agent detected');
    }

    // Check for very old browsers (potential security risk)
    if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
      score += 15;
      factors.push('Outdated browser detected');
    }

    return { score, factors };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Log to application logs
      auditLogger.warn('Security event logged', {
        type: event.type,
        userId: event.userId,
        ipAddress: event.ipAddress,
        riskScore: event.riskScore,
        blocked: event.blocked,
        details: event.details,
        timestamp,
      });

      // Store in database for analysis
      await this.db.query(`
        INSERT INTO security_events (
          type, user_id, ip_address, user_agent, details, 
          risk_score, blocked, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        event.type,
        event.userId || null,
        event.ipAddress,
        event.userAgent,
        JSON.stringify(event.details),
        event.riskScore,
        event.blocked,
        timestamp,
      ]);

    } catch (error) {
      logger.error('Failed to log security event', { error, event });
    }
  }

  /**
   * Check if user/IP should be blocked
   */
  async shouldBlock(userId?: string, ipAddress?: string): Promise<{
    blocked: boolean;
    reason?: string;
    unblockAt?: Date;
  }> {
    try {
      // Check IP-based blocks
      if (ipAddress) {
        const ipBlockResult = await this.db.query(`
          SELECT COUNT(*) as failed_count
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND is_successful = false 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `, [ipAddress]);

        const ipFailedCount = parseInt(ipBlockResult.rows[0].failed_count) || 0;
        if (ipFailedCount >= 15) { // IP-based blocking threshold
          const unblockAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          return {
            blocked: true,
            reason: 'Too many failed attempts from this IP address',
            unblockAt,
          };
        }
      }

      // Check user-based blocks
      if (userId) {
        const userResult = await this.db.query(`
          SELECT locked_until, status FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          if (user.status === 'suspended') {
            return {
              blocked: true,
              reason: 'Account suspended',
            };
          }

          if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return {
              blocked: true,
              reason: 'Account temporarily locked',
              unblockAt: new Date(user.locked_until),
            };
          }
        }
      }

      return { blocked: false };

    } catch (error) {
      logger.error('Block check failed', { error, userId, ipAddress });
      return { blocked: false };
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(days: number = 7): Promise<{
    events: {
      total: number;
      byType: Record<string, number>;
      blocked: number;
      highRisk: number;
    };
    threats: {
      suspiciousIPs: string[];
      blockedUsers: number;
      averageRiskScore: number;
    };
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get event statistics
      const eventsResult = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN blocked THEN 1 END) as blocked,
          COUNT(CASE WHEN risk_score >= 75 THEN 1 END) as high_risk,
          AVG(risk_score) as avg_risk_score
        FROM security_events
        WHERE created_at >= $1
      `, [startDate]);

      const eventsByTypeResult = await this.db.query(`
        SELECT type, COUNT(*) as count
        FROM security_events
        WHERE created_at >= $1
        GROUP BY type
      `, [startDate]);

      const events = eventsResult.rows[0];
      const byType: Record<string, number> = {};
      eventsByTypeResult.rows.forEach(row => {
        byType[row.type] = parseInt(row.count);
      });

      // Get threat statistics
      const suspiciousIPsResult = await this.db.query(`
        SELECT ip_address, COUNT(*) as attempts
        FROM security_events
        WHERE created_at >= $1 
        AND (blocked = true OR risk_score >= 75)
        GROUP BY ip_address
        HAVING COUNT(*) >= 5
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [startDate]);

      const blockedUsersResult = await this.db.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE (locked_until > CURRENT_TIMESTAMP OR status = 'suspended')
      `);

      return {
        events: {
          total: parseInt(events.total) || 0,
          byType,
          blocked: parseInt(events.blocked) || 0,
          highRisk: parseInt(events.high_risk) || 0,
        },
        threats: {
          suspiciousIPs: suspiciousIPsResult.rows.map(row => row.ip_address),
          blockedUsers: parseInt(blockedUsersResult.rows[0].count) || 0,
          averageRiskScore: parseFloat(events.avg_risk_score) || 0,
        },
      };

    } catch (error) {
      logger.error('Failed to get security statistics', { error });
      return {
        events: { total: 0, byType: {}, blocked: 0, highRisk: 0 },
        threats: { suspiciousIPs: [], blockedUsers: 0, averageRiskScore: 0 },
      };
    }
  }

  /**
   * Clean up old security events
   */
  async cleanupOldEvents(days: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const result = await this.db.query(`
        DELETE FROM security_events
        WHERE created_at < $1
      `, [cutoffDate]);

      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        logger.info('Security events cleanup completed', {
          deletedCount,
          cutoffDate,
        });
      }

      return deletedCount;

    } catch (error) {
      logger.error('Security events cleanup failed', { error });
      return 0;
    }
  }

  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.ipCache.clear();
    this.userCache.clear();
    logger.debug('Security service caches cleared');
  }
}

// Create security events table if it doesn't exist
const createSecurityEventsTable = async (db: Pool) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type VARCHAR(50) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ip_address INET NOT NULL,
        user_agent TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
      CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
      CREATE INDEX IF NOT EXISTS idx_security_events_risk_score ON security_events(risk_score);
      CREATE INDEX IF NOT EXISTS idx_security_events_blocked ON security_events(blocked);
    `);

    logger.info('Security events table initialized');

  } catch (error) {
    logger.error('Failed to create security events table', { error });
  }
};

// Initialize security service
export const initializeSecurityService = async (database: Pool): Promise<SecurityService> => {
  await createSecurityEventsTable(database);
  return new SecurityService(database);
};

// Export service instance (will be initialized in server.ts)
export let securityService: SecurityService;

export const setSecurityService = (service: SecurityService) => {
  securityService = service;
};

// Set up cleanup interval for caches
setInterval(() => {
  if (securityService) {
    securityService.clearCaches();
  }
}, 10 * 60 * 1000); // Clean up every 10 minutes