/**
 * Comprehensive Security Service Tests
 * Testing security controls, threat detection, and compliance features
 */

import { Pool } from 'pg';
import { SecurityService } from '../security.service';
import crypto from 'crypto';

// Mock dependencies
jest.mock('pg');
jest.mock('crypto');

describe('SecurityService', () => {
  let securityService: SecurityService;
  let mockPool: jest.Mocked<Pool>;
  let mockCrypto: jest.Mocked<typeof crypto>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    // Setup mock crypto
    mockCrypto = crypto as jest.Mocked<typeof crypto>;

    // Initialize SecurityService
    securityService = new SecurityService(mockPool);
  });

  describe('Rate Limiting', () => {
    const mockRequest = {
      ip: '192.168.1.1',
      userId: 'user-123',
      endpoint: '/api/auth/login',
      userAgent: 'Mozilla/5.0 Test Browser',
    };

    test('should allow requests within rate limits', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{ request_count: 2, window_start: new Date() }],
      });

      // Act
      const result = await securityService.checkRateLimit(mockRequest);

      // Assert
      expect(result).toEqual({
        allowed: true,
        remaining: 8, // Assuming 10 requests per window
        resetTime: expect.any(Date),
      });
    });

    test('should block requests exceeding rate limits', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{ request_count: 15, window_start: new Date() }],
      });

      // Act
      const result = await securityService.checkRateLimit(mockRequest);

      // Assert
      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        resetTime: expect.any(Date),
        retryAfter: expect.any(Number),
      });
    });

    test('should apply stricter limits for failed login attempts', async () => {
      // Arrange
      const failedLoginRequest = {
        ...mockRequest,
        endpoint: '/api/auth/login',
        failed: true,
      };
      mockPool.query.mockResolvedValue({
        rows: [{ failed_attempts: 3, last_failure: new Date() }],
      });

      // Act
      const result = await securityService.checkFailedLoginAttempts(failedLoginRequest);

      // Assert
      expect(result).toEqual({
        allowed: true,
        remaining: 2, // Assuming 5 failed attempts allowed
        lockoutTime: null,
      });
    });

    test('should enforce account lockout after excessive failed attempts', async () => {
      // Arrange
      const failedLoginRequest = {
        ...mockRequest,
        endpoint: '/api/auth/login',
        failed: true,
      };
      mockPool.query.mockResolvedValue({
        rows: [{ failed_attempts: 5, last_failure: new Date() }],
      });

      // Act
      const result = await securityService.checkFailedLoginAttempts(failedLoginRequest);

      // Assert
      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        lockoutTime: expect.any(Date),
        lockoutDuration: expect.any(Number),
      });
    });
  });

  describe('Threat Detection', () => {
    test('should detect suspicious IP patterns', async () => {
      // Arrange
      const suspiciousRequest = {
        ip: '10.0.0.1',
        userId: 'user-123',
        userAgent: 'curl/7.68.0', // Suspicious user agent
        endpoint: '/api/auth/login',
      };

      mockPool.query.mockResolvedValue({
        rows: [
          { ip: '10.0.0.1', request_count: 100, distinct_users: 50 },
          { ip: '10.0.0.2', request_count: 95, distinct_users: 48 },
        ],
      });

      // Act
      const result = await securityService.detectSuspiciousActivity(suspiciousRequest);

      // Assert
      expect(result).toEqual({
        suspicious: true,
        reasons: expect.arrayContaining(['HIGH_FREQUENCY_REQUESTS', 'SUSPICIOUS_USER_AGENT']),
        riskScore: expect.any(Number),
        recommendation: 'BLOCK',
      });
    });

    test('should detect brute force attacks', async () => {
      // Arrange
      const bruteForceRequest = {
        ip: '192.168.1.100',
        endpoint: '/api/auth/login',
        timeWindow: 60000, // 1 minute
      };

      mockPool.query.mockResolvedValue({
        rows: Array(20).fill({ // 20 failed attempts in 1 minute
          ip: '192.168.1.100',
          endpoint: '/api/auth/login',
          success: false,
          timestamp: new Date(),
        }),
      });

      // Act
      const result = await securityService.detectBruteForceAttack(bruteForceRequest);

      // Assert
      expect(result).toEqual({
        detected: true,
        attackType: 'BRUTE_FORCE',
        severity: 'HIGH',
        recommendation: 'BLOCK_IP',
        duration: expect.any(Number),
      });
    });

    test('should detect credential stuffing patterns', async () => {
      // Arrange
      const credentialStuffingRequest = {
        ip: '203.0.113.1',
        endpoint: '/api/auth/login',
        userAgent: 'Python-requests/2.25.1',
      };

      mockPool.query.mockResolvedValue({
        rows: [
          { distinct_emails: 50, failed_attempts: 100, success_rate: 0.02 },
        ],
      });

      // Act
      const result = await securityService.detectCredentialStuffing(credentialStuffingRequest);

      // Assert
      expect(result).toEqual({
        detected: true,
        attackType: 'CREDENTIAL_STUFFING',
        confidence: expect.any(Number),
        indicators: expect.arrayContaining(['LOW_SUCCESS_RATE', 'HIGH_EMAIL_DIVERSITY']),
      });
    });

    test('should analyze geolocation anomalies', async () => {
      // Arrange
      const geoRequest = {
        userId: 'user-123',
        ip: '8.8.8.8', // US IP
        timestamp: new Date(),
      };

      mockPool.query.mockResolvedValue({
        rows: [
          {
            user_id: 'user-123',
            country: 'Japan', // Previous login from Japan
            last_login: new Date(Date.now() - 3600000), // 1 hour ago
          },
        ],
      });

      // Mock geolocation lookup
      jest.spyOn(securityService as any, 'getGeolocation').mockResolvedValue({
        country: 'United States',
        region: 'California',
        city: 'Mountain View',
      });

      // Act
      const result = await securityService.analyzeGeolocationAnomaly(geoRequest);

      // Assert
      expect(result).toEqual({
        anomalous: true,
        previousLocation: expect.objectContaining({ country: 'Japan' }),
        currentLocation: expect.objectContaining({ country: 'United States' }),
        distance: expect.any(Number),
        travelTime: expect.any(Number),
        riskLevel: 'HIGH',
      });
    });
  });

  describe('Session Security', () => {
    test('should validate session integrity', async () => {
      // Arrange
      const sessionData = {
        sessionId: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockPool.query.mockResolvedValue({
        rows: [{
          session_id: 'session-123',
          user_id: 'user-123',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0 Test Browser',
          created_at: sessionData.createdAt,
          is_valid: true,
        }],
      });

      // Act
      const result = await securityService.validateSessionSecurity(sessionData);

      // Assert
      expect(result).toEqual({
        valid: true,
        riskLevel: 'LOW',
        checks: expect.objectContaining({
          ipConsistency: true,
          userAgentConsistency: true,
          sessionAge: true,
          concurrentSessions: true,
        }),
      });
    });

    test('should detect session hijacking attempts', async () => {
      // Arrange
      const suspiciousSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        ip: '10.0.0.1', // Different IP
        userAgent: 'Different Browser',
        createdAt: new Date(Date.now() - 3600000),
      };

      mockPool.query.mockResolvedValue({
        rows: [{
          session_id: 'session-123',
          user_id: 'user-123',
          ip_address: '192.168.1.1', // Original IP
          user_agent: 'Mozilla/5.0 Test Browser', // Original user agent
          created_at: suspiciousSession.createdAt,
          is_valid: true,
        }],
      });

      // Act
      const result = await securityService.validateSessionSecurity(suspiciousSession);

      // Assert
      expect(result).toEqual({
        valid: false,
        riskLevel: 'CRITICAL',
        reasons: expect.arrayContaining(['IP_MISMATCH', 'USER_AGENT_MISMATCH']),
        recommendation: 'TERMINATE_SESSION',
      });
    });

    test('should enforce concurrent session limits', async () => {
      // Arrange
      const newSessionRequest = {
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      mockPool.query.mockResolvedValue({
        rows: Array(5).fill({ // 5 active sessions (assuming limit is 3)
          session_id: 'session-123',
          user_id: 'user-123',
          is_active: true,
          created_at: new Date(),
        }),
      });

      // Act
      const result = await securityService.checkConcurrentSessions(newSessionRequest);

      // Assert
      expect(result).toEqual({
        allowed: false,
        currentCount: 5,
        limit: 3,
        recommendation: 'TERMINATE_OLDEST_SESSIONS',
      });
    });
  });

  describe('Data Protection', () => {
    test('should detect sensitive data exposure', async () => {
      // Arrange
      const sensitiveData = {
        userId: 'user-123',
        data: {
          ssn: '123-45-6789',
          creditCard: '4111-1111-1111-1111',
          email: 'test@dwaybank.com',
        },
        context: 'api_response',
      };

      // Act
      const result = await securityService.scanForSensitiveData(sensitiveData);

      // Assert
      expect(result).toEqual({
        detected: true,
        types: expect.arrayContaining(['SSN', 'CREDIT_CARD']),
        locations: expect.any(Array),
        riskLevel: 'HIGH',
        recommendation: 'REDACT_DATA',
      });
    });

    test('should validate data encryption requirements', async () => {
      // Arrange
      const dataRequest = {
        userId: 'user-123',
        dataType: 'financial',
        classification: 'sensitive',
        storageLocation: 'database',
      };

      // Act
      const result = await securityService.validateEncryptionRequirements(dataRequest);

      // Assert
      expect(result).toEqual({
        encryptionRequired: true,
        algorithms: expect.arrayContaining(['AES-256-GCM']),
        keyManagement: 'HSM',
        compliance: expect.arrayContaining(['PCI-DSS', 'SOX']),
      });
    });
  });

  describe('Compliance Monitoring', () => {
    test('should generate PCI DSS compliance report', async () => {
      // Arrange
      const complianceRequest = {
        standard: 'PCI_DSS',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      };

      mockPool.query.mockResolvedValue({
        rows: [
          {
            requirement: '8.2.3',
            description: 'Strong password requirements',
            status: 'COMPLIANT',
            evidence: 'Password policy enforced',
          },
          {
            requirement: '11.2.1',
            description: 'Wireless security testing',
            status: 'NON_COMPLIANT',
            evidence: null,
          },
        ],
      });

      // Act
      const result = await securityService.generateComplianceReport(complianceRequest);

      // Assert
      expect(result).toEqual({
        standard: 'PCI_DSS',
        overallStatus: 'PARTIALLY_COMPLIANT',
        score: expect.any(Number),
        requirements: expect.arrayContaining([
          expect.objectContaining({
            requirement: '8.2.3',
            status: 'COMPLIANT',
          }),
          expect.objectContaining({
            requirement: '11.2.1',
            status: 'NON_COMPLIANT',
          }),
        ]),
        recommendations: expect.any(Array),
      });
    });

    test('should monitor GDPR compliance for data processing', async () => {
      // Arrange
      const gdprRequest = {
        userId: 'user-123',
        operation: 'data_processing',
        legalBasis: 'contract',
        dataTypes: ['personal', 'financial'],
      };

      // Act
      const result = await securityService.validateGDPRCompliance(gdprRequest);

      // Assert
      expect(result).toEqual({
        compliant: true,
        legalBasisValid: true,
        consentRequired: false,
        retentionPeriod: expect.any(Number),
        dataMinimization: true,
        processingPurpose: 'financial_services',
      });
    });
  });

  describe('Security Logging and Monitoring', () => {
    test('should log security events with proper classification', async () => {
      // Arrange
      const securityEvent = {
        type: 'SUSPICIOUS_LOGIN',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        severity: 'MEDIUM',
        details: { reason: 'Unusual location' },
      };

      mockPool.query.mockResolvedValue({ rowCount: 1 });

      // Act
      await securityService.logSecurityEvent(securityEvent);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_events'),
        expect.arrayContaining([
          expect.any(String), // event_id
          securityEvent.type,
          securityEvent.userId,
          securityEvent.ip,
          securityEvent.severity,
          expect.any(String), // details JSON
          expect.any(Date),   // timestamp
        ])
      );
    });

    test('should generate security metrics dashboard', async () => {
      // Arrange
      const metricsRequest = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        granularity: 'daily',
      };

      mockPool.query.mockResolvedValue({
        rows: [
          {
            date: '2024-01-01',
            failed_logins: 45,
            blocked_ips: 12,
            suspicious_activities: 8,
            compliance_violations: 2,
          },
        ],
      });

      // Act
      const result = await securityService.generateSecurityMetrics(metricsRequest);

      // Assert
      expect(result).toEqual({
        timeRange: metricsRequest.timeRange,
        metrics: expect.arrayContaining([
          expect.objectContaining({
            date: '2024-01-01',
            failedLogins: 45,
            blockedIPs: 12,
            suspiciousActivities: 8,
            complianceViolations: 2,
          }),
        ]),
        summary: expect.objectContaining({
          totalFailedLogins: expect.any(Number),
          totalBlockedIPs: expect.any(Number),
          averageRiskScore: expect.any(Number),
        }),
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle database failures gracefully', async () => {
      // Arrange
      const request = {
        ip: '192.168.1.1',
        userId: 'user-123',
        endpoint: '/api/auth/login',
      };
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await securityService.checkRateLimit(request);

      // Assert
      expect(result).toEqual({
        allowed: true, // Fail open for availability
        error: 'Security service temporarily unavailable',
        fallback: true,
      });
    });

    test('should implement circuit breaker pattern', async () => {
      // Arrange
      const request = { ip: '192.168.1.1', userId: 'user-123' };
      
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        mockPool.query.mockRejectedValue(new Error('Service unavailable'));
        await securityService.checkRateLimit(request).catch(() => {});
      }

      // Act
      const result = await securityService.checkRateLimit(request);

      // Assert
      expect(result).toEqual({
        allowed: true, // Circuit breaker open
        circuitBreakerOpen: true,
        retryAfter: expect.any(Number),
      });
    });
  });
});