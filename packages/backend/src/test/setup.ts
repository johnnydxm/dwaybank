/**
 * Jest Test Setup Configuration for DwayBank Backend
 * Configures test environment, mocks, and utilities
 */

import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Mock external services for testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-sms-sid' }),
    },
  })),
}));

// Mock Redis for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    isReady: true,
  })),
}));

// Mock PostgreSQL pool for testing
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Global test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Mock user data
  mockUser: {
    id: 'test-user-id',
    email: 'test@dwaybank.com',
    username: 'testuser',
    hashedPassword: '$2b$04$test.hash.for.testing.purposes',
    isEmailVerified: true,
    mfaEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Mock JWT tokens
  mockTokens: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.refresh',
  },

  // Mock financial data
  mockTransactions: [
    {
      id: 'txn-001',
      userId: 'test-user-id',
      amount: 100.50,
      currency: 'USD',
      type: 'debit',
      category: 'food',
      description: 'Restaurant purchase',
      status: 'completed',
      createdAt: new Date(),
    },
    {
      id: 'txn-002',
      userId: 'test-user-id',
      amount: 2500.00,
      currency: 'USD',
      type: 'credit',
      category: 'salary',
      description: 'Monthly salary',
      status: 'completed',
      createdAt: new Date(),
    },
  ],

  // Mock wallet data
  mockWallet: {
    id: 'wallet-001',
    userId: 'test-user-id',
    balance: 5000.75,
    currency: 'USD',
    type: 'checking',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Helper function to create authenticated request context
  createAuthContext: (user = global.testUtils.mockUser) => ({
    user,
    isAuthenticated: true,
    token: global.testUtils.mockTokens.accessToken,
  }),

  // Helper function to create mock Express request/response
  createMockReqRes: () => {
    const req = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: undefined,
      session: {},
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    return { req, res, next };
  },

  // Helper function to create mock database connection
  createMockDb: () => ({
    query: jest.fn(),
    connect: jest.fn(),
    release: jest.fn(),
    end: jest.fn(),
  }),
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  // Suppress logs during testing unless explicitly needed
  log: process.env.JEST_VERBOSE === 'true' ? originalConsole.log : jest.fn(),
  warn: process.env.JEST_VERBOSE === 'true' ? originalConsole.warn : jest.fn(),
  error: originalConsole.error, // Keep errors visible
  info: process.env.JEST_VERBOSE === 'true' ? originalConsole.info : jest.fn(),
  debug: jest.fn(),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close any open connections, clear timers, etc.
  jest.clearAllTimers();
});

export {};