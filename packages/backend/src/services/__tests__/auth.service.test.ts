/**
 * Comprehensive Authentication Service Tests
 * Testing all authentication, registration, and session management functionality
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { JWTService } from '../jwt.service';
import { UserService } from '../user.service';
import { SecurityService } from '../security.service';

// Mock dependencies
jest.mock('pg');
jest.mock('bcryptjs');
jest.mock('../jwt.service');
jest.mock('../user.service');
jest.mock('../security.service');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPool: jest.Mocked<Pool>;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockSecurityService: jest.Mocked<SecurityService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@dwaybank.com',
    username: 'testuser',
    hashedPassword: '$2b$10$hashedpassword',
    isEmailVerified: true,
    mfaEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock pool
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    } as any;

    // Setup mock services
    mockJWTService = {
      generateTokens: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeToken: jest.fn(),
    } as any;

    mockUserService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockSecurityService = {
      checkSecurityLimits: jest.fn(),
      logSecurityEvent: jest.fn(),
      detectSuspiciousActivity: jest.fn(),
    } as any;

    // Initialize AuthService with mocked dependencies
    authService = new AuthService();
    (authService as any).pool = mockPool;
    (authService as any).jwtService = mockJWTService;
    (authService as any).userService = mockUserService;
    (authService as any).securityService = mockSecurityService;
  });

  describe('User Registration', () => {
    const registrationData = {
      email: 'newuser@dwaybank.com',
      username: 'newuser',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
    };

    test('should successfully register a new user', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
      mockUserService.create.mockResolvedValue({ ...mockUser, ...registrationData });
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      // Act
      const result = await authService.register(registrationData);

      // Assert
      expect(mockUserService.findByEmail).toHaveBeenCalledWith(registrationData.email);
      expect(mockUserService.findByUsername).toHaveBeenCalledWith(registrationData.username);
      expect(bcrypt.hash).toHaveBeenCalledWith(registrationData.password, 10);
      expect(result).toEqual({
        success: true,
        user: expect.objectContaining({
          email: registrationData.email,
          username: registrationData.username,
        }),
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    test('should reject registration with existing email', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await authService.register(registrationData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    });

    test('should reject registration with existing username', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue(mockUser);

      // Act
      const result = await authService.register(registrationData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Username already taken',
        code: 'USERNAME_EXISTS',
      });
    });

    test('should validate password strength requirements', async () => {
      // Arrange
      const weakPasswordData = { ...registrationData, password: '123' };

      // Act
      const result = await authService.register(weakPasswordData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Password does not meet security requirements',
        code: 'WEAK_PASSWORD',
      });
    });

    test('should validate email format', async () => {
      // Arrange
      const invalidEmailData = { ...registrationData, email: 'invalid-email' };

      // Act
      const result = await authService.register(invalidEmailData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    });
  });

  describe('User Authentication', () => {
    const loginData = {
      email: 'test@dwaybank.com',
      password: 'SecurePass123!',
    };

    test('should successfully authenticate valid user', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockSecurityService.checkSecurityLimits.mockResolvedValue({ allowed: true });
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(mockUserService.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.hashedPassword);
      expect(result).toEqual({
        success: true,
        user: mockUser,
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
        requiresMFA: false,
      });
    });

    test('should reject authentication with invalid email', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    test('should reject authentication with invalid password', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    test('should enforce rate limiting on failed attempts', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockSecurityService.checkSecurityLimits.mockResolvedValue({
        allowed: false,
        reason: 'Too many failed attempts',
        retryAfter: 300,
      });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Too many failed attempts',
        code: 'RATE_LIMITED',
        retryAfter: 300,
      });
    });

    test('should require MFA for MFA-enabled users', async () => {
      // Arrange
      const mfaUser = { ...mockUser, mfaEnabled: true };
      mockUserService.findByEmail.mockResolvedValue(mfaUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockSecurityService.checkSecurityLimits.mockResolvedValue({ allowed: true });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toEqual({
        success: true,
        user: mfaUser,
        requiresMFA: true,
        mfaChallenge: expect.any(String),
      });
    });
  });

  describe('Token Management', () => {
    test('should successfully refresh valid tokens', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockJWTService.verifyRefreshToken.mockResolvedValue({
        userId: mockUser.id,
        tokenId: 'token-123',
      });
      mockUserService.findById.mockResolvedValue(mockUser);
      mockJWTService.generateTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      // Act
      const result = await authService.refreshTokens(refreshToken);

      // Assert
      expect(mockJWTService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        success: true,
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });
    });

    test('should reject invalid refresh tokens', async () => {
      // Arrange
      const invalidToken = 'invalid-refresh-token';
      mockJWTService.verifyRefreshToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      const result = await authService.refreshTokens(invalidToken);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN',
      });
    });

    test('should successfully logout and revoke tokens', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockJWTService.revokeToken.mockResolvedValue(true);

      // Act
      const result = await authService.logout(refreshToken);

      // Assert
      expect(mockJWTService.revokeToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out',
      });
    });
  });

  describe('Password Management', () => {
    test('should successfully change password with valid current password', async () => {
      // Arrange
      const changeData = {
        userId: mockUser.id,
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      };
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhashedpassword');
      mockUserService.update.mockResolvedValue({ ...mockUser, hashedPassword: '$2b$10$newhashedpassword' });

      // Act
      const result = await authService.changePassword(changeData);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(changeData.currentPassword, mockUser.hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(changeData.newPassword, 10);
      expect(result).toEqual({
        success: true,
        message: 'Password updated successfully',
      });
    });

    test('should reject password change with invalid current password', async () => {
      // Arrange
      const changeData = {
        userId: mockUser.id,
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!',
      };
      mockUserService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await authService.changePassword(changeData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      });
    });

    test('should validate new password strength', async () => {
      // Arrange
      const changeData = {
        userId: mockUser.id,
        currentPassword: 'OldPass123!',
        newPassword: '123', // Weak password
      };

      // Act
      const result = await authService.changePassword(changeData);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'New password does not meet security requirements',
        code: 'WEAK_PASSWORD',
      });
    });
  });

  describe('Email Verification', () => {
    test('should successfully verify email with valid token', async () => {
      // Arrange
      const verificationToken = 'valid-verification-token';
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      mockPool.query.mockResolvedValue({
        rows: [{ userId: mockUser.id, token: verificationToken }],
      });
      mockUserService.findById.mockResolvedValue(unverifiedUser);
      mockUserService.update.mockResolvedValue({ ...unverifiedUser, isEmailVerified: true });

      // Act
      const result = await authService.verifyEmail(verificationToken);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Email verified successfully',
      });
    });

    test('should reject invalid verification token', async () => {
      // Arrange
      const invalidToken = 'invalid-verification-token';
      mockPool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await authService.verifyEmail(invalidToken);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });
    });
  });

  describe('Security and Validation', () => {
    test('should log security events for suspicious activities', async () => {
      // Arrange
      const suspiciousLogin = {
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
        ip: '192.168.1.100',
        userAgent: 'Suspicious Browser',
      };
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue(true);
      mockSecurityService.checkSecurityLimits.mockResolvedValue({ allowed: true });

      // Act
      const result = await authService.login(suspiciousLogin);

      // Assert
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'SUSPICIOUS_LOGIN',
        userId: mockUser.id,
        ip: suspiciousLogin.ip,
        userAgent: suspiciousLogin.userAgent,
      });
    });

    test('should sanitize input data', async () => {
      // Arrange
      const maliciousData = {
        email: '<script>alert("xss")</script>@test.com',
        username: 'user<script>',
        password: 'SecurePass123!',
        firstName: '<img src=x onerror=alert(1)>',
        lastName: 'User',
      };

      // Act
      const result = await authService.register(maliciousData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('should enforce session limits per user', async () => {
      // Arrange
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockSecurityService.checkSecurityLimits.mockResolvedValue({
        allowed: false,
        reason: 'Maximum sessions exceeded',
      });

      // Act
      const result = await authService.login({
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
      });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Maximum sessions exceeded',
        code: 'SESSION_LIMIT_EXCEEDED',
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Arrange
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await authService.login({
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
      });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Authentication service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    test('should handle service dependency failures', async () => {
      // Arrange
      mockUserService.findByEmail.mockRejectedValue(new Error('User service failed'));

      // Act
      const result = await authService.login({
        email: 'test@dwaybank.com',
        password: 'SecurePass123!',
      });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Authentication service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});