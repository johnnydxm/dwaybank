import { jwtService } from './jwt.service';
import { userService } from './user.service';
import { sessionService } from './session.service';
import { mfaService } from './mfa.service';
import logger, { auditLogger } from '../config/logger';
import type { 
  LoginCredentials, 
  LoginResponse, 
  RegisterInput, 
  RegisterResponse,
  AuthTokens,
  UserProfile 
} from '../types';

/**
 * Authentication Service for DwayBank
 * Orchestrates user authentication, registration, and session management
 */

export interface AuthenticationContext {
  ipAddress: string;
  userAgent: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'api';
  country?: string;
  city?: string;
}

export interface LogoutOptions {
  allDevices?: boolean;
  reason?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  context: AuthenticationContext;
}

export class AuthService {
  /**
   * Register a new user account
   */
  public async register(
    input: RegisterInput,
    context: AuthenticationContext
  ): Promise<RegisterResponse> {
    try {
      // Validate password confirmation
      if (input.password !== input.confirm_password) {
        throw new Error('Password confirmation does not match');
      }

      // Validate terms acceptance
      if (!input.accept_terms || !input.accept_privacy) {
        throw new Error('You must accept the terms of service and privacy policy');
      }

      // Create user account
      const user = await userService.createUser({
        email: input.email,
        password: input.password,
        first_name: input.first_name,
        last_name: input.last_name,
        phone_number: input.phone_number,
        timezone: input.timezone,
        locale: input.locale,
      });

      auditLogger.info('User registration completed', {
        userId: user.id,
        email: user.email,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        user,
        verification_required: true,
        message: 'Account created successfully. Please verify your email address.',
      };

    } catch (error) {
      logger.error('User registration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: input.email,
        ipAddress: context.ipAddress,
      });

      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  public async login(
    credentials: LoginCredentials,
    context: AuthenticationContext
  ): Promise<LoginResponse | null> {
    try {
      // Authenticate user
      const authResult = await userService.authenticateUser(
        credentials,
        context.ipAddress,
        context.userAgent
      );

      if (!authResult.success || !authResult.user) {
        auditLogger.warn('Login attempt failed', {
          email: credentials.email,
          error: authResult.error,
          remainingAttempts: authResult.remainingAttempts,
          ipAddress: context.ipAddress,
        });

        return null;
      }

      const user = authResult.user;

      // Create user session
      const sessionResult = await sessionService.createSession(
        user.id,
        context.ipAddress,
        context.userAgent,
        {
          rememberMe: credentials.remember_me,
          deviceType: context.deviceType,
          country: context.country,
          city: context.city,
        }
      );

      // Generate JWT tokens
      const tokens = jwtService.generateTokenPair(user, {
        sessionId: sessionResult.sessionId,
        tokenFamily: sessionResult.tokenFamily,
        scope: ['read', 'write'],
        rememberMe: credentials.remember_me,
      });

      // Update session with access token JTI
      const accessTokenPayload = await jwtService.validateAccessToken(tokens.access_token);
      if (accessTokenPayload.isValid && accessTokenPayload.payload) {
        await sessionService.updateSessionActivity(
          sessionResult.sessionId,
          // Extract JTI from token (would need to decode JWT)
        );
      }

      auditLogger.info('User login successful', {
        userId: user.id,
        sessionId: sessionResult.sessionId,
        ipAddress: context.ipAddress,
        deviceType: context.deviceType,
      });

      // Check if user has MFA enabled
      const mfaMethods = await mfaService.getUserMFAMethods(user.id);
      const activeMFAMethods = mfaMethods.filter(method => method.isEnabled);
      const mfaRequired = activeMFAMethods.length > 0;

      if (mfaRequired) {
        // Don't issue full tokens yet, MFA verification needed
        auditLogger.info('MFA verification required for login', {
          userId: user.id,
          sessionId: sessionResult.sessionId,
          methodCount: activeMFAMethods.length,
          ipAddress: context.ipAddress,
        });

        return {
          user,
          tokens: {
            access_token: '', // Empty until MFA verified
            refresh_token: '', // Empty until MFA verified
            expires_in: 0,
            token_type: 'Bearer',
            scope: [],
          },
          mfa_required: true,
          mfa_methods: activeMFAMethods.map(method => ({
            id: method.id,
            method: method.method,
            isPrimary: method.isPrimary,
            ...(method.phoneNumber && {
              phoneNumber: `***-***-${method.phoneNumber.slice(-4)}`,
            }),
            ...(method.email && {
              email: `${method.email.charAt(0)}***@${method.email.split('@')[1]}`,
            }),
          })),
        };
      }

      return {
        user,
        tokens,
        mfa_required: false,
      };

    } catch (error) {
      logger.error('Login process failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: credentials.email,
        ipAddress: context.ipAddress,
      });

      return null;
    }
  }

  /**
   * Complete MFA verification and issue tokens
   */
  public async completeMFALogin(
    userId: string,
    sessionId: string,
    mfaCode: string,
    context: AuthenticationContext,
    configId?: string,
    method?: 'totp' | 'sms' | 'email',
    isBackupCode?: boolean
  ): Promise<LoginResponse | null> {
    try {
      // Get user information
      const user = await userService.getUserById(userId);
      if (!user) {
        auditLogger.warn('MFA completion attempted for non-existent user', {
          userId,
          ipAddress: context.ipAddress,
        });
        return null;
      }

      // Verify session is valid
      const session = await sessionService.getSession(sessionId);
      if (!session || session.status !== 'active') {
        auditLogger.warn('MFA completion attempted with invalid session', {
          userId,
          sessionId,
          ipAddress: context.ipAddress,
        });
        return null;
      }

      // Verify MFA code
      const verificationResult = await mfaService.verifyCode({
        userId,
        code: mfaCode,
        configId,
        method,
        isBackupCode,
        context: {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          deviceFingerprint: context.deviceType,
        },
      });

      if (!verificationResult.success) {
        auditLogger.warn('MFA verification failed during login completion', {
          userId,
          sessionId,
          error: verificationResult.error,
          rateLimited: verificationResult.rateLimited,
          ipAddress: context.ipAddress,
        });
        return null;
      }

      // Generate JWT tokens
      const tokens = jwtService.generateTokenPair(user, {
        sessionId,
        tokenFamily: session.token_family,
        scope: ['read', 'write'],
        rememberMe: false, // TODO: Store remember me preference
      });

      // Update session with access token JTI
      const accessTokenPayload = await jwtService.validateAccessToken(tokens.access_token);
      if (accessTokenPayload.isValid && accessTokenPayload.payload) {
        await sessionService.updateSessionActivity(sessionId);
      }

      auditLogger.info('MFA login completed successfully', {
        userId,
        sessionId,
        method: verificationResult.method,
        configId: verificationResult.configId,
        isBackupCode,
        remainingBackupCodes: verificationResult.remainingBackupCodes,
        ipAddress: context.ipAddress,
        deviceType: context.deviceType,
      });

      return {
        user,
        tokens,
        mfa_required: false,
      };

    } catch (error) {
      logger.error('MFA login completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        sessionId,
        ipAddress: context.ipAddress,
      });

      return null;
    }
  }

