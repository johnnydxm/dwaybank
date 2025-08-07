import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';
import { redis } from '../config/database';
import logger, { auditLogger } from '../config/logger';
import type { JWTPayload, RefreshTokenPayload, AuthTokens, User } from '../types';

/**
 * JWT Service for DwayBank Authentication System
 * Handles access token and refresh token generation, validation, and rotation
 */

export interface TokenGenerationOptions {
  sessionId: string;
  tokenFamily: string;
  scope?: string[];
  rememberMe?: boolean;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: JWTPayload;
  error?: string;
  isExpired?: boolean;
}

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly algorithm: jwt.Algorithm;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    // Handle missing configuration gracefully for tests
    if (!config?.jwt?.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (!config?.jwt?.refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    this.accessTokenSecret = config.jwt.secret;
    this.refreshTokenSecret = config.jwt.refreshSecret;
    this.algorithm = (config.jwt.algorithm as jwt.Algorithm) || 'HS384';
    this.accessTokenExpiry = config.jwt.expiresIn || '15m';
    this.refreshTokenExpiry = config.jwt.refreshExpiresIn || '7d';

    // Validate JWT configuration on startup
    this.validateConfiguration();
  }

  /**
   * Validate JWT service configuration
   */
  private validateConfiguration(): void {
    if (!this.accessTokenSecret || this.accessTokenSecret.length < 32) {
      throw new Error('JWT access token secret must be at least 32 characters');
    }

    if (!this.refreshTokenSecret || this.refreshTokenSecret.length < 32) {
      throw new Error('JWT refresh token secret must be at least 32 characters');
    }

    if (this.accessTokenSecret === this.refreshTokenSecret) {
      throw new Error('Access token and refresh token secrets must be different');
    }

    const supportedAlgorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
    if (!supportedAlgorithms.includes(this.algorithm)) {
      throw new Error(`Unsupported JWT algorithm: ${this.algorithm}`);
    }

    logger.info('JWT service configuration validated', {
      algorithm: this.algorithm,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
    });
  }

  /**
   * Generate access token
   */
  public generateAccessToken(
    user: Pick<User, 'id' | 'email'>,
    options: TokenGenerationOptions
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4(); // JWT ID for token tracking

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: this.calculateExpiry(now, this.accessTokenExpiry),
      scope: options.scope || ['read', 'write'],
      session_id: options.sessionId,
    };

    // Add additional claims
    const additionalClaims = {
      jti,
      iss: 'dwaybank-api',
      aud: 'dwaybank-client',
      token_type: 'access',
      family: options.tokenFamily,
    };

    try {
      const token = jwt.sign(
        { ...payload, ...additionalClaims },
        this.accessTokenSecret,
        {
          algorithm: this.algorithm,
          expiresIn: this.accessTokenExpiry,
        }
      );

      // Store token JTI in Redis for invalidation support
      this.storeTokenJTI(jti, user.id, options.sessionId, 'access').catch(error => {
        logger.warn('Failed to store token JTI in Redis', { error, jti });
      });

      auditLogger.info('Access token generated', {
        userId: user.id,
        sessionId: options.sessionId,
        tokenFamily: options.tokenFamily,
        scope: options.scope,
        jti,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
        sessionId: options.sessionId,
      });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(
    user: Pick<User, 'id' | 'email'>,
    options: TokenGenerationOptions
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4();

    const payload: RefreshTokenPayload = {
      sub: user.id,
      session_id: options.sessionId,
      token_family: options.tokenFamily,
      iat: now,
      exp: this.calculateExpiry(now, this.refreshTokenExpiry),
    };

    const additionalClaims = {
      jti,
      iss: 'dwaybank-api',
      aud: 'dwaybank-client',
      token_type: 'refresh',
      remember_me: options.rememberMe || false,
    };

    try {
      const token = jwt.sign(
        { ...payload, ...additionalClaims },
        this.refreshTokenSecret,
        {
          algorithm: this.algorithm,
          expiresIn: this.refreshTokenExpiry,
        }
      );

      // Store refresh token JTI with longer TTL
      this.storeTokenJTI(jti, user.id, options.sessionId, 'refresh').catch(error => {
        logger.warn('Failed to store refresh token JTI in Redis', { error, jti });
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
        sessionId: options.sessionId,
      });
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  public generateTokenPair(
    user: Pick<User, 'id' | 'email'>,
    options: TokenGenerationOptions
  ): AuthTokens {
    const accessToken = this.generateAccessToken(user, options);
    const refreshToken = this.generateRefreshToken(user, options);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.getExpiryInSeconds(this.accessTokenExpiry),
      token_type: 'Bearer',
      scope: options.scope || ['read', 'write'],
    };
  }

  /**
   * Validate access token
   */
  public async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: [this.algorithm],
        audience: 'dwaybank-client',
        issuer: 'dwaybank-api',
      }) as any;

      // Validate token type
      if (decoded.token_type !== 'access') {
        return {
          isValid: false,
          error: 'Invalid token type',
        };
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return {
          isValid: false,
          error: 'Token has been revoked',
        };
      }

      // Validate required claims
      if (!decoded.sub || !decoded.email || !decoded.session_id) {
        return {
          isValid: false,
          error: 'Missing required claims',
        };
      }

      const payload: JWTPayload = {
        sub: decoded.sub,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp,
        scope: decoded.scope || ['read', 'write'],
        session_id: decoded.session_id,
      };

      return {
        isValid: true,
        payload,
      };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          isValid: false,
          error: 'Token expired',
          isExpired: true,
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          isValid: false,
          error: error.message,
        };
      }

      logger.error('Token validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Validate refresh token
   */
  public async validateRefreshToken(token: string): Promise<{
    isValid: boolean;
    payload?: RefreshTokenPayload;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: [this.algorithm],
        audience: 'dwaybank-client',
        issuer: 'dwaybank-api',
      }) as any;

      // Validate token type
      if (decoded.token_type !== 'refresh') {
        return {
          isValid: false,
          error: 'Invalid token type',
        };
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return {
          isValid: false,
          error: 'Refresh token has been revoked',
        };
      }

      const payload: RefreshTokenPayload = {
        sub: decoded.sub,
        session_id: decoded.session_id,
        token_family: decoded.token_family,
        iat: decoded.iat,
        exp: decoded.exp,
      };

      return {
        isValid: true,
        payload,
      };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          isValid: false,
          error: 'Refresh token expired',
        };
      }

      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Refresh token pair with rotation
   */
  public async refreshTokens(
    refreshToken: string,
    user: Pick<User, 'id' | 'email'>
  ): Promise<AuthTokens | null> {
    const validation = await this.validateRefreshToken(refreshToken);

    if (!validation.isValid || !validation.payload) {
      auditLogger.warn('Invalid refresh token used', {
        userId: user.id,
        error: validation.error,
      });
      return null;
    }

    // Revoke the old refresh token (rotation)
    await this.revokeToken(refreshToken);

    // Generate new token pair with same family
    const newTokens = this.generateTokenPair(user, {
      sessionId: validation.payload.session_id,
      tokenFamily: validation.payload.token_family,
      scope: ['read', 'write'], // Could be retrieved from session
    });

    auditLogger.info('Tokens refreshed successfully', {
      userId: user.id,
      sessionId: validation.payload.session_id,
      tokenFamily: validation.payload.token_family,
    });

    return newTokens;
  }

  /**
   * Revoke token (add to blacklist)
   */
  public async revokeToken(token: string): Promise<boolean> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.jti) {
        return false;
      }

      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      await redis.setEx(`blacklist:${decoded.jti}`, ttl, 'revoked');

      auditLogger.info('Token revoked', {
        jti: decoded.jti,
        tokenType: decoded.token_type,
        userId: decoded.sub,
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user session
   */
  public async revokeSessionTokens(sessionId: string): Promise<number> {
    try {
      const pattern = `token:*:${sessionId}`;
      const keys = await redis.keys(pattern);
      
      let revokedCount = 0;
      for (const key of keys) {
        const jti = key.split(':')[1];
        await redis.setEx(`blacklist:${jti}`, 86400, 'session_revoked'); // 24 hours
        revokedCount++;
      }

      // Clean up session token tracking
      await redis.del(...keys);

      auditLogger.info('Session tokens revoked', {
        sessionId,
        revokedCount,
      });

      return revokedCount;
    } catch (error) {
      logger.error('Failed to revoke session tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      return 0;
    }
  }

  /**
   * Check if token is blacklisted
   */
  private async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await redis.get(`blacklist:${jti}`);
      return result !== null;
    } catch (error) {
      logger.warn('Failed to check token blacklist', { error, jti });
      return false; // Fail open for availability
    }
  }

  /**
   * Store token JTI for tracking
   */
  private async storeTokenJTI(
    jti: string,
    userId: string,
    sessionId: string,
    tokenType: 'access' | 'refresh'
  ): Promise<void> {
    try {
      const key = `token:${jti}:${sessionId}`;
      const value = JSON.stringify({
        userId,
        tokenType,
        issuedAt: new Date().toISOString(),
      });

      // TTL based on token type
      const ttl = tokenType === 'access' 
        ? this.getExpiryInSeconds(this.accessTokenExpiry)
        : this.getExpiryInSeconds(this.refreshTokenExpiry);

      await redis.setEx(key, ttl, value);
    } catch (error) {
      logger.warn('Failed to store token JTI', { error, jti, tokenType });
    }
  }

  /**
   * Calculate token expiry timestamp
   */
  private calculateExpiry(now: number, expiry: string): number {
    const seconds = this.getExpiryInSeconds(expiry);
    return now + seconds;
  }

  /**
   * Convert expiry string to seconds
   */
  private getExpiryInSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  /**
   * Extract user ID from token without validation
   */
  public extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.sub || null;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiry time
   */
  public getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();