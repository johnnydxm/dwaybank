/**
 * Comprehensive Authentication API Route Tests
 * Testing all authentication endpoints with security validation
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import authRoutes from '../auth.routes';
import { AuthService } from '../../services/auth.service';
import { SecurityService } from '../../services/security.service';

// Mock dependencies
jest.mock('../../services/auth.service');
jest.mock('../../services/security.service');
jest.mock('pg');

describe('Authentication Routes', () => {
  let app: express.Application;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSecurityService: jest.Mocked<SecurityService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@dwaybank.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    mfaEnabled: false,
  };

  const mockTokens = {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.access',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.refresh',
    expiresIn: 900,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Setup mock services
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refreshTokens: jest.fn(),
      changePassword: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    } as any;

    mockSecurityService = {
      checkRateLimit: jest.fn(),
      logSecurityEvent: jest.fn(),
      detectSuspiciousActivity: jest.fn(),
      validateRequest: jest.fn(),
    } as any;

    // Mock service initialization
    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(() => mockAuthService);
    (SecurityService as jest.MockedClass<typeof SecurityService>).mockImplementation(() => mockSecurityService);
  });

  describe('POST /api/auth/register', () => {
    const registrationData = {
      email: 'newuser@dwaybank.com',
      username: 'newuser',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
    };

    test('should successfully register a new user', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.validateRequest.mockResolvedValue({ valid: true });
      mockAuthService.register.mockResolvedValue({
        success: true,
        user: { ...mockUser, ...registrationData },
        tokens: mockTokens,
      });

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Registration successful',
        user: expect.objectContaining({
          email: registrationData.email,
          username: registrationData.username,
        }),
        tokens: mockTokens,
      });
    });

    test('should validate required fields', async () => {
      // Arrange
      const incompleteData = {
        email: 'test@dwaybank.com',
        // Missing required fields
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'username',
            message: 'Username is required',
          }),
          expect.objectContaining({
            field: 'password',
            message: 'Password is required',
          }),
        ]),
      });
    });

    test('should reject weak passwords', async () => {
      // Arrange
      const weakPasswordData = {
        ...registrationData,
        password: '123',
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('Password must be at least 8 characters'),
          }),
        ]),
      });
    });

    test('should enforce rate limiting', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 300,
      });

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData);

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'Too many requests',
        retryAfter: 300,
      });
      expect(response.headers['retry-after']).toBe('300');
    });

    test('should handle duplicate email registration', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.validateRequest.mockResolvedValue({ valid: true });
      mockAuthService.register.mockResolvedValue({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    });

    test('should sanitize input data', async () => {
      // Arrange
      const maliciousData = {
        email: 'test@dwaybank.com',
        username: '<script>alert("xss")</script>',
        password: 'SecurePass123!',
        firstName: '<img src=x onerror=alert(1)>',
        lastName: 'User',
      };

      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.validateRequest.mockResolvedValue({ valid: true });

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid characters detected');
    });
  });

  describe('POST /api/auth/login', () => {
    const loginData = {
      email: 'test@dwaybank.com',
      password: 'SecurePass123!',
    };

    test('should successfully authenticate valid user', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue({
        suspicious: false,
        riskScore: 0.1,
      });
      mockAuthService.login.mockResolvedValue({
        success: true,
        user: mockUser,
        tokens: mockTokens,
        requiresMFA: false,
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        user: mockUser,
        tokens: mockTokens,
        requiresMFA: false,
      });
    });

    test('should require MFA for MFA-enabled users', async () => {
      // Arrange
      const mfaUser = { ...mockUser, mfaEnabled: true };
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue({
        suspicious: false,
        riskScore: 0.1,
      });
      mockAuthService.login.mockResolvedValue({
        success: true,
        user: mfaUser,
        requiresMFA: true,
        mfaChallenge: 'mfa-challenge-token',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'MFA required',
        requiresMFA: true,
        mfaChallenge: 'mfa-challenge-token',
      });
    });

    test('should reject invalid credentials', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue({
        suspicious: false,
        riskScore: 0.1,
      });
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    test('should detect and block suspicious login attempts', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({ allowed: true });
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue({
        suspicious: true,
        riskScore: 0.9,
        reasons: ['UNUSUAL_LOCATION', 'SUSPICIOUS_USER_AGENT'],
        recommendation: 'BLOCK',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .set('User-Agent', 'curl/7.68.0');

      // Assert
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Suspicious activity detected',
        code: 'SUSPICIOUS_ACTIVITY',
        reasons: ['UNUSUAL_LOCATION', 'SUSPICIOUS_USER_AGENT'],
      });
    });

    test('should enforce rate limiting on failed attempts', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 300,
        reason: 'Too many failed login attempts',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'Too many failed login attempts',
        retryAfter: 300,
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    const refreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.refresh';

    test('should successfully refresh valid tokens', async () => {
      // Arrange
      mockAuthService.refreshTokens.mockResolvedValue({
        success: true,
        tokens: mockTokens,
      });

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Tokens refreshed successfully',
        tokens: mockTokens,
      });
    });

    test('should reject invalid refresh tokens', async () => {
      // Arrange
      mockAuthService.refreshTokens.mockResolvedValue({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN',
      });
    });

    test('should require refresh token in request body', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'refreshToken',
            message: 'Refresh token is required',
          }),
        ]),
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    const refreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.refresh';

    test('should successfully logout user', async () => {
      // Arrange
      mockAuthService.logout.mockResolvedValue({
        success: true,
        message: 'Successfully logged out',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Successfully logged out',
      });
    });

    test('should handle logout with invalid token gracefully', async () => {
      // Arrange
      mockAuthService.logout.mockResolvedValue({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'invalid-token' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    });
  });

  describe('PUT /api/auth/change-password', () => {
    const changePasswordData = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
    };

    test('should successfully change password with valid credentials', async () => {
      // Arrange
      mockAuthService.changePassword.mockResolvedValue({
        success: true,
        message: 'Password updated successfully',
      });

      // Act
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', 'Bearer valid-access-token')
        .send(changePasswordData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password updated successfully',
      });
    });

    test('should validate password strength requirements', async () => {
      // Arrange
      const weakPasswordData = {
        currentPassword: 'OldPass123!',
        newPassword: '123',
      };

      // Act
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', 'Bearer valid-access-token')
        .send(weakPasswordData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'newPassword',
            message: expect.stringContaining('Password must be at least 8 characters'),
          }),
        ]),
      });
    });

    test('should require authentication', async () => {
      // Act
      const response = await request(app)
        .put('/api/auth/change-password')
        .send(changePasswordData);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should initiate password reset process', async () => {
      // Arrange
      const resetData = { email: 'test@dwaybank.com' };
      mockAuthService.forgotPassword.mockResolvedValue({
        success: true,
        message: 'Password reset instructions sent to your email',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send(resetData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password reset instructions sent to your email',
      });
    });

    test('should validate email format', async () => {
      // Arrange
      const invalidEmailData = { email: 'invalid-email' };

      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send(invalidEmailData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Please provide a valid email address',
          }),
        ]),
      });
    });

    test('should enforce rate limiting for password reset requests', async () => {
      // Arrange
      mockSecurityService.checkRateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 300,
      });

      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@dwaybank.com' });

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'Too many password reset requests',
        retryAfter: 300,
      });
    });
  });

  describe('POST /api/auth/verify-email', () => {
    test('should successfully verify email with valid token', async () => {
      // Arrange
      const verificationData = { token: 'valid-verification-token' };
      mockAuthService.verifyEmail.mockResolvedValue({
        success: true,
        message: 'Email verified successfully',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send(verificationData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Email verified successfully',
      });
    });

    test('should reject invalid verification token', async () => {
      // Arrange
      const verificationData = { token: 'invalid-token' };
      mockAuthService.verifyEmail.mockResolvedValue({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });

      // Act
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send(verificationData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });
    });
  });

  describe('Security Headers and CORS', () => {
    test('should include security headers in all responses', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@dwaybank.com',
          password: 'SecurePass123!',
        });

      // Assert
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    test('should handle CORS preflight requests', async () => {
      // Act
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://dwaybank.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      // Assert
      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Error Handling', () => {
    test('should handle service unavailability gracefully', async () => {
      // Arrange
      mockAuthService.login.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@dwaybank.com',
          password: 'SecurePass123!',
        });

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    test('should not expose internal error details', async () => {
      // Arrange
      mockAuthService.login.mockRejectedValue(new Error('Database connection string exposed'));

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@dwaybank.com',
          password: 'SecurePass123!',
        });

      // Assert
      expect(response.status).toBe(503);
      expect(response.body.error).not.toContain('Database connection string');
      expect(response.body.error).toBe('Service temporarily unavailable');
    });
  });
});