  /**
   * Refresh authentication tokens
   */
  public async refreshTokens(
    request: RefreshTokenRequest
  ): Promise<AuthTokens | null> {
    try {
      // Validate refresh token
      const validation = await jwtService.validateRefreshToken(request.refreshToken);

      if (!validation.isValid || !validation.payload) {
        auditLogger.warn('Invalid refresh token used', {
          error: validation.error,
          ipAddress: request.context.ipAddress,
        });
        return null;
      }

      // Get user information
      const user = await userService.getUserById(validation.payload.sub);
      if (!user) {
        auditLogger.warn('Refresh token for non-existent user', {
          userId: validation.payload.sub,
          ipAddress: request.context.ipAddress,
        });
        return null;
      }

      // Validate session is still active
      const session = await sessionService.getSession(validation.payload.session_id);
      if (!session || session.status !== 'active') {
        auditLogger.warn('Refresh token for inactive session', {
          userId: user.id,
          sessionId: validation.payload.session_id,
          ipAddress: request.context.ipAddress,
        });
        return null;
      }

      // Generate new token pair
      const newTokens = await jwtService.refreshTokens(request.refreshToken, user);

      if (!newTokens) {
        return null;
      }

      // Update session activity
      await sessionService.updateSessionActivity(validation.payload.session_id);

      auditLogger.info('Tokens refreshed successfully', {
        userId: user.id,
        sessionId: validation.payload.session_id,
        tokenFamily: validation.payload.token_family,
        ipAddress: request.context.ipAddress,
      });

      return newTokens;

    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: request.context.ipAddress,
      });

