/**
 * Authentication Service Comprehensive Test Suite
 * Tests user registration, login, password management, and security features
 */

import { AuthService } from '../../services/auth.service';
import { JWTService } from '../../services/jwt.service';
import { SecurityService } from '../../services/security.service';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: any;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockSecurityService: jest.Mocked<SecurityService>;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      release: jest.fn(),
    };

    // Mock JWT service
    mockJWTService = {
      generateTokens: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeToken: jest.fn(),
    } as any;

    // Mock Security service
    mockSecurityService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      generateSecureToken: jest.fn(),
      validatePasswordStrength: jest.fn(),
      detectAnomalousLogin: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;

    authService = new AuthService(mockDb, mockJWTService, mockSecurityService);
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@dwaybank.com',
        username: 'testuser',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Email not exists check
        .mockResolvedValueOnce({ rows: [] }) // Username not exists check
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'user-123', 
            email: userData.email,
            username: userData.username,
            created_at: new Date(),
          }] 
        }); // Insert user

      mockSecurityService.validatePasswordStrength.mockReturnValue({ 
        isValid: true, 
        score: 4,
        feedback: [] 
      });
      mockSecurityService.hashPassword.mockResolvedValue('$2b$12$hashedpassword');
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'user_registered',
        userId: 'user-123',
        ip: expect.any(String),
        userAgent: expect.any(String),
      });
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@dwaybank.com',
        username: 'newuser',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-user', email: userData.email }] 
      });

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(result.errorCode).toBe('EMAIL_EXISTS');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@dwaybank.com',
        username: 'testuser',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Email not exists
        .mockResolvedValueOnce({ rows: [] }); // Username not exists

      mockSecurityService.validatePasswordStrength.mockReturnValue({ 
        isValid: false, 
        score: 1,
        feedback: ['Password too short', 'Add uppercase letters', 'Add special characters'] 
      });

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password does not meet security requirements');
      expect(result.passwordFeedback).toBeDefined();
    });

    it('should handle database errors during registration', async () => {
      const userData = {
        email: 'test@dwaybank.com',
        username: 'testuser',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
      expect(result.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('User Authentication', () => {
    it('should authenticate user with valid credentials', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        username: 'testuser',
        password_hash: '$2b$12$hashedpassword',
        is_email_verified: true,
        mfa_enabled: false,
        account_status: 'active',
        failed_login_attempts: 0,
        last_login: null,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockSecurityService.verifyPassword.mockResolvedValue(true);
      mockSecurityService.detectAnomalousLogin.mockResolvedValue({ 
        isAnomalous: false, 
        riskScore: 0.2 
      });
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.requiresMFA).toBe(false);
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'user_login_success',
        userId: 'user-123',
        ip: loginData.ip,
        userAgent: loginData.userAgent,
      });
    });

    it('should reject authentication with invalid password', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'WrongPassword',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password_hash: '$2b$12$hashedpassword',
        is_email_verified: true,
        failed_login_attempts: 2,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockSecurityService.verifyPassword.mockResolvedValue(false);

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.errorCode).toBe('INVALID_CREDENTIALS');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'user_login_failed',
        userId: 'user-123',
        reason: 'invalid_password',
        ip: loginData.ip,
        userAgent: loginData.userAgent,
      });
    });

    it('should lock account after multiple failed attempts', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'WrongPassword',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password_hash: '$2b$12$hashedpassword',
        is_email_verified: true,
        failed_login_attempts: 4, // One more will lock the account
        account_status: 'active',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] }); // Account lock update

      mockSecurityService.verifyPassword.mockResolvedValue(false);

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account temporarily locked due to multiple failed login attempts');
      expect(result.errorCode).toBe('ACCOUNT_LOCKED');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'account_locked',
        userId: 'user-123',
        reason: 'max_failed_attempts',
        ip: loginData.ip,
        userAgent: loginData.userAgent,
      });
    });

    it('should require MFA for users with MFA enabled', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password_hash: '$2b$12$hashedpassword',
        is_email_verified: true,
        mfa_enabled: true,
        account_status: 'active',
        failed_login_attempts: 0,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockSecurityService.verifyPassword.mockResolvedValue(true);
      mockSecurityService.detectAnomalousLogin.mockResolvedValue({ 
        isAnomalous: false, 
        riskScore: 0.1 
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(true);
      expect(result.requiresMFA).toBe(true);
      expect(result.mfaToken).toBeDefined();
      expect(result.tokens).toBeUndefined(); // No tokens until MFA is completed
    });

    it('should detect and handle anomalous login attempts', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
        ip: '203.0.113.1', // Different IP from usual
        userAgent: 'Suspicious Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password_hash: '$2b$12$hashedpassword',
        is_email_verified: true,
        mfa_enabled: false,
        account_status: 'active',
        failed_login_attempts: 0,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockSecurityService.verifyPassword.mockResolvedValue(true);
      mockSecurityService.detectAnomalousLogin.mockResolvedValue({ 
        isAnomalous: true, 
        riskScore: 0.8,
        reasons: ['unusual_location', 'new_device'] 
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(true);
      expect(result.requiresAdditionalVerification).toBe(true);
      expect(result.verificationMethod).toBe('email');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'anomalous_login_detected',
        userId: 'user-123',
        riskScore: 0.8,
        reasons: ['unusual_location', 'new_device'],
        ip: loginData.ip,
        userAgent: loginData.userAgent,
      });
    });
  });

  describe('Password Management', () => {
    it('should reset password successfully', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'NewSecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@dwaybank.com',
        password_reset_token: 'valid-reset-token',
        password_reset_expires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by token
        .mockResolvedValueOnce({ rows: [] }); // Update password

      mockSecurityService.validatePasswordStrength.mockReturnValue({ 
        isValid: true, 
        score: 4,
        feedback: [] 
      });
      mockSecurityService.hashPassword.mockResolvedValue('$2b$12$newhashedpassword');

      const result = await authService.resetPassword(resetData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'password_reset_success',
        userId: 'user-123',
        ip: resetData.ip,
        userAgent: resetData.userAgent,
      });
    });

    it('should reject password reset with expired token', async () => {
      const resetData = {
        token: 'expired-reset-token',
        newPassword: 'NewSecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@dwaybank.com',
        password_reset_token: 'expired-reset-token',
        password_reset_expires: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authService.resetPassword(resetData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password reset token has expired');
      expect(result.errorCode).toBe('TOKEN_EXPIRED');
    });

    it('should change password for authenticated user', async () => {
      const changeData = {
        userId: 'user-123',
        currentPassword: 'OldSecurePass123!',
        newPassword: 'NewSecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        password_hash: '$2b$12$oldhashedpassword',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Get current user
        .mockResolvedValueOnce({ rows: [] }); // Update password

      mockSecurityService.verifyPassword.mockResolvedValue(true);
      mockSecurityService.validatePasswordStrength.mockReturnValue({ 
        isValid: true, 
        score: 4,
        feedback: [] 
      });
      mockSecurityService.hashPassword.mockResolvedValue('$2b$12$newhashedpassword');

      const result = await authService.changePassword(changeData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'password_changed',
        userId: 'user-123',
        ip: changeData.ip,
        userAgent: changeData.userAgent,
      });
    });
  });

  describe('Session Management', () => {
    it('should logout user and revoke tokens', async () => {
      const logoutData = {
        userId: 'user-123',
        refreshToken: 'refresh-token-to-revoke',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      mockJWTService.revokeToken.mockResolvedValue(true);

      const result = await authService.logoutUser(logoutData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
      expect(mockJWTService.revokeToken).toHaveBeenCalledWith(logoutData.refreshToken);
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'user_logout',
        userId: 'user-123',
        ip: logoutData.ip,
        userAgent: logoutData.userAgent,
      });
    });

    it('should refresh access token with valid refresh token', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockTokenPayload = {
        userId: 'user-123',
        email: 'test@dwaybank.com',
        tokenId: 'token-123',
      };

      mockJWTService.verifyRefreshToken.mockResolvedValue(mockTokenPayload);
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await authService.refreshTokens(refreshData);

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(result.tokens.refreshToken).toBe('new-refresh-token');
    });
  });

  describe('Account Verification', () => {
    it('should verify email with valid token', async () => {
      const verificationData = {
        token: 'valid-verification-token',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@dwaybank.com',
        email_verification_token: 'valid-verification-token',
        email_verification_expires: new Date(Date.now() + 3600000),
        is_email_verified: false,
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by token
        .mockResolvedValueOnce({ rows: [] }); // Update verification status

      const result = await authService.verifyEmail(verificationData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email verified successfully');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'email_verified',
        userId: 'user-123',
        ip: verificationData.ip,
        userAgent: verificationData.userAgent,
      });
    });

    it('should reject email verification with invalid token', async () => {
      const verificationData = {
        token: 'invalid-verification-token',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.verifyEmail(verificationData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired verification token');
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempts in email field', async () => {
      const maliciousData = {
        email: "'; DROP TABLE users; --",
        password: 'test123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      // Should use parameterized queries - no actual injection should occur
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.authenticateUser(maliciousData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('USER_NOT_FOUND');
      // Verify the query was called with proper parameters
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        [maliciousData.email]
      );
    });

    it('should rate limit authentication attempts', async () => {
      const loginData = {
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      // Simulate rate limiting by checking attempt count
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ attempt_count: 10, last_attempt: new Date() }] 
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many login attempts');
      expect(result.errorCode).toBe('RATE_LIMITED');
    });

    it('should validate JWT token structure and prevent tampering', async () => {
      const tamperedToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhZG1pbiJ9.';

      mockJWTService.verifyAccessToken.mockRejectedValue(new Error('Invalid token signature'));

      const result = await authService.validateToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });
  });
});