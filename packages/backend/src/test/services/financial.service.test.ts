/**
 * Financial Service Comprehensive Test Suite
 * Tests transaction processing, balance calculations, and financial integrity
 */

import { FinancialService } from '../../services/financial.service';
import { SecurityService } from '../../services/security.service';
import { AuditService } from '../../services/audit.service';

describe('FinancialService', () => {
  let financialService: FinancialService;
  let mockDb: any;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      release: jest.fn(),
      begin: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    mockSecurityService = {
      validateTransactionAmount: jest.fn(),
      detectFraudulentActivity: jest.fn(),
      encryptSensitiveData: jest.fn(),
      decryptSensitiveData: jest.fn(),
      logSecurityEvent: jest.fn(),
      checkTransactionLimits: jest.fn(),
    } as any;

    mockAuditService = {
      logFinancialTransaction: jest.fn(),
      logBalanceChange: jest.fn(),
      logSecurityEvent: jest.fn(),
      generateAuditTrail: jest.fn(),
    } as any;

    financialService = new FinancialService(mockDb, mockSecurityService, mockAuditService);
  });

  describe('Transaction Processing', () => {
    it('should process debit transaction successfully', async () => {
      const transactionData = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 100.50,
        currency: 'USD',
        type: 'debit',
        category: 'food',
        description: 'Restaurant purchase',
        merchantInfo: {
          name: 'Test Restaurant',
          category: 'dining',
          location: 'New York, NY',
        },
      };

      const mockAccount = {
        id: 'account-456',
        user_id: 'user-123',
        balance: 1000.00,
        currency: 'USD',
        status: 'active',
        daily_limit: 2000.00,
        daily_spent: 150.00,
      };

      const mockTransaction = {
        id: 'txn-789',
        ...transactionData,
        status: 'completed',
        created_at: new Date(),
        balance_after: 899.50,
      };

      // Mock database interactions
      mockDb.begin.mockResolvedValue(undefined);
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAccount] }) // Get account
        .mockResolvedValueOnce({ rows: [mockTransaction] }) // Insert transaction
        .mockResolvedValueOnce({ rows: [] }) // Update account balance
        .mockResolvedValueOnce({ rows: [] }); // Update daily spent
      mockDb.commit.mockResolvedValue(undefined);

      // Mock security validations
      mockSecurityService.validateTransactionAmount.mockReturnValue({ 
        isValid: true, 
        violations: [] 
      });
      mockSecurityService.detectFraudulentActivity.mockResolvedValue({ 
        isFraudulent: false, 
        riskScore: 0.1,
        flags: [] 
      });
      mockSecurityService.checkTransactionLimits.mockReturnValue({ 
        withinLimits: true, 
        remainingDaily: 1749.50 
      });

      const result = await financialService.processTransaction(transactionData);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.id).toBe('txn-789');
      expect(result.transaction.status).toBe('completed');
      expect(result.balanceAfter).toBe(899.50);
      
      // Verify audit logging
      expect(mockAuditService.logFinancialTransaction).toHaveBeenCalledWith({
        transactionId: 'txn-789',
        userId: 'user-123',
        type: 'debit',
        amount: 100.50,
        currency: 'USD',
        status: 'completed',
        balanceAfter: 899.50,
      });
    });

    it('should reject transaction with insufficient funds', async () => {
      const transactionData = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 1500.00,
        currency: 'USD',
        type: 'debit',
        category: 'transfer',
        description: 'Large transfer',
      };

      const mockAccount = {
        id: 'account-456',
        user_id: 'user-123',
        balance: 100.00, // Insufficient funds
        currency: 'USD',
        status: 'active',
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockAccount] });
      mockSecurityService.validateTransactionAmount.mockReturnValue({ 
        isValid: true, 
        violations: [] 
      });

      const result = await financialService.processTransaction(transactionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
      expect(result.availableBalance).toBe(100.00);
      
      // Verify security event logged
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'transaction_declined',
        reason: 'insufficient_funds',
        userId: 'user-123',
        amount: 1500.00,
        accountBalance: 100.00,
      });
    });

    it('should detect and prevent fraudulent transactions', async () => {
      const suspiciousTransaction = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 5000.00,
        currency: 'USD',
        type: 'debit',
        category: 'other',
        description: 'Suspicious large transaction',
        location: {
          country: 'Unknown',
          ip: '203.0.113.1',
        },
      };

      const mockAccount = {
        id: 'account-456',
        user_id: 'user-123',
        balance: 10000.00,
        currency: 'USD',
        status: 'active',
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockAccount] });
      mockSecurityService.validateTransactionAmount.mockReturnValue({ 
        isValid: true, 
        violations: [] 
      });
      mockSecurityService.detectFraudulentActivity.mockResolvedValue({ 
        isFraudulent: true, 
        riskScore: 0.9,
        flags: ['unusual_amount', 'suspicious_location', 'velocity_violation'] 
      });

      const result = await financialService.processTransaction(suspiciousTransaction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction flagged for security review');
      expect(result.errorCode).toBe('FRAUD_DETECTED');
      expect(result.requiresVerification).toBe(true);
      
      // Verify fraud alert logged
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'fraud_detected',
        userId: 'user-123',
        transactionAmount: 5000.00,
        riskScore: 0.9,
        flags: ['unusual_amount', 'suspicious_location', 'velocity_violation'],
        severity: 'high',
      });
    });

    it('should handle concurrent transaction processing with race conditions', async () => {
      const transactionData1 = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 600.00,
        currency: 'USD',
        type: 'debit',
        category: 'transfer',
        description: 'Transfer 1',
      };

      const transactionData2 = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 500.00,
        currency: 'USD',
        type: 'debit',
        category: 'transfer',
        description: 'Transfer 2',
      };

      const mockAccount = {
        id: 'account-456',
        user_id: 'user-123',
        balance: 1000.00,
        currency: 'USD',
        status: 'active',
      };

      // Simulate database lock/version conflict
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAccount] }) // First transaction gets account
        .mockResolvedValueOnce({ rows: [mockAccount] }); // Second transaction gets same account
      
      mockDb.begin.mockResolvedValue(undefined);
      mockDb.commit
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Version conflict')); // Second fails due to version conflict
      
      mockSecurityService.validateTransactionAmount.mockReturnValue({ 
        isValid: true, 
        violations: [] 
      });
      mockSecurityService.detectFraudulentActivity.mockResolvedValue({ 
        isFraudulent: false, 
        riskScore: 0.1 
      });

      const [result1, result2] = await Promise.all([
        financialService.processTransaction(transactionData1),
        financialService.processTransaction(transactionData2),
      ]);

      // One should succeed, one should fail due to concurrency control
      const successes = [result1, result2].filter(r => r.success);
      const failures = [result1, result2].filter(r => !r.success);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].errorCode).toBe('CONCURRENCY_CONFLICT');
    });

    it('should calculate accurate balance after multiple decimal operations', async () => {
      const transactions = [
        { amount: 123.45, type: 'credit' },
        { amount: 67.89, type: 'debit' },
        { amount: 0.01, type: 'credit' },
        { amount: 99.99, type: 'debit' },
      ];

      const initialBalance = 1000.00;
      let expectedBalance = initialBalance;

      for (const txn of transactions) {
        if (txn.type === 'credit') {
          expectedBalance += txn.amount;
        } else {
          expectedBalance -= txn.amount;
        }
      }

      const result = await financialService.calculateBalanceAfterTransactions(
        'account-456',
        initialBalance,
        transactions
      );

      expect(result.finalBalance).toBe(expectedBalance);
      expect(result.finalBalance).toBe(955.58); // Verify exact calculation
      expect(result.calculations).toHaveLength(4);
      
      // Verify precision handling
      expect(Number.isInteger(result.finalBalance * 100)).toBe(true); // Should be precise to 2 decimal places
    });
  });

  describe('Balance Management', () => {
    it('should get accurate account balance', async () => {
      const accountId = 'account-456';
      const userId = 'user-123';

      const mockAccount = {
        id: accountId,
        user_id: userId,
        balance: 2543.67,
        currency: 'USD',
        last_updated: new Date(),
        pending_transactions: 150.00,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockAccount] });

      const result = await financialService.getAccountBalance(accountId, userId);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(2543.67);
      expect(result.availableBalance).toBe(2393.67); // balance - pending
      expect(result.currency).toBe('USD');
      expect(result.pendingAmount).toBe(150.00);
    });

    it('should handle balance inquiry for non-existent account', async () => {
      const accountId = 'non-existent-account';
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await financialService.getAccountBalance(accountId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account not found');
      expect(result.errorCode).toBe('ACCOUNT_NOT_FOUND');
    });

    it('should prevent unauthorized balance access', async () => {
      const accountId = 'account-456';
      const unauthorizedUserId = 'user-999';

      const mockAccount = {
        id: accountId,
        user_id: 'user-123', // Different user
        balance: 2543.67,
        currency: 'USD',
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockAccount] });

      const result = await financialService.getAccountBalance(accountId, unauthorizedUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized access to account');
      expect(result.errorCode).toBe('UNAUTHORIZED_ACCESS');
      
      // Verify security event logged
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'unauthorized_balance_access',
        userId: unauthorizedUserId,
        targetAccountId: accountId,
        actualOwner: 'user-123',
        severity: 'high',
      });
    });
  });

  describe('Transaction History', () => {
    it('should retrieve paginated transaction history', async () => {
      const userId = 'user-123';
      const accountId = 'account-456';
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        category: 'food',
        limit: 20,
        offset: 0,
      };

      const mockTransactions = [
        {
          id: 'txn-001',
          user_id: userId,
          account_id: accountId,
          amount: 45.67,
          currency: 'USD',
          type: 'debit',
          category: 'food',
          description: 'Coffee shop',
          status: 'completed',
          created_at: new Date('2024-01-15'),
          balance_after: 1954.33,
        },
        {
          id: 'txn-002',
          user_id: userId,
          account_id: accountId,
          amount: 123.45,
          currency: 'USD',
          type: 'debit',
          category: 'food',
          description: 'Restaurant',
          status: 'completed',
          created_at: new Date('2024-01-20'),
          balance_after: 1830.88,
        },
      ];

      const mockCount = { count: '15' };

      mockDb.query
        .mockResolvedValueOnce({ rows: mockTransactions }) // Get transactions
        .mockResolvedValueOnce({ rows: [mockCount] }); // Get total count

      const result = await financialService.getTransactionHistory(userId, accountId, filters);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.transactions[0].id).toBe('txn-001');
      
      // Verify sensitive data is properly handled
      expect(result.transactions[0]).not.toHaveProperty('raw_merchant_data');
    });

    it('should export transaction data with proper formatting', async () => {
      const userId = 'user-123';
      const accountId = 'account-456';
      const exportFormat = 'csv';
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const mockTransactions = [
        {
          id: 'txn-001',
          amount: 45.67,
          currency: 'USD',
          type: 'debit',
          category: 'food',
          description: 'Coffee shop',
          created_at: new Date('2024-01-15'),
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockTransactions });

      const result = await financialService.exportTransactions(userId, accountId, exportFormat, dateRange);

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.data).toContain('Date,Amount,Type,Category,Description');
      expect(result.data).toContain('2024-01-15,-45.67,debit,food,Coffee shop');
      expect(result.recordCount).toBe(1);
      
      // Verify audit logging
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'transaction_export',
        userId,
        accountId,
        format: exportFormat,
        recordCount: 1,
        dateRange,
      });
    });
  });

  describe('Financial Calculations', () => {
    it('should calculate accurate interest with compound frequency', async () => {
      const principal = 10000.00;
      const annualRate = 0.05; // 5%
      const compoundingFrequency = 12; // Monthly
      const timePeriod = 2; // Years

      const result = await financialService.calculateCompoundInterest({
        principal,
        annualRate,
        compoundingFrequency,
        timePeriod,
      });

      const expectedAmount = principal * Math.pow(1 + (annualRate / compoundingFrequency), compoundingFrequency * timePeriod);
      const expectedInterest = expectedAmount - principal;

      expect(result.success).toBe(true);
      expect(result.finalAmount).toBeCloseTo(expectedAmount, 2);
      expect(result.totalInterest).toBeCloseTo(expectedInterest, 2);
      expect(result.effectiveRate).toBeCloseTo(0.0512, 4); // Effective annual rate
    });

    it('should calculate monthly payment for loans', async () => {
      const loanAmount = 250000.00; // $250k loan
      const annualRate = 0.04; // 4% annual
      const termMonths = 360; // 30 years

      const result = await financialService.calculateLoanPayment({
        principal: loanAmount,
        annualRate,
        termMonths,
      });

      const monthlyRate = annualRate / 12;
      const expectedPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);

      expect(result.success).toBe(true);
      expect(result.monthlyPayment).toBeCloseTo(expectedPayment, 2);
      expect(result.totalPayment).toBeCloseTo(expectedPayment * termMonths, 2);
      expect(result.totalInterest).toBeCloseTo((expectedPayment * termMonths) - loanAmount, 2);
    });

    it('should handle currency conversion with real-time rates', async () => {
      const amount = 1000.00;
      const fromCurrency = 'USD';
      const toCurrency = 'EUR';
      const mockExchangeRate = 0.85;

      // Mock external exchange rate service
      jest.spyOn(financialService, 'getExchangeRate').mockResolvedValue({
        rate: mockExchangeRate,
        timestamp: new Date(),
        provider: 'test-provider',
      });

      const result = await financialService.convertCurrency({
        amount,
        fromCurrency,
        toCurrency,
      });

      expect(result.success).toBe(true);
      expect(result.convertedAmount).toBe(850.00);
      expect(result.exchangeRate).toBe(mockExchangeRate);
      expect(result.originalAmount).toBe(amount);
      expect(result.fromCurrency).toBe(fromCurrency);
      expect(result.toCurrency).toBe(toCurrency);
    });
  });

  describe('Fraud Detection', () => {
    it('should detect velocity-based fraud patterns', async () => {
      const userId = 'user-123';
      const recentTransactions = [
        { amount: 500, timestamp: new Date(Date.now() - 300000) }, // 5 min ago
        { amount: 750, timestamp: new Date(Date.now() - 600000) }, // 10 min ago
        { amount: 1000, timestamp: new Date(Date.now() - 900000) }, // 15 min ago
        { amount: 250, timestamp: new Date(Date.now() - 1200000) }, // 20 min ago
      ];

      const currentTransaction = { amount: 2000, type: 'debit' };

      mockDb.query.mockResolvedValueOnce({ rows: recentTransactions });

      const result = await financialService.analyzeTransactionVelocity(userId, currentTransaction);

      expect(result.velocityScore).toBeGreaterThan(0.7); // High velocity
      expect(result.flags).toContain('high_frequency_transactions');
      expect(result.flags).toContain('escalating_amounts');
      expect(result.recommendedAction).toBe('require_additional_verification');
    });

    it('should detect location-based anomalies', async () => {
      const userId = 'user-123';
      const currentLocation = {
        ip: '203.0.113.1',
        country: 'Unknown',
        city: 'Unknown',
        coordinates: { lat: 0, lng: 0 },
      };

      const userProfile = {
        typical_locations: [
          { country: 'US', city: 'New York', frequency: 0.8 },
          { country: 'US', city: 'Boston', frequency: 0.2 },
        ],
        last_known_location: {
          country: 'US',
          city: 'New York',
          timestamp: new Date(Date.now() - 86400000), // 24 hours ago
        },
      };

      mockDb.query.mockResolvedValueOnce({ rows: [userProfile] });

      const result = await financialService.analyzeLocationAnomaly(userId, currentLocation);

      expect(result.anomalyScore).toBeGreaterThan(0.8); // High anomaly
      expect(result.flags).toContain('unusual_location');
      expect(result.flags).toContain('impossible_travel');
      expect(result.recommendedAction).toBe('block_transaction');
    });
  });

  describe('Compliance and Audit', () => {
    it('should generate comprehensive audit trail', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-789';
      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const mockAuditEvents = [
        {
          id: 'audit-001',
          event_type: 'transaction_created',
          transaction_id: transactionId,
          user_id: userId,
          timestamp: new Date(),
          details: { amount: 100.50, currency: 'USD' },
        },
        {
          id: 'audit-002',
          event_type: 'balance_updated',
          transaction_id: transactionId,
          user_id: userId,
          timestamp: new Date(),
          details: { old_balance: 1000.00, new_balance: 899.50 },
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockAuditEvents });

      const result = await financialService.generateAuditReport(userId, dateRange);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.summary.totalEvents).toBe(2);
      expect(result.summary.eventTypes).toContain('transaction_created');
      expect(result.summary.eventTypes).toContain('balance_updated');
      
      // Verify compliance with financial regulations
      expect(result.compliance.immutableRecord).toBe(true);
      expect(result.compliance.digitalSignature).toBeDefined();
      expect(result.compliance.regulatoryStandards).toContain('PCI_DSS');
    });

    it('should enforce transaction limits and compliance rules', async () => {
      const transactionData = {
        userId: 'user-123',
        amount: 10001.00, // Over $10k limit
        currency: 'USD',
        type: 'debit',
        category: 'transfer',
      };

      const complianceRules = {
        dailyLimit: 5000.00,
        transactionLimit: 10000.00,
        requiresReporting: true, // Over $10k
        kycRequired: true,
      };

      mockSecurityService.checkTransactionLimits.mockReturnValue({
        withinLimits: false,
        violations: ['exceeds_transaction_limit', 'requires_ctf_reporting'],
        complianceRequirements: ['enhanced_kyc', 'manual_review'],
      });

      const result = await financialService.validateComplianceRequirements(transactionData);

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('exceeds_transaction_limit');
      expect(result.violations).toContain('requires_ctf_reporting');
      expect(result.requiredActions).toContain('enhanced_kyc');
      expect(result.requiredActions).toContain('manual_review');
      
      // Verify CTF reporting is triggered
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'ctf_reporting_required',
        userId: 'user-123',
        amount: 10001.00,
        currency: 'USD',
        compliance: 'BSA_CTF',
        severity: 'high',
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      const transactionData = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 100.00,
        currency: 'USD',
        type: 'debit',
      };

      mockDb.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await financialService.processTransaction(transactionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service temporarily unavailable');
      expect(result.errorCode).toBe('DATABASE_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should rollback failed transactions properly', async () => {
      const transactionData = {
        userId: 'user-123',
        fromAccountId: 'account-456',
        amount: 100.00,
        currency: 'USD',
        type: 'debit',
      };

      const mockAccount = {
        id: 'account-456',
        balance: 1000.00,
        currency: 'USD',
        status: 'active',
      };

      mockDb.begin.mockResolvedValue(undefined);
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAccount] }) // Get account
        .mockResolvedValueOnce({ rows: [{ id: 'txn-123' }] }) // Insert transaction
        .mockRejectedValueOnce(new Error('Balance update failed')); // Update balance fails
      
      mockDb.rollback.mockResolvedValue(undefined);

      const result = await financialService.processTransaction(transactionData);

      expect(result.success).toBe(false);
      expect(mockDb.rollback).toHaveBeenCalled();
      expect(result.errorCode).toBe('TRANSACTION_FAILED');
      
      // Verify rollback audit event
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith({
        event: 'transaction_rollback',
        userId: 'user-123',
        reason: 'Balance update failed',
        transactionAttempt: expect.any(String),
      });
    });
  });
});