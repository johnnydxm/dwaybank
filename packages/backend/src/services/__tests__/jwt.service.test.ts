/**
 * JWT Service Tests
 * Testing core JWT functionality
 */

import jwt from 'jsonwebtoken';
import { JWTService } from '../jwt.service';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../config/environment', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-32-characters-minimum-for-testing',
      refreshSecret: 'test-refresh-secret-32-characters-minimum-for-testing',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      algorithm: 'HS384',
    },
  },
}));

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockJwt: jest.Mocked<typeof jwt>;

  const mockUser = {
    id: 'user-123',
    email: 'test@dwaybank.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwt = jwt as jest.Mocked<typeof jwt>;
    jwtService = new JWTService();
  });

  describe('Configuration', () => {
    test('should initialize with valid configuration', () => {
      expect(jwtService).toBeDefined();
    });

    test('should throw error with missing JWT secret', () => {
      // Mock missing secret
      jest.doMock('../../config/environment', () => ({
        config: {
          jwt: {
            secret: '',
            refreshSecret: 'test-refresh-secret-32-characters-minimum-for-testing',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            algorithm: 'HS384',
          },
        },
      }));

      expect(() => new JWTService()).toThrow('JWT_SECRET environment variable is required');
    });
  });

  describe('Token Generation', () => {
    test('should generate token pair successfully', () => {
      // Arrange
      const accessToken = 'generated-access-token';
      const refreshToken = 'generated-refresh-token';

      mockJwt.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      // Act
      const result = jwtService.generateTokenPair(mockUser, {
        sessionId: 'session-123',
        tokenFamily: 'family-123',
        scope: ['read', 'write'],
      });

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900,
        token_type: 'Bearer',
        scope: ['read', 'write'],
      });
    });
  });

  describe('Token Validation', () => {
    test('should validate access token successfully', async () => {
      // Arrange
      const mockPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 900,
        scope: ['read', 'write'],
        session_id: 'session-123',
        token_type: 'access',
        jti: 'token-123',
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);

      // Act
      const result = await jwtService.validateAccessToken('valid-token');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.payload).toEqual({
        sub: mockUser.id,
        email: mockUser.email,
        iat: mockPayload.iat,
        exp: mockPayload.exp,
        scope: ['read', 'write'],
        session_id: 'session-123',
      });
    });

    test('should reject expired token', async () => {
      // Arrange
      const expiredError = new jwt.TokenExpiredError('Token expired', new Date());
      mockJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      // Act
      const result = await jwtService.validateAccessToken('expired-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.error).toBe('Token expired');
    });
  });
});