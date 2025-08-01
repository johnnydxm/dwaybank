/**
 * Comprehensive JWT Service Tests
 * Testing JWT token generation, validation, and security features
 */

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { JWTService } from '../jwt.service';
import { config } from '../../config/environment';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('pg');
jest.mock('../../config/environment');

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockPool: jest.Mocked<Pool>;
  let mockJwt: jest.Mocked<typeof jwt>;

  const mockConfig = {
    JWT_SECRET: 'test-jwt-secret-32-characters-minimum',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-characters-minimum',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    JWT_ALGORITHM: 'HS384',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@dwaybank.com',
    username: 'testuser',
    role: 'user',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock config
    (config as any) = mockConfig;

    // Setup mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    // Setup mock JWT
    mockJwt = jwt as jest.Mocked<typeof jwt>;

    // Initialize JWTService
    jwtService = new JWTService();
    (jwtService as any).pool = mockPool;
  });

  describe('Token Generation', () => {
    test('should generate valid access and refresh tokens', async () => {
      // Arrange
      const tokenId = 'token-123';
      const accessToken = 'generated-access-token';
      const refreshToken = 'generated-refresh-token';

      mockJwt.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);
      
      mockPool.query.mockResolvedValue({ rows: [{ id: tokenId }] });

      // Act
      const result = await jwtService.generateTokens(mockUser);

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role,
          type: 'access',
        }),
        mockConfig.JWT_SECRET,
        expect.objectContaining({
          expiresIn: mockConfig.JWT_EXPIRES_IN,
          algorithm: mockConfig.JWT_ALGORITHM,
        })
      );
      expect(result).toEqual({
        accessToken,
        refreshToken,
        tokenId,
        expiresIn: 900, // 15 minutes in seconds
      });
    });

    test('should include session metadata in token payload', async () => {
      // Arrange
      const sessionData = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        deviceId: 'device-123',
      };

      mockJwt.sign.mockReturnValue('token-with-metadata');
      mockPool.query.mockResolvedValue({ rows: [{ id: 'token-123' }] });

      // Act
      await jwtService.generateTokens(mockUser, sessionData);

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          sessionData: expect.objectContaining({
            ip: sessionData.ip,
            userAgent: sessionData.userAgent,
            deviceId: sessionData.deviceId,
          }),
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should store refresh token securely in database', async () => {
      // Arrange
      mockJwt.sign.mockReturnValue('test-token');
      mockPool.query.mockResolvedValue({ rows: [{ id: 'token-123' }] });

      // Act
      await jwtService.generateTokens(mockUser);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([
          expect.any(String), // token_id
          mockUser.id,        // user_id
          expect.any(String), // token_hash
          expect.any(Date),   // expires_at
          expect.any(String), // ip_address
          expect.any(String), // user_agent
        ])
      );
    });
  });

  describe('Token Verification', () => {
    test('should successfully verify valid access token', async () => {
      // Arrange
      const accessToken = 'valid-access-token';
      const decodedPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      mockJwt.verify.mockReturnValue(decodedPayload);

      // Act
      const result = await jwtService.verifyAccessToken(accessToken);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(
        accessToken,
        mockConfig.JWT_SECRET,
        expect.objectContaining({
          algorithms: [mockConfig.JWT_ALGORITHM],
        })
      );
      expect(result).toEqual(decodedPayload);
    });

    test('should reject expired access token', async () => {
      // Arrange
      const expiredToken = 'expired-access-token';
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';

      mockJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      // Act & Assert
      await expect(jwtService.verifyAccessToken(expiredToken))
        .rejects.toThrow('Token expired');
    });

    test('should reject malformed access token', async () => {
      // Arrange
      const malformedToken = 'malformed-token';
      const malformedError = new Error('jwt malformed');
      malformedError.name = 'JsonWebTokenError';

      mockJwt.verify.mockImplementation(() => {
        throw malformedError;
      });

      // Act & Assert
      await expect(jwtService.verifyAccessToken(malformedToken))
        .rejects.toThrow('Invalid token');
    });

    test('should successfully verify valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'token-123',
          user_id: mockUser.id,
          is_revoked: false,
          expires_at: new Date(Date.now() + 604800000),
        }],
      });

      // Act
      const result = await jwtService.verifyRefreshToken(refreshToken);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(
        refreshToken,
        mockConfig.JWT_REFRESH_SECRET,
        expect.objectContaining({
          algorithms: [mockConfig.JWT_ALGORITHM],
        })
      );
      expect(result).toEqual(decodedPayload);
    });

    test('should reject revoked refresh token', async () => {
      // Arrange
      const revokedToken = 'revoked-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'token-123',
          user_id: mockUser.id,
          is_revoked: true,
          expires_at: new Date(Date.now() + 604800000),
        }],
      });

      // Act & Assert
      await expect(jwtService.verifyRefreshToken(revokedToken))
        .rejects.toThrow('Token has been revoked');
    });

    test('should reject refresh token not found in database', async () => {
      // Arrange
      const unknownToken = 'unknown-refresh-token';
      const decodedPayload = {
        tokenId: 'unknown-token',
        userId: mockUser.id,
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(jwtService.verifyRefreshToken(unknownToken))
        .rejects.toThrow('Token not found');
    });
  });

  describe('Token Revocation', () => {
    test('should successfully revoke refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      // Act
      const result = await jwtService.revokeToken(refreshToken);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(
        refreshToken,
        mockConfig.JWT_REFRESH_SECRET,
        expect.any(Object)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true'),
        [decodedPayload.tokenId]
      );
      expect(result).toBe(true);
    });

    test('should handle token revocation failure', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      // Act
      const result = await jwtService.revokeToken(refreshToken);

      // Assert
      expect(result).toBe(false);
    });

    test('should revoke all user tokens', async () => {
      // Arrange
      const userId = mockUser.id;
      mockPool.query.mockResolvedValue({ rowCount: 3 });

      // Act
      const result = await jwtService.revokeAllUserTokens(userId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1'),
        [userId]
      );
      expect(result).toBe(3);
    });
  });

  describe('Token Security', () => {
    test('should detect token replay attacks', async () => {
      // Arrange
      const suspiciousToken = 'suspicious-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        sessionData: { ip: '192.168.1.1' },
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'token-123',
            user_id: mockUser.id,
            is_revoked: false,
            expires_at: new Date(Date.now() + 604800000),
            last_used_ip: '192.168.1.100', // Different IP
            last_used_at: new Date(Date.now() - 1000),
          }],
        });

      // Act & Assert
      await expect(jwtService.verifyRefreshToken(suspiciousToken, {
        ip: '10.0.0.1', // Suspicious IP change
        userAgent: 'Different Browser',
      })).rejects.toThrow('Suspicious token usage detected');
    });

    test('should enforce token rotation policy', async () => {
      // Arrange
      const oldRefreshToken = 'old-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000) - 86400, // 1 day old
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'token-123',
          user_id: mockUser.id,
          is_revoked: false,
          expires_at: new Date(Date.now() + 604800000),
          created_at: new Date(Date.now() - 86400000), // 1 day old
        }],
      });

      // Act
      const result = await jwtService.verifyRefreshToken(oldRefreshToken);

      // Assert
      expect(result).toHaveProperty('requiresRotation', true);
    });

    test('should validate token issuer and audience', async () => {
      // Arrange
      const tokenWithWrongIssuer = 'token-wrong-issuer';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('jwt issuer invalid');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      // Act & Assert
      await expect(jwtService.verifyAccessToken(tokenWithWrongIssuer))
        .rejects.toThrow('Invalid token');
    });
  });

  describe('Token Cleanup', () => {
    test('should clean up expired refresh tokens', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({ rowCount: 5 });

      // Act
      const result = await jwtService.cleanupExpiredTokens();

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens WHERE expires_at < NOW()')
      );
      expect(result).toBe(5);
    });

    test('should get active session count for user', async () => {
      // Arrange
      const userId = mockUser.id;
      mockPool.query.mockResolvedValue({
        rows: [{ count: '3' }],
      });

      // Act
      const result = await jwtService.getActiveSessionCount(userId);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM refresh_tokens'),
        [userId]
      );
      expect(result).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors during token generation', async () => {
      // Arrange
      mockJwt.sign.mockReturnValue('test-token');
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(jwtService.generateTokens(mockUser))
        .rejects.toThrow('Failed to store refresh token');
    });

    test('should handle invalid JWT secret configuration', async () => {
      // Arrange
      (config as any) = { ...mockConfig, JWT_SECRET: '' };
      
      // Act & Assert
      await expect(jwtService.generateTokens(mockUser))
        .rejects.toThrow('JWT configuration error');
    });

    test('should handle token verification with corrupted database state', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        tokenId: 'token-123',
        userId: mockUser.id,
        type: 'refresh',
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      mockPool.query.mockRejectedValue(new Error('Database query failed'));

      // Act & Assert
      await expect(jwtService.verifyRefreshToken(refreshToken))
        .rejects.toThrow('Token verification failed');
    });
  });
});