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

      // Geolocation-based risk assessment
      const geoRisk = await this.assessGeolocationRisk(ipAddress);
      score += geoRisk.score;
      factors.push(...geoRisk.factors);

      // IP reputation checks against threat intelligence feeds
      const reputationRisk = await this.assessIPReputation(ipAddress);
      score += reputationRisk.score;
      factors.push(...reputationRisk.factors);

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
   * Assess geolocation-based risk
   */
  private async assessGeolocationRisk(ipAddress: string): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Check cache first
      const cacheKey = `geo:${ipAddress}`;
      const cached = this.ipCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hour cache
        return cached.risk;
      }

      // Skip geolocation for private/local IPs
      if (this.isPrivateIP(ipAddress)) {
        return { score: 0, factors: [] };
      }

      // Get geolocation data (using a free service or internal database)
      const geoData = await this.getGeolocationData(ipAddress);
      
      if (geoData) {
        // Check against known high-risk countries/regions
        const highRiskCountries = ['CN', 'RU', 'KP', 'IR', 'SY']; // Example list
        const mediumRiskCountries = ['TR', 'PK', 'BD', 'NG', 'VN']; // Example list
        
        if (highRiskCountries.includes(geoData.countryCode)) {
          score += 25;
          factors.push(`High-risk country: ${geoData.country}`);
        } else if (mediumRiskCountries.includes(geoData.countryCode)) {
          score += 15;
          factors.push(`Medium-risk country: ${geoData.country}`);
        }

        // Check for known proxy/VPN/Tor exit nodes
        if (geoData.isProxy || geoData.isVpn || geoData.isTor) {
          score += 30;
          factors.push('Proxy/VPN/Tor detected');
        }

        // Check for hosting providers (potential bot/script usage)
        if (geoData.isHosting) {
          score += 20;
          factors.push('Hosting provider IP detected');
        }

        // Check for rapid location changes for known users
        await this.checkLocationVelocity(ipAddress, geoData, score, factors);
      }

      const result = { score, factors };
      
      // Cache the result
      this.ipCache.set(cacheKey, {
        risk: result,
        timestamp: Date.now(),
      });

      return result;

    } catch (error) {
      logger.error('Geolocation risk assessment failed', { error, ipAddress });
      return { score: 5, factors: ['Geolocation assessment error'] };
    }
  }

  /**
   * Assess IP reputation using threat intelligence feeds
   */
  private async assessIPReputation(ipAddress: string): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];

    try {
      // Check cache first
      const cacheKey = `reputation:${ipAddress}`;
      const cached = this.ipCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour cache
        return cached.risk;
      }

      // Skip reputation check for private/local IPs
      if (this.isPrivateIP(ipAddress)) {
        return { score: 0, factors: [] };
      }

      // Check against internal threat database
      const internalThreat = await this.checkInternalThreatDatabase(ipAddress);
      if (internalThreat) {
        score += internalThreat.score;
        factors.push(...internalThreat.factors);
      }

      // Check against multiple threat intelligence feeds
      const threatFeeds = await Promise.allSettled([
        this.checkAbuseIPDB(ipAddress),
        this.checkVirusTotalIP(ipAddress),
        this.checkThreatIntelligence(ipAddress)
      ]);

      threatFeeds.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          score += result.value.score;
          factors.push(...result.value.factors);
        } else if (result.status === 'rejected') {
          logger.warn(`Threat feed ${index} failed`, { error: result.reason, ipAddress });
        }
      });

      const result = { score: Math.min(score, 50), factors }; // Cap reputation score at 50
      
      // Cache the result
      this.ipCache.set(cacheKey, {
        risk: result,
        timestamp: Date.now(),
      });

      return result;

    } catch (error) {
      logger.error('IP reputation assessment failed', { error, ipAddress });
      return { score: 10, factors: ['IP reputation assessment error'] };
    }
  }

  /**
   * Check if IP is private/local
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Get geolocation data for IP address
   */
  private async getGeolocationData(ipAddress: string): Promise<any> {
    try {
      // In production, integrate with MaxMind GeoIP2, IPStack, or similar service
      // For now, return mock data structure
      return {
        country: 'United States',
        countryCode: 'US',
        city: 'New York',
        region: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        isProxy: false,
        isVpn: false,
        isTor: false,
        isHosting: false,
        organization: 'Example ISP',
        asn: 'AS12345',
      };
    } catch (error) {
      logger.error('Failed to get geolocation data', { error, ipAddress });
      return null;
    }
  }

  /**
   * Check location velocity for rapid location changes
   */
  private async checkLocationVelocity(
    ipAddress: string, 
    currentGeo: any, 
    score: number, 
    factors: string[]
  ): Promise<void> {
    try {
      // Get recent successful authentications from different IPs
      const recentAuthsResult = await this.db.query(`
        SELECT DISTINCT ip_address, created_at
        FROM mfa_verification_attempts
        WHERE is_successful = true 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND ip_address != $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [ipAddress]);

      for (const auth of recentAuthsResult.rows) {
        const authGeo = await this.getGeolocationData(auth.ip_address);
        if (authGeo) {
          const distance = this.calculateDistance(
            currentGeo.latitude, currentGeo.longitude,
            authGeo.latitude, authGeo.longitude
          );
          
          const timeDiff = Date.now() - new Date(auth.created_at).getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          
          // Calculate impossible travel speed (>1000 km/h is suspicious)
          const speed = distance / hoursDiff;
          
          if (speed > 1000) {
            score += 20;
            factors.push(`Impossible travel velocity: ${Math.round(speed)}km/h`);
          } else if (speed > 500) {
            score += 10;
            factors.push(`High travel velocity: ${Math.round(speed)}km/h`);
          }
        }
      }
    } catch (error) {
      logger.error('Location velocity check failed', { error, ipAddress });
    }
  }

  /**
   * Calculate distance between two geographic points
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Check internal threat database
   */
  private async checkInternalThreatDatabase(ipAddress: string): Promise<{ score: number; factors: string[] } | null> {
    try {
      const threatResult = await this.db.query(`
        SELECT threat_level, threat_type, last_seen, confidence_score
        FROM ip_threat_database
        WHERE ip_address = $1 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY last_seen DESC
        LIMIT 1
      `, [ipAddress]);

      if (threatResult.rows.length > 0) {
        const threat = threatResult.rows[0];
        let score = 0;
        const factors: string[] = [];

        switch (threat.threat_level) {
          case 'critical':
            score = 40;
            factors.push(`Critical threat: ${threat.threat_type}`);
            break;
          case 'high':
            score = 30;
            factors.push(`High threat: ${threat.threat_type}`);
            break;
          case 'medium':
            score = 20;
            factors.push(`Medium threat: ${threat.threat_type}`);
            break;
          case 'low':
            score = 10;
            factors.push(`Low threat: ${threat.threat_type}`);
            break;
        }

        // Adjust score based on confidence
        score = Math.round(score * (threat.confidence_score / 100));

        return { score, factors };
      }

      return null;
    } catch (error) {
      logger.error('Internal threat database check failed', { error, ipAddress });
      return null;
    }
  }

  /**
   * Check AbuseIPDB threat intelligence
   */
  private async checkAbuseIPDB(ipAddress: string): Promise<{ score: number; factors: string[] } | null> {
    try {
      // In production, integrate with AbuseIPDB API
      // For now, return null (no threat detected)
      return null;
    } catch (error) {
      logger.error('AbuseIPDB check failed', { error, ipAddress });
      return null;
    }
  }

  /**
   * Check VirusTotal IP reputation
   */
  private async checkVirusTotalIP(ipAddress: string): Promise<{ score: number; factors: string[] } | null> {
    try {
      // In production, integrate with VirusTotal API
      // For now, return null (no threat detected)
      return null;
    } catch (error) {
      logger.error('VirusTotal check failed', { error, ipAddress });
      return null;
    }
  }

  /**
   * Check custom threat intelligence feeds
   */
  private async checkThreatIntelligence(ipAddress: string): Promise<{ score: number; factors: string[] } | null> {
    try {
      // In production, integrate with commercial threat feeds
      // For now, return null (no threat detected)
      return null;
    } catch (error) {
      logger.error('Threat intelligence check failed', { error, ipAddress });
      return null;
    }
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
   * Enhanced suspicious activity detection
   */
  async detectSuspiciousActivity(userId?: string, ipAddress?: string, context?: any): Promise<{
    suspicious: boolean;
    riskScore: number;
    factors: string[];
    recommendedActions: string[];
  }> {
    try {
      let riskScore = 0;
      const factors: string[] = [];
      const recommendedActions: string[] = [];

      // Check for multiple failed login attempts across different accounts from same IP
      if (ipAddress) {
        const crossAccountFailures = await this.db.query(`
          SELECT COUNT(DISTINCT user_id) as affected_users, COUNT(*) as total_failures
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND is_successful = false 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `, [ipAddress]);

        const crossAccount = crossAccountFailures.rows[0];
        if (parseInt(crossAccount.affected_users) > 3) {
          riskScore += 40;
          factors.push(`Multiple accounts targeted from IP: ${crossAccount.affected_users} users`);
          recommendedActions.push('Block IP address temporarily');
        }

        // Check for rapid sequential attempts (potential brute force)
        const rapidAttempts = await this.db.query(`
          SELECT COUNT(*) as count, 
                 EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as time_span
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        `, [ipAddress]);

        const rapid = rapidAttempts.rows[0];
        const timeSpan = parseFloat(rapid.time_span) || 0;
        const attemptCount = parseInt(rapid.count) || 0;
        
        if (attemptCount > 20 && timeSpan < 300) { // 20+ attempts in 5 minutes
          riskScore += 35;
          factors.push(`Rapid-fire attempts: ${attemptCount} in ${Math.round(timeSpan)}s`);
          recommendedActions.push('Implement progressive delays');
        }
      }

      // Check for user-specific suspicious patterns
      if (userId) {
        // Check for multiple simultaneous sessions from different locations
        const simultaneousSessions = await this.db.query(`
          SELECT COUNT(DISTINCT ip_address) as unique_ips,
                 array_agg(DISTINCT ip_address) as ip_addresses
          FROM mfa_verification_attempts
          WHERE user_id = $1 
          AND is_successful = true 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
        `, [userId]);

        const sessions = simultaneousSessions.rows[0];
        const uniqueIPs = parseInt(sessions.unique_ips) || 0;
        
        if (uniqueIPs > 2) {
          riskScore += 25;
          factors.push(`Simultaneous sessions from ${uniqueIPs} different IPs`);
          recommendedActions.push('Require fresh MFA verification');
        }

        // Check for unusual time-based patterns
        const timePatterns = await this.checkUnusualTimePatterns(userId);
        if (timePatterns.suspicious) {
          riskScore += timePatterns.score;
          factors.push(...timePatterns.factors);
          recommendedActions.push(...timePatterns.actions);
        }

        // Check for device fingerprint anomalies
        if (context?.deviceFingerprint) {
          const deviceAnomalies = await this.checkDeviceAnomalies(userId, context.deviceFingerprint);
          if (deviceAnomalies.suspicious) {
            riskScore += deviceAnomalies.score;
            factors.push(...deviceAnomalies.factors);
            recommendedActions.push(...deviceAnomalies.actions);
          }
        }
      }

      // Check for known attack patterns
      const attackPatterns = await this.checkAttackPatterns(userId, ipAddress);
      if (attackPatterns.detected) {
        riskScore += attackPatterns.score;
        factors.push(...attackPatterns.factors);
        recommendedActions.push(...attackPatterns.actions);
      }

      // Determine if activity is suspicious
      const suspicious = riskScore >= 30;

      if (suspicious) {
        // Log suspicious activity
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          userId,
          ipAddress: ipAddress || 'unknown',
          userAgent: context?.userAgent || 'unknown',
          details: {
            riskScore,
            factors,
            recommendedActions,
            context,
          },
          riskScore,
          blocked: riskScore >= 60,
        });
      }

      return {
        suspicious,
        riskScore: Math.min(riskScore, 100),
        factors,
        recommendedActions,
      };

    } catch (error) {
      logger.error('Suspicious activity detection failed', { error, userId, ipAddress });
      return {
        suspicious: false,
        riskScore: 0,
        factors: ['Detection error'],
        recommendedActions: ['Manual review recommended'],
      };
    }
  }

  /**
   * Check for unusual time-based access patterns
   */
  private async checkUnusualTimePatterns(userId: string): Promise<{
    suspicious: boolean;
    score: number;
    factors: string[];
    actions: string[];
  }> {
    try {
      const factors: string[] = [];
      const actions: string[] = [];
      let score = 0;

      // Get user's typical access hours over the last 30 days
      const historicalPattern = await this.db.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as frequency
        FROM mfa_verification_attempts
        WHERE user_id = $1 
        AND is_successful = true 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY frequency DESC
      `, [userId]);

      // Get current hour
      const currentHour = new Date().getHours();
      
      // Check if current access is during unusual hours
      const usualHours = historicalPattern.rows.slice(0, 8).map(row => parseInt(row.hour)); // Top 8 hours
      
      if (usualHours.length > 0 && !usualHours.includes(currentHour)) {
        score += 15;
        factors.push(`Access outside usual hours (${currentHour}:00)`);
        actions.push('Verify user identity');
      }

      // Check for access during typically inactive periods (2-6 AM)
      if (currentHour >= 2 && currentHour <= 6) {
        const nightActivity = historicalPattern.rows.find(row => 
          parseInt(row.hour) >= 2 && parseInt(row.hour) <= 6
        );
        
        if (!nightActivity || parseInt(nightActivity.frequency) < 3) {
          score += 20;
          factors.push('Unusual late-night access');
          actions.push('Require additional verification');
        }
      }

      return {
        suspicious: score > 0,
        score,
        factors,
        actions,
      };

    } catch (error) {
      logger.error('Time pattern analysis failed', { error, userId });
      return { suspicious: false, score: 0, factors: [], actions: [] };
    }
  }

  /**
   * Check for device fingerprint anomalies
   */
  private async checkDeviceAnomalies(userId: string, deviceFingerprint: string): Promise<{
    suspicious: boolean;
    score: number;
    factors: string[];
    actions: string[];
  }> {
    try {
      const factors: string[] = [];
      const actions: string[] = [];
      let score = 0;

      // Get known device fingerprints for user
      const knownDevices = await this.db.query(`
        SELECT DISTINCT device_fingerprint, COUNT(*) as usage_count
        FROM mfa_verification_attempts
        WHERE user_id = $1 
        AND is_successful = true 
        AND device_fingerprint IS NOT NULL
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
        GROUP BY device_fingerprint
        ORDER BY usage_count DESC
        LIMIT 10
      `, [userId]);

      const knownFingerprints = knownDevices.rows.map(row => row.device_fingerprint);
      
      // Check if this is a completely new device
      if (!knownFingerprints.includes(deviceFingerprint)) {
        score += 15;
        factors.push('Unrecognized device fingerprint');
        actions.push('Send device verification notification');
      }

      // Check for suspicious device characteristics in fingerprint
      if (deviceFingerprint) {
        const suspiciousPatterns = [
          /headless/i,
          /phantom/i,
          /selenium/i,
          /webdriver/i,
          /automation/i,
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(deviceFingerprint))) {
          score += 30;
          factors.push('Automated/headless browser detected');
          actions.push('Block automated access');
        }
      }

      return {
        suspicious: score > 0,
        score,
        factors,
        actions,
      };

    } catch (error) {
      logger.error('Device anomaly analysis failed', { error, userId });
      return { suspicious: false, score: 0, factors: [], actions: [] };
    }
  }

  /**
   * Check for known attack patterns
   */
  private async checkAttackPatterns(userId?: string, ipAddress?: string): Promise<{
    detected: boolean;
    score: number;
    factors: string[];
    actions: string[];
  }> {
    try {
      const factors: string[] = [];
      const actions: string[] = [];
      let score = 0;

      // Pattern 1: Credential stuffing (same IP, multiple users, similar timing)
      if (ipAddress) {
        const credentialStuffing = await this.db.query(`
          SELECT COUNT(DISTINCT user_id) as user_count,
                 COUNT(*) as attempt_count,
                 EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as time_span
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
        `, [ipAddress]);

        const pattern = credentialStuffing.rows[0];
        const userCount = parseInt(pattern.user_count);
        const attemptCount = parseInt(pattern.attempt_count);
        const timeSpan = parseFloat(pattern.time_span) || 0;

        if (userCount >= 5 && attemptCount >= 15 && timeSpan < 600) {
          score += 40;
          factors.push(`Credential stuffing pattern: ${userCount} users, ${attemptCount} attempts`);
          actions.push('Block IP and alert security team');
        }
      }

      // Pattern 2: Account enumeration (sequential user attempts)
      if (ipAddress) {
        const enumeration = await this.db.query(`
          SELECT COUNT(*) as failed_count,
                 COUNT(DISTINCT user_id) as user_count
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND is_successful = false 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        `, [ipAddress]);

        const enum_pattern = enumeration.rows[0];
        const failedCount = parseInt(enum_pattern.failed_count);
        const userCount = parseInt(enum_pattern.user_count);

        if (failedCount > 20 && userCount > 10) {
          score += 35;
          factors.push(`Account enumeration: ${failedCount} failures across ${userCount} accounts`);
          actions.push('Implement CAPTCHA and rate limiting');
        }
      }

      // Pattern 3: Time-based attacks (precise timing intervals)
      if (ipAddress) {
        const timingAttack = await this.db.query(`
          SELECT created_at
          FROM mfa_verification_attempts
          WHERE ip_address = $1 
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          ORDER BY created_at
        `, [ipAddress]);

        if (timingAttack.rows.length >= 10) {
          const intervals = [];
          for (let i = 1; i < timingAttack.rows.length; i++) {
            const interval = new Date(timingAttack.rows[i].created_at).getTime() - 
                            new Date(timingAttack.rows[i-1].created_at).getTime();
            intervals.push(interval);
          }

          // Check for suspiciously regular intervals (automated attacks)
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avgInterval, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);

          if (stdDev < avgInterval * 0.1 && avgInterval < 10000) { // Very low variance, high frequency
            score += 25;
            factors.push(`Automated timing pattern detected: ${Math.round(avgInterval)}ms intervals`);
            actions.push('Implement jitter and progressive delays');
          }
        }
      }

      return {
        detected: score > 0,
        score,
        factors,
        actions,
      };

    } catch (error) {
      logger.error('Attack pattern analysis failed', { error, userId, ipAddress });
      return { detected: false, score: 0, factors: [], actions: [] };
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