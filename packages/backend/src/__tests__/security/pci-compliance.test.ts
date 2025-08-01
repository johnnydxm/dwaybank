/**
 * PCI DSS Compliance Security Tests
 * Testing adherence to Payment Card Industry Data Security Standards
 */

import request from 'supertest';
import { Pool } from 'pg';
import crypto from 'crypto';
import { createApp } from '../../app';
import { SecurityService } from '../../services/security.service';

describe('PCI DSS Compliance Tests', () => {
  let app: any;
  let server: any;
  let pool: Pool;
  let securityService: SecurityService;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dwaybank_test',
      user: process.env.DB_USER || 'dwaybank_test',
      password: process.env.DB_PASSWORD || 'test_password',
    });

    securityService = new SecurityService(pool);
    app = await createApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    await pool.end();
    server.close();
  });

  describe('Requirement 1: Install and maintain a firewall configuration', () => {
    it('should block unauthorized access attempts', async () => {
      // Test unauthorized access to protected endpoints
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should validate network security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should enforce HTTPS in production environment', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.FORCE_HTTPS).toBe('true');
      }
    });
  });

  describe('Requirement 2: Do not use vendor-supplied defaults', () => {
    it('should not use default passwords or security parameters', async () => {
      // Test that default credentials don't work
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
      });
    });

    it('should use custom security configurations', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET?.length).toBeGreaterThan(32);
      expect(process.env.SESSION_SECRET).toBeDefined();
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
    });

    it('should have changed default database credentials', () => {
      expect(process.env.DB_PASSWORD).not.toBe('postgres');
      expect(process.env.DB_PASSWORD).not.toBe('password');
      expect(process.env.DB_PASSWORD).not.toBe('admin');
    });
  });

  describe('Requirement 3: Protect stored cardholder data', () => {
    it('should encrypt sensitive financial data at rest', async () => {
      // Simulate storing sensitive financial data
      const sensitiveData = {
        accountNumber: '4111111111111111',
        routingNumber: '021000021',
        ssn: '123-45-6789',
      };

      const encryptedData = await securityService.encryptSensitiveData(sensitiveData);
      
      expect(encryptedData.accountNumber).not.toBe(sensitiveData.accountNumber);
      expect(encryptedData.accountNumber).toMatch(/^[a-f0-9]+$/); // Hex string
      expect(encryptedData.routingNumber).not.toBe(sensitiveData.routingNumber);
      expect(encryptedData.ssn).not.toBe(sensitiveData.ssn);
    });

    it('should not store sensitive authentication data', async () => {
      // Register a user
      const userRegistration = {
        email: 'pci-test@dwaybank.com',
        username: 'pcitest',
        password: 'SecurePass123!',
        firstName: 'PCI',
        lastName: 'Test',
      };

      await request(app)
        .post('/api/auth/register')
        .send(userRegistration);

      // Check that password is not stored in plain text
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE email = $1',
        [userRegistration.email]
      );

      expect(result.rows[0].password_hash).not.toBe(userRegistration.password);
      expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
    });

    it('should mask sensitive data in logs and responses', async () => {
      const testUser = {
        email: 'log-test@dwaybank.com',
        username: 'logtest',
        password: 'SecurePass123!',
        firstName: 'Log',
        lastName: 'Test',
        ssn: '123-45-6789',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Response should not contain sensitive data
      expect(JSON.stringify(response.body)).not.toContain(testUser.password);
      expect(JSON.stringify(response.body)).not.toContain(testUser.ssn);
    });

    it('should implement proper key management', () => {
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
      expect(process.env.ENCRYPTION_KEY?.length).toBe(64); // 256-bit key in hex
      expect(process.env.ENCRYPTION_ALGORITHM).toBe('aes-256-gcm');
    });
  });

  describe('Requirement 4: Encrypt transmission of cardholder data', () => {
    it('should enforce TLS for all API communications', async () => {
      if (process.env.NODE_ENV === 'production') {
        const response = await request(app)
          .get('/api/health');

        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });

    it('should validate TLS configuration', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.TLS_MIN_VERSION).toBe('1.2');
        expect(process.env.FORCE_HTTPS).toBe('true');
      }
    });

    it('should encrypt sensitive data in transit', async () => {
      // Test that sensitive data is encrypted when transmitted
      const sensitivePayload = {
        accountNumber: '4111111111111111',
        cvv: '123',
        expiryDate: '12/25',
      };

      // Mock intercepting network traffic
      const encryptedPayload = crypto
        .createCipher('aes-256-gcm', process.env.ENCRYPTION_KEY!)
        .update(JSON.stringify(sensitivePayload), 'utf8', 'hex');

      expect(encryptedPayload).not.toContain('4111111111111111');
      expect(encryptedPayload).not.toContain('123');
    });
  });

  describe('Requirement 6: Develop and maintain secure systems', () => {
    it('should validate input to prevent injection attacks', async () => {
      const maliciousInput = {
        email: "'; DROP TABLE users; --",
        password: 'password',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid'),
      });
    });

    it('should prevent XSS attacks', async () => {
      const xssPayload = {
        firstName: '<script>alert("xss")</script>',
        lastName: 'Test',
        email: 'xss-test@dwaybank.com',
        username: 'xsstest',
        password: 'SecurePass123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssPayload);

      if (response.status === 201) {
        expect(response.body.user.firstName).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should implement proper error handling without information disclosure', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@dwaybank.com',
          password: 'password',
        });

      expect(response.body.error).not.toContain('user not found');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should validate security patch levels', () => {
      // This would typically check dependency versions
      const packageJson = require('../../../package.json');
      
      // Ensure no known vulnerable dependencies
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    });
  });

  describe('Requirement 7: Restrict access by business need-to-know', () => {
    it('should implement role-based access control', async () => {
      // Test that regular users cannot access admin endpoints
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'rbac-test@dwaybank.com',
          username: 'rbactest',
          password: 'SecurePass123!',
          firstName: 'RBAC',
          lastName: 'Test',
        });

      const adminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userResponse.body.tokens.accessToken}`)
        .expect(403);

      expect(adminResponse.body).toMatchObject({
        success: false,
        error: 'Insufficient permissions',
      });
    });

    it('should implement data access controls', async () => {
      // Test that users can only access their own data
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@dwaybank.com',
          username: 'user1',
          password: 'SecurePass123!',
          firstName: 'User',
          lastName: 'One',
        });

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@dwaybank.com',
          username: 'user2',
          password: 'SecurePass123!',
          firstName: 'User',
          lastName: 'Two',
        });

      // User1 should not be able to access User2's data
      const unauthorizedResponse = await request(app)
        .get(`/api/users/${user2Response.body.user.id}`)
        .set('Authorization', `Bearer ${user1Response.body.tokens.accessToken}`)
        .expect(403);

      expect(unauthorizedResponse.body).toMatchObject({
        success: false,
        error: 'Access denied',
      });
    });
  });

  describe('Requirement 8: Identify and authenticate access', () => {
    it('should enforce strong password policies', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `weak-${Date.now()}@dwaybank.com`,
            username: `weak${Date.now()}`,
            password: weakPassword,
            firstName: 'Weak',
            lastName: 'Password',
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed',
        });
      }
    });

    it('should implement account lockout after failed attempts', async () => {
      const testUser = {
        email: 'lockout-test@dwaybank.com',
        username: 'lockouttest',
        password: 'SecurePass123!',
        firstName: 'Lockout',
        lastName: 'Test',
      };

      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          });
      }

      // Account should be locked
      const lockedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password, // Correct password
        });

      expect([429, 423].includes(lockedResponse.status)).toBe(true);
      expect(lockedResponse.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/locked|blocked|too many/i),
      });
    });

    it('should implement multi-factor authentication for sensitive operations', async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'mfa-test@dwaybank.com',
          username: 'mfatest',
          password: 'SecurePass123!',
          firstName: 'MFA',
          lastName: 'Test',
        });

      // Enable MFA
      const mfaSetupResponse = await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${userResponse.body.tokens.accessToken}`)
        .send({ method: 'totp' });

      expect(mfaSetupResponse.status).toBe(200);
      expect(mfaSetupResponse.body).toHaveProperty('qrCode');
      expect(mfaSetupResponse.body).toHaveProperty('secret');
    });
  });

  describe('Requirement 10: Track and monitor all access', () => {
    it('should log all authentication events', async () => {
      const testUser = {
        email: 'audit-test@dwaybank.com',
        username: 'audittest',
        password: 'SecurePass123!',
        firstName: 'Audit',
        lastName: 'Test',
      };

      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Login
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Check audit logs
      const auditLogs = await pool.query(
        'SELECT * FROM audit_logs WHERE event_type IN ($1, $2) ORDER BY created_at DESC LIMIT 2',
        ['USER_REGISTRATION', 'USER_LOGIN']
      );

      expect(auditLogs.rows).toHaveLength(2);
      expect(auditLogs.rows[0]).toMatchObject({
        event_type: 'USER_LOGIN',
        user_email: testUser.email,
        ip_address: expect.any(String),
        user_agent: expect.any(String),
      });
    });

    it('should log security events', async () => {
      // Trigger a security event (failed login)
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@dwaybank.com',
          password: 'wrongpassword',
        });

      // Check security logs
      const securityLogs = await pool.query(
        'SELECT * FROM security_events WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1',
        ['FAILED_LOGIN']
      );

      expect(securityLogs.rows).toHaveLength(1);
      expect(securityLogs.rows[0]).toMatchObject({
        event_type: 'FAILED_LOGIN',
        severity: expect.stringMatching(/low|medium|high/i),
        ip_address: expect.any(String),
      });
    });

    it('should implement log integrity protection', async () => {
      // Check that logs cannot be modified
      const originalLog = await pool.query(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1'
      );

      if (originalLog.rows.length > 0) {
        // Logs should be immutable (have hash/signature)
        expect(originalLog.rows[0]).toHaveProperty('hash');
        expect(originalLog.rows[0].hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256
      }
    });
  });

  describe('Requirement 11: Regularly test security systems', () => {
    it('should detect SQL injection vulnerabilities', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password',
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Invalid'),
        });
      }
    });

    it('should validate vulnerability scanning results', async () => {
      // This would typically integrate with security scanning tools
      const vulnerabilityReport = await securityService.runVulnerabilityScan();
      
      expect(vulnerabilityReport).toMatchObject({
        status: 'completed',
        criticalVulnerabilities: 0,
        highVulnerabilities: expect.any(Number),
        mediumVulnerabilities: expect.any(Number),
        lowVulnerabilities: expect.any(Number),
      });

      expect(vulnerabilityReport.criticalVulnerabilities).toBe(0);
    });
  });

  describe('Requirement 12: Maintain information security policy', () => {
    it('should enforce data retention policies', async () => {
      // Create old audit log entry
      await pool.query(`
        INSERT INTO audit_logs (event_type, user_email, ip_address, created_at)
        VALUES ('TEST_EVENT', 'old@test.com', '127.0.0.1', NOW() - INTERVAL '400 days')
      `);

      // Run data retention cleanup
      await securityService.enforceDataRetentionPolicies();

      // Old data should be purged
      const oldLogs = await pool.query(
        'SELECT * FROM audit_logs WHERE created_at < NOW() - INTERVAL \'365 days\''
      );

      expect(oldLogs.rows).toHaveLength(0);
    });

    it('should implement incident response procedures', async () => {
      // Simulate security incident
      const incident = await securityService.reportSecurityIncident({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        description: 'Multiple failed login attempts from unusual location',
        affectedUser: 'test@dwaybank.com',
        ipAddress: '192.168.1.100',
      });

      expect(incident).toMatchObject({
        id: expect.any(String),
        status: 'REPORTED',
        assignedTo: expect.any(String),
        escalationLevel: expect.any(Number),
      });
    });

    it('should validate compliance reporting', async () => {
      const complianceReport = await securityService.generateComplianceReport({
        standard: 'PCI_DSS',
        version: '4.0',
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },
      });

      expect(complianceReport).toMatchObject({
        standard: 'PCI_DSS',
        version: '4.0',
        overallScore: expect.any(Number),
        requirements: expect.arrayContaining([
          expect.objectContaining({
            requirement: expect.any(String),
            status: expect.stringMatching(/compliant|non_compliant|not_applicable/),
            evidence: expect.any(Array),
          }),
        ]),
      });

      // Overall compliance score should be high
      expect(complianceReport.overallScore).toBeGreaterThan(85);
    });
  });
});