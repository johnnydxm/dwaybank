/**
 * Authentication Routes Test Suite
 * Comprehensive tests for DwayBank authentication API endpoints
 */

import request from 'supertest';
import { Express } from 'express';
import { performance } from 'perf_hooks';

// Mock the dependencies
jest.mock('../config/database');
jest.mock('../config/logger');
jest.mock('../services/auth.service');
jest.mock('../services/user.service');
jest.mock('../services/email.service');
jest.mock('../services/mfa.service');

import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { emailService } from '../services/email.service';

// Import the app after mocking dependencies
let app: Express;

// Mock data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  status: 'active',
  email_verified: true,
  phone_verified: false,
  kyc_status: 'pending',
  created_at: new Date(),
  last_login: new Date(),
};

const mockTokens = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'Bearer' as const,
  scope: ['read', 'write'],
};

const mockLoginResponse = {
  user: mockUser,
  tokens: mockTokens,
  mfa_required: false,
};

const mockRegisterResponse = {
  user: mockUser,
  verification_required: true,
  message: 'Account created successfully. Please verify your email address.',
};

describe('Authentication Routes', () => {
  beforeAll(async () => {
    // Create a mock Express app for testing
    const express = require('express');
    app = express();
    
    // Import routes after mocking
    const authRoutes = require('../routes/auth.routes').default;
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      confirm_password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe',
      accept_terms: true,
      accept_privacy: true,
    };

    it('should register a new user successfully', async () => {
      // Mock services
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (authService.register as jest.Mock).mockResolvedValue(mockRegisterResponse);
      (emailService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: mockRegisterResponse.message,
        data: {
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            first_name: mockUser.first_name,
            last_name: mockUser.last_name,
          }),
          verification_required: true,
        },
      });

      expect(authService.register).toHaveBeenCalledWith(
        validRegisterData,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        })
      );
    });

    it('should return error for existing user', async () => {
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: 'An account with this email address already exists',
        error: 'USER_ALREADY_EXISTS',
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });

      expect(response.body.validation_errors).toBeInstanceOf(Array);
      expect(response.body.validation_errors.length).toBeGreaterThan(0);
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validRegisterData,
        password: 'password', // Common password
        confirm_password: 'password',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Password is too common',
        error: 'WEAK_PASSWORD',
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!',
      remember_me: false,
    };

    it('should login user successfully without MFA', async () => {
      (authService.login as jest.Mock).mockResolvedValue(mockLoginResponse);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
          }),
          tokens: expect.objectContaining({
            access_token: mockTokens.access_token,
            refresh_token: mockTokens.refresh_token,
          }),
        },
      });
    });

    it('should return MFA challenge when MFA is required', async () => {
      const mfaLoginResponse = {
        ...mockLoginResponse,
        mfa_required: true,
        mfa_methods: [
          {
            id: 'mfa-123',
            method: 'totp',
            isPrimary: true,
          },
        ],
      };

      (authService.login as jest.Mock).mockResolvedValue(mfaLoginResponse);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'MFA verification required',
        data: {
          mfa_required: true,
          mfa_methods: expect.arrayContaining([
            expect.objectContaining({
              method: 'totp',
              isPrimary: true,
            }),
          ]),
        },
      });
    });

    it('should return error for invalid credentials', async () => {
      (authService.login as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS',
      });
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validLoginData,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout user successfully', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(true);
      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer mock-access-token')
        .send()
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful',
      });

      expect(authService.logout).toHaveBeenCalledWith(
        'mock-access-token',
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        }),
        expect.objectContaining({
          allDevices: undefined,
          reason: 'user_logout',
        })
      );
    });

    it('should logout from all devices', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(true);
      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer mock-access-token')
        .send({ all_devices: true })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out from all devices',
      });

      expect(authService.logout).toHaveBeenCalledWith(
        'mock-access-token',
        expect.any(Object),
        expect.objectContaining({
          allDevices: true,
        })
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send()
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token is required',
        error: 'AUTHENTICATION_REQUIRED',
      });
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    const validRefreshData = {
      refresh_token: 'mock-refresh-token',
    };

    it('should refresh tokens successfully', async () => {
      const newTokens = {
        ...mockTokens,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      (authService.refreshTokens as jest.Mock).mockResolvedValue(newTokens);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send(validRefreshData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          tokens: expect.objectContaining({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          }),
        },
      });
    });

    it('should return error for invalid refresh token', async () => {
      (authService.refreshTokens as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send(validRefreshData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should validate refresh token format', async () => {
      const invalidRefreshData = {
        refresh_token: '123', // Too short
      };

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send(invalidRefreshData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should get user profile successfully', async () => {
      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });

      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer mock-access-token')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            first_name: mockUser.first_name,
            last_name: mockUser.last_name,
          }),
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token is required',
        error: 'AUTHENTICATION_REQUIRED',
      });
    });
  });

  describe('PUT /api/v1/auth/profile', () => {
    const validUpdateData = {
      first_name: 'Jane',
      last_name: 'Smith',
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, ...validUpdateData };

      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });
      (userService.updateUser as jest.Mock).mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', 'Bearer mock-access-token')
        .send(validUpdateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: expect.objectContaining({
            first_name: 'Jane',
            last_name: 'Smith',
          }),
        },
      });

      expect(userService.updateUser).toHaveBeenCalledWith(
        mockUser.id,
        validUpdateData
      );
    });

    it('should validate update data', async () => {
      const invalidUpdateData = {
        first_name: '', // Empty string not allowed
        email: 'invalid-email', // Email updates not allowed through this endpoint
      };

      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', 'Bearer mock-access-token')
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    const validPasswordChangeData = {
      current_password: 'OldPassword123!',
      new_password: 'NewPassword123!',
      confirm_password: 'NewPassword123!',
    };

    it('should change password successfully', async () => {
      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });
      (authService.changePassword as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer mock-access-token')
        .send(validPasswordChangeData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully. You have been logged out from all devices.',
      });

      expect(authService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        'OldPassword123!',
        'NewPassword123!',
        expect.any(Object)
      );
    });

    it('should return error for incorrect current password', async () => {
      (authService.validateToken as jest.Mock).mockResolvedValue({
        isValid: true,
        user: mockUser,
        session: { id: 'session-123' },
      });
      (authService.changePassword as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer mock-access-token')
        .send(validPasswordChangeData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Current password is incorrect',
        error: 'INVALID_CURRENT_PASSWORD',
      });
    });

    it('should validate password confirmation', async () => {
      const invalidPasswordData = {
        ...validPasswordChangeData,
        confirm_password: 'DifferentPassword123!',
      };

      const response = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer mock-access-token')
        .send(invalidPasswordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should enforce rate limits on login endpoint', async () => {
      (authService.login as jest.Mock).mockResolvedValue(null);

      // Make multiple requests quickly
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password',
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper error structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
        });
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer mock-access-token');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should validate Content-Type for POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid content type')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Content-Type must be application/json',
        error: 'INVALID_CONTENT_TYPE',
      });
    });
  });

  describe('Performance', () => {
    it('should respond to login requests within reasonable time', async () => {
      (authService.login as jest.Mock).mockResolvedValue(mockLoginResponse);

      const startTime = performance.now();

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Response should be under 1000ms
      expect(responseTime).toBeLessThan(1000);
    });
  });
});