      return null;
    }
  }

  /**
   * Logout user and revoke session
   */
  public async logout(
    accessToken: string,
    context: AuthenticationContext,
    options: LogoutOptions = {}
  ): Promise<boolean> {
    try {
      // Validate access token
      const tokenValidation = await jwtService.validateAccessToken(accessToken);

      if (!tokenValidation.isValid || !tokenValidation.payload) {
        return false;
      }

      const payload = tokenValidation.payload;

      if (options.allDevices) {
        // Revoke all user sessions
        const revokedCount = await sessionService.revokeUserSessions(
          payload.sub,
          undefined, // Don't exclude any session
          options.reason || 'user_logout_all'
        );

        auditLogger.info('User logged out from all devices', {
          userId: payload.sub,
          revokedSessions: revokedCount,
          ipAddress: context.ipAddress,
        });
      } else {
        // Revoke specific session
        await sessionService.revokeSession(
          payload.session_id,
          options.reason || 'user_logout'
        );

        auditLogger.info('User logged out', {
          userId: payload.sub,
          sessionId: payload.session_id,
          ipAddress: context.ipAddress,
        });
      }

      // Revoke tokens
      await jwtService.revokeToken(accessToken);

      return true;

    } catch (error) {
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: context.ipAddress,
      });

      return false;
    }
  }

  /**
   * Validate access token and return user info
   */
  public async validateToken(accessToken: string): Promise<{
    isValid: boolean;
    user?: UserProfile;
    session?: any;
    error?: string;
  }> {
    try {
      // Validate JWT token
      const tokenValidation = await jwtService.validateAccessToken(accessToken);

      if (!tokenValidation.isValid || !tokenValidation.payload) {
        return {
          isValid: false,
          error: tokenValidation.error,
        };
      }

      const payload = tokenValidation.payload;

      // Get user information
      const user = await userService.getUserById(payload.sub);
      if (!user) {
        return {
          isValid: false,
          error: 'User not found',
        };
      }

      // Check if user account is still active
      if (user.status !== 'active' && user.status !== 'pending') {
        return {
          isValid: false,
          error: 'User account is not active',
        };
      }

      // Get session information
      const session = await sessionService.getSession(payload.session_id);
      if (!session || session.status !== 'active') {
        return {
          isValid: false,
          error: 'Session is not active',
        };
      }

      // Update session activity
      await sessionService.updateSessionActivity(
        payload.session_id,
        // Would extract JTI from token here
      );

      return {
        isValid: true,
        user,
        session,
      };

    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Get user's active sessions
   */
  public async getUserSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<Array<any>> {
    try {
      const sessions = await sessionService.getUserSessions(userId);

      // Mark current session
      return sessions.map(session => ({
        ...session,
        is_current: session.id === currentSessionId,
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
   * Revoke specific session
   */
  public async revokeSession(
    userId: string,
    sessionId: string,
    context: AuthenticationContext
  ): Promise<boolean> {
    try {
      const success = await sessionService.revokeSession(sessionId, 'user_revoked');

      if (success) {
        auditLogger.info('Session revoked by user', {
          userId,
          sessionId,
          ipAddress: context.ipAddress,
        });
      }

      return success;

    } catch (error) {
      logger.error('Failed to revoke session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        sessionId,
      });

      return false;
    }
  }

  /**
   * Revoke all user sessions except current (for bulk termination)
   */
  public async revokeUserSessions(
    userId: string,
    excludeSessionId: string,
    context: AuthenticationContext
  ): Promise<number> {
    try {
      const revokedCount = await sessionService.revokeUserSessions(
        userId,
        excludeSessionId,
        'user_bulk_revoked'
      );

      auditLogger.info('User sessions bulk revoked', {
        userId,
        excludeSessionId,
        revokedCount,
        ipAddress: context.ipAddress,
      });

      return revokedCount;

    } catch (error) {
      logger.error('Failed to revoke user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        excludeSessionId,
      });

      return 0;
    }
  }

  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: AuthenticationContext
  ): Promise<boolean> {
    try {
      const success = await userService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      if (success) {
        // Revoke all other sessions for security
        await sessionService.revokeUserSessions(
          userId,
          undefined, // Don't exclude current session for now
          'password_changed'
        );

        auditLogger.info('Password changed successfully', {
          userId,
          ipAddress: context.ipAddress,
        });
      }

      return success;

    } catch (error) {
      logger.error('Password change failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        ipAddress: context.ipAddress,
      });

      return false;
    }
  }

  /**
   * Verify user email
   */
  public async verifyEmail(
    userId: string,
    context: AuthenticationContext
  ): Promise<boolean> {
    try {
      const success = await userService.verifyEmail(userId);

      if (success) {
        auditLogger.info('Email verified', {
          userId,
          ipAddress: context.ipAddress,
        });
      }

      return success;

    } catch (error) {
      logger.error('Email verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });

      return false;
    }
  }

  /**
   * Get authentication statistics
   */
  public async getAuthStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    activeSessions: number;
    suspiciousActivity: number;
  }> {
    try {
      // This would typically be implemented with proper aggregation queries
      // For now, returning mock data structure
      const sessionStats = await sessionService.getSessionStats();

      return {
        totalUsers: 0, // Would implement user count query
        activeUsers: 0, // Would implement active user count query
        totalSessions: sessionStats.totalActive + sessionStats.totalExpired,
        activeSessions: sessionStats.totalActive,
        suspiciousActivity: sessionStats.suspiciousCount,
      };

    } catch (error) {
      logger.error('Failed to get auth statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        totalUsers: 0,
        activeUsers: 0,
        totalSessions: 0,
        activeSessions: 0,
        suspiciousActivity: 0,
      };
    }
  }

  /**
   * Cleanup expired sessions and revoked tokens
   */
  public async performMaintenance(): Promise<{
    expiredSessions: number;
    revokedTokens: number;
  }> {
    try {
      const expiredSessions = await sessionService.cleanupExpiredSessions();

      logger.info('Authentication maintenance completed', {
        expiredSessions,
      });

      return {
        expiredSessions,
        revokedTokens: 0, // JWT blacklist cleanup would be implemented here
      };

    } catch (error) {
      logger.error('Authentication maintenance failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        expiredSessions: 0,
        revokedTokens: 0,
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();