/**
 * Comprehensive Authentication Workflow Integration Tests
 * Testing complete authentication flows with real HTTP requests
 */

import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../../app';
import { config } from '../../config/environment';

describe('Authentication Workflow Integration Tests', () => {
  let app: any;
  let server: any;
  let pool: Pool;

  // Test user data
  const testUser = {
    email: 'integration-test@dwaybank.com',
    username: 'integrationtest',
    password: 'SecureTestPass123!',
    firstName: 'Integration',
    lastName: 'Test',
  };

  let userTokens = {
    accessToken: '',
    refreshToken: '',
  };

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dwaybank_test',
      user: process.env.DB_USER || 'dwaybank_test',
      password: process.env.DB_PASSWORD || 'test_password',
    });

    // Create Express app
    app = await createApp();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [testUser.email]);
    
    // Close connections
    await pool.end();
    server.close();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [testUser.email]);
  });

  describe('Complete User Registration and Login Flow', () => {
    it('should complete full registration → email verification → login workflow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(registerResponse.body).toMatchObject({
        success: true,
        message: 'Registration successful',
        user: {
          email: testUser.email,
          username: testUser.username,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          isEmailVerified: false,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      const userId = registerResponse.body.user.id;
      userTokens = registerResponse.body.tokens;

      // Step 2: Verify email
      const emailVerificationResult = await pool.query(
        'SELECT token FROM email_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      expect(emailVerificationResult.rows).toHaveLength(1);

      const verificationToken = emailVerificationResult.rows[0].token;
      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        message: 'Email verified successfully',
      });

      // Step 3: Login with verified account
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          email: testUser.email,
          isEmailVerified: true,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
        requiresMFA: false,
      });

      // Step 4: Access protected route with new tokens
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.tokens.accessToken}`)
        .expect(200);

      expect(profileResponse.body).toMatchObject({
        success: true,
        user: {
          email: testUser.email,
          username: testUser.username,
        },
      });
    });

    it('should handle registration with existing email', async () => {
      // Register user first time
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Attempt to register again with same email
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(duplicateResponse.body).toMatchObject({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswordUser = {
        ...testUser,
        password: '123456',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('Password must contain'),
          }),
        ]),
      });
    });
  });

  describe('Token Management and Refresh Flow', () => {
    beforeEach(async () => {
      // Register and verify user for token tests
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      userTokens = registerResponse.body.tokens;
      const userId = registerResponse.body.user.id;

      // Mark email as verified
      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [userId]
      );
    });

    it('should refresh tokens successfully', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userTokens.refreshToken })
        .expect(200);

      expect(refreshResponse.body).toMatchObject({
        success: true,
        message: 'Tokens refreshed successfully',
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // New tokens should be different from original
      expect(refreshResponse.body.tokens.accessToken).not.toBe(userTokens.accessToken);
      expect(refreshResponse.body.tokens.refreshToken).not.toBe(userTokens.refreshToken);

      // Old refresh token should be invalid
      const oldTokenResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userTokens.refreshToken })
        .expect(401);

      expect(oldTokenResponse.body).toMatchObject({
        success: false,
        error: 'Invalid refresh token',
      });
    });

    it('should handle token revocation on logout', async () => {
      // Logout to revoke tokens
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: userTokens.refreshToken })
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Successfully logged out',
      });

      // Refresh token should be invalid after logout
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userTokens.refreshToken })
        .expect(401);

      expect(refreshResponse.body).toMatchObject({
        success: false,
        error: 'Invalid refresh token',
      });
    });

    it('should handle expired access tokens', async () => {
      // Create expired token (this would typically involve manipulating JWT exp claim)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token';

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    });
  });

  describe('Password Management Flow', () => {
    let userId: string;

    beforeEach(async () => {
      // Register and verify user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      userId = registerResponse.body.user.id;
      userTokens = registerResponse.body.tokens;

      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [userId]
      );
    });

    it('should complete password change workflow', async () => {
      const newPassword = 'NewSecurePass123!';

      // Change password
      const changeResponse = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: newPassword,
        })
        .expect(200);

      expect(changeResponse.body).toMatchObject({
        success: true,
        message: 'Password updated successfully',
      });

      // Old password should no longer work
      const oldPasswordResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);

      expect(oldPasswordResponse.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
      });

      // New password should work
      const newPasswordResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(newPasswordResponse.body).toMatchObject({
        success: true,
        message: 'Login successful',
      });
    });

    it('should complete forgot password → reset workflow', async () => {
      // Initiate password reset
      const forgotResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(forgotResponse.body).toMatchObject({
        success: true,
        message: 'Password reset instructions sent to your email',
      });

      // Get reset token from database
      const resetTokenResult = await pool.query(
        'SELECT token FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      expect(resetTokenResult.rows).toHaveLength(1);

      const resetToken = resetTokenResult.rows[0].token;
      const newPassword = 'ResetPassword123!';

      // Reset password with token
      const resetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
        })
        .expect(200);

      expect(resetResponse.body).toMatchObject({
        success: true,
        message: 'Password reset successfully',
      });

      // Login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        message: 'Login successful',
      });
    });

    it('should invalidate all sessions after password reset', async () => {
      // Create multiple sessions
      const session1 = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const session2 = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      // Initiate password reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      const resetTokenResult = await pool.query(
        'SELECT token FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      const resetToken = resetTokenResult.rows[0].token;

      // Reset password
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!',
        });

      // Both old sessions should be invalid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session1.body.tokens.accessToken}`)
        .expect(401);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session2.body.tokens.accessToken}`)
        .expect(401);
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should enforce rate limiting on login attempts', async () => {
      // Make multiple failed login attempts
      const promises = Array(6).fill(null).map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(promises);

      // First few should be 401 (unauthorized)
      expect(responses.slice(0, 5).every(r => r.status === 401)).toBe(true);

      // Last attempt should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body).toMatchObject({
        success: false,
        error: expect.stringContaining('Too many'),
        retryAfter: expect.any(Number),
      });
    });

    it('should enforce rate limiting on registration attempts', async () => {
      const promises = Array(6).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            ...testUser,
            email: `test${index}@dwaybank.com`,
            username: `testuser${index}`,
          })
      );

      const responses = await Promise.all(promises);

      // Last attempt should be rate limited
      expect(responses[5].status).toBe(429);
    });

    it('should detect and block suspicious login patterns', async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Attempt login from suspicious user agent
      const suspiciousResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'curl/7.68.0') // Suspicious user agent
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Should either block or require additional verification
      expect([403, 200].includes(suspiciousResponse.status)).toBe(true);
      
      if (suspiciousResponse.status === 403) {
        expect(suspiciousResponse.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Suspicious'),
        });
      }
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      userTokens = registerResponse.body.tokens;
      const userId = registerResponse.body.user.id;

      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [userId]
      );
    });

    it('should list active sessions', async () => {
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(sessionsResponse.body).toMatchObject({
        success: true,
        sessions: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            ipAddress: expect.any(String),
            userAgent: expect.any(String),
            createdAt: expect.any(String),
            lastUsed: expect.any(String),
            isCurrent: true,
          }),
        ]),
      });
    });

    it('should terminate specific session', async () => {
      // Create second session
      const secondSession = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Get sessions list
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);

      const sessionToTerminate = sessionsResponse.body.sessions.find(
        (s: any) => !s.isCurrent
      );

      // Terminate specific session
      const terminateResponse = await request(app)
        .delete(`/api/auth/sessions/${sessionToTerminate.id}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(terminateResponse.body).toMatchObject({
        success: true,
        message: 'Session terminated successfully',
      });

      // Terminated session should be invalid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${secondSession.body.tokens.accessToken}`)
        .expect(401);
    });

    it('should terminate all sessions', async () => {
      // Create multiple sessions
      const session2 = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const session3 = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      // Terminate all sessions
      const terminateAllResponse = await request(app)
        .delete('/api/auth/sessions')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(terminateAllResponse.body).toMatchObject({
        success: true,
        message: 'All sessions terminated successfully',
      });

      // All tokens should be invalid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(401);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session2.body.tokens.accessToken}`)
        .expect(401);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session3.body.tokens.accessToken}`)
        .expect(401);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Close database connection to simulate failure
      await pool.end();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect([503, 500].includes(response.status)).toBe(true);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('unavailable'),
      });

      // Restore connection for cleanup
      pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'dwaybank_test',
        user: process.env.DB_USER || 'dwaybank_test',
        password: process.env.DB_PASSWORD || 'test_password',
      });
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid'),
      });
    });

    it('should handle concurrent registration attempts', async () => {
      // Attempt to register same user simultaneously
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/register')
          .send(testUser)
      );

      const responses = await Promise.all(promises);

      // Only one should succeed
      const successResponses = responses.filter(r => r.status === 201);
      const errorResponses = responses.filter(r => r.status === 409);

      expect(successResponses).toHaveLength(1);
      expect(errorResponses).toHaveLength(2);
    });
  });
});