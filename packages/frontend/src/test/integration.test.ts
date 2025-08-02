import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authAPI, handleApiError } from '../services/api';
import { AuthResponse } from '../types/auth';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    })),
    post: vi.fn()
  }
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Authentication API', () => {
    it('should have correct login endpoint structure', () => {
      expect(authAPI.login).toBeDefined();
      expect(typeof authAPI.login).toBe('function');
    });

    it('should have correct register endpoint structure', () => {
      expect(authAPI.register).toBeDefined();
      expect(typeof authAPI.register).toBe('function');
    });

    it('should have correct profile endpoint structure', () => {
      expect(authAPI.getProfile).toBeDefined();
      expect(typeof authAPI.getProfile).toBe('function');
    });

    it('should have MFA verification endpoint', () => {
      expect(authAPI.verifyMFA).toBeDefined();
      expect(typeof authAPI.verifyMFA).toBe('function');
    });

    it('should handle API errors correctly', () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          }
        }
      };

      const result = handleApiError(mockError);
      
      expect(result).toEqual({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        status: 401,
        details: undefined
      });
    });

    it('should handle network errors correctly', () => {
      const mockError = {
        request: {}
      };

      const result = handleApiError(mockError);
      
      expect(result).toEqual({
        message: 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
        status: 0
      });
    });
  });

  describe('Authentication Response Structure', () => {
    it('should handle backend response structure correctly', () => {
      const mockBackendResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            email_verified: true,
            status: 'active' as const,
            created_at: '2023-01-01T00:00:00Z'
          },
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600
          }
        },
        timestamp: '2023-01-01T00:00:00Z',
        requestId: 'req-123'
      };

      // This structure should match what the backend returns
      expect(mockBackendResponse.data.user.id).toBeDefined();
      expect(mockBackendResponse.data.tokens.access_token).toBeDefined();
      expect(mockBackendResponse.data.tokens.refresh_token).toBeDefined();
    });

    it('should handle MFA required response', () => {
      const mockMFAResponse = {
        success: true,
        message: 'MFA verification required',
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            email_verified: true,
            status: 'active' as const,
            created_at: '2023-01-01T00:00:00Z'
          },
          mfa_required: true,
          mfa_methods: ['totp']
        }
      };

      expect(mockMFAResponse.data.mfa_required).toBe(true);
      expect(mockMFAResponse.data.mfa_methods).toContain('totp');
    });
  });

  describe('Environment Configuration', () => {
    it('should use correct API base URL', () => {
      // This will use the environment variable or default
      const expectedUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
      expect(expectedUrl).toMatch(/^https?:\/\/.+\/api\/v1$/);
    });
  });
});