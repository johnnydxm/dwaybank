/**
 * Vitest Test Setup Configuration for DwayBank Frontend
 * Configures test environment, mocks, and utilities for React components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Web APIs
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock crypto.subtle for Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
    },
    getRandomValues: vi.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock fetch API
global.fetch = vi.fn();

// Mock navigator APIs
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
    readText: vi.fn(),
  },
});

// Mock getUserMedia for accessibility testing
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
  },
});

// Setup mock API responses
beforeAll(() => {
  // Mock successful API responses by default
  (global.fetch as any).mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test utilities
declare global {
  namespace Vi {
    interface TestUtils {
      mockUser: {
        id: string;
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        isEmailVerified: boolean;
        mfaEnabled: boolean;
      };
      mockTransactions: Array<{
        id: string;
        amount: number;
        currency: string;
        type: 'debit' | 'credit';
        category: string;
        description: string;
        status: string;
        date: Date;
      }>;
      mockWallet: {
        id: string;
        balance: number;
        currency: string;
        type: string;
        status: string;
      };
      createMockAuthContext: () => any;
      createMockApiResponse: (data: any, status?: number) => any;
    }
  }
}

// Export test utilities
export const testUtils = {
  mockUser: {
    id: 'user-123',
    email: 'test@dwaybank.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    mfaEnabled: false,
  },

  mockTransactions: [
    {
      id: 'txn-001',
      amount: 100.50,
      currency: 'USD',
      type: 'debit' as const,
      category: 'food',
      description: 'Restaurant purchase',
      status: 'completed',
      date: new Date('2024-01-15'),
    },
    {
      id: 'txn-002',
      amount: 2500.00,
      currency: 'USD',
      type: 'credit' as const,
      category: 'salary',
      description: 'Monthly salary',
      status: 'completed',
      date: new Date('2024-01-01'),
    },
  ],

  mockWallet: {
    id: 'wallet-001',
    balance: 5000.75,
    currency: 'USD',
    type: 'checking',
    status: 'active',
  },

  createMockAuthContext: (user = testUtils.mockUser) => ({
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
  }),

  createMockApiResponse: (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  }),
};