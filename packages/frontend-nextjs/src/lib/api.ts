import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  MFASetupResponse,
  MFAVerificationRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  SessionInfo
} from '@/types/auth';
import {
  Account,
  Transaction,
  TransactionCategory,
  Budget,
  Goal,
  PaymentMethod,
  Notification,
  SecurityAlert,
  FinancialInsight,
  MonthlySpending,
  TransferRequest,
  BiometricAuthRequest,
  DeviceInfo,
  WalletConnection,
  WalletDashboardData,
  WalletTransaction,
  WalletBalance,
  WalletPaymentMethod,
  WalletSyncStatus,
  ConnectWalletRequest,
  ConnectWalletResponse,
  SyncWalletRequest,
  SyncWalletResponse
} from '@/types/financial';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';
const API_TIMEOUT = 10000; // 10 seconds

// Create axios instance with default configuration
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth token
  client.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for token refresh and error handling
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          if (typeof window !== 'undefined') {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });

              // Backend returns nested data structure
              const tokensData = response.data.data?.tokens || response.data;
              const accessToken = tokensData.access_token;
              
              if (accessToken) {
                localStorage.setItem('access_token', accessToken);
                
                // Update refresh token if provided
                if (tokensData.refresh_token) {
                  localStorage.setItem('refresh_token', tokensData.refresh_token);
                }

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return client(originalRequest);
              }
            }
          }
        } catch (refreshError) {
          // Refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

const apiClient = createApiClient();

// Generic API response wrapper
interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

// Backend API response structure
interface BackendApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
  requestId: string;
  error?: string;
}

// API Response handler
const handleResponse = <T>(response: AxiosResponse<BackendApiResponse<T>>): ApiResponse<T> => ({
  data: response.data.data,
  message: response.data.message,
  status: response.status,
});

// Authentication API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post('/auth/login', credentials);
    return handleResponse(response);
  },

  register: async (userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post('/auth/register', userData);
    return handleResponse(response);
  },

  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/logout');
    return handleResponse(response);
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get('/auth/profile');
    return handleResponse(response);
  },

  updateProfile: async (userData: Partial<User>): Promise<ApiResponse<User>> => {
    const response = await apiClient.put('/auth/profile', userData);
    return handleResponse(response);
  },

  changePassword: async (passwordData: PasswordChangeRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.put('/auth/change-password', passwordData);
    return handleResponse(response);
  },

  requestPasswordReset: async (data: PasswordResetRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/forgot-password', data);
    return handleResponse(response);
  },

  confirmPasswordReset: async (data: PasswordResetConfirmRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/reset-password', data);
    return handleResponse(response);
  },

  refreshToken: async (): Promise<ApiResponse<{ access_token: string }>> => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    return handleResponse(response);
  },

  verifyMFA: async (code: string, userId: string, sessionId: string): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post('/auth/verify-mfa', {
      code,
    }, {
      headers: {
        'x-user-id': userId,
        'x-session-id': sessionId,
      }
    });
    return handleResponse(response);
  },
};

// Multi-Factor Authentication API
export const mfaAPI = {
  setupMFA: async (): Promise<ApiResponse<MFASetupResponse>> => {
    const response = await apiClient.post('/auth/mfa/setup');
    return handleResponse(response);
  },

  verifyMFA: async (data: MFAVerificationRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/mfa/verify', data);
    return handleResponse(response);
  },

  disableMFA: async (data: MFAVerificationRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/mfa/disable', data);
    return handleResponse(response);
  },

  generateBackupCodes: async (): Promise<ApiResponse<{ backup_codes: string[] }>> => {
    const response = await apiClient.post('/auth/mfa/backup-codes');
    return handleResponse(response);
  },
};

// Account Management API
export const accountAPI = {
  getAccounts: async (): Promise<ApiResponse<Account[]>> => {
    const response = await apiClient.get('/accounts');
    return handleResponse(response);
  },

  getAccount: async (accountId: string): Promise<ApiResponse<Account>> => {
    const response = await apiClient.get(`/accounts/${accountId}`);
    return handleResponse(response);
  },

  createAccount: async (accountData: Partial<Account>): Promise<ApiResponse<Account>> => {
    const response = await apiClient.post('/accounts', accountData);
    return handleResponse(response);
  },

  updateAccount: async (accountId: string, accountData: Partial<Account>): Promise<ApiResponse<Account>> => {
    const response = await apiClient.put(`/accounts/${accountId}`, accountData);
    return handleResponse(response);
  },

  closeAccount: async (accountId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/accounts/${accountId}`);
    return handleResponse(response);
  },
};

// Transaction API
export const transactionAPI = {
  getTransactions: async (params?: {
    account_id?: string;
    category_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Transaction[]>> => {
    const response = await apiClient.get('/transactions', { params });
    return handleResponse(response);
  },

  getTransaction: async (transactionId: string): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.get(`/transactions/${transactionId}`);
    return handleResponse(response);
  },

  createTransfer: async (transferData: TransferRequest): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post('/transactions/transfer', transferData);
    return handleResponse(response);
  },

  categorizeTransaction: async (transactionId: string, categoryId: string): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.put(`/transactions/${transactionId}/category`, { category_id: categoryId });
    return handleResponse(response);
  },

  getTransactionCategories: async (): Promise<ApiResponse<TransactionCategory[]>> => {
    const response = await apiClient.get('/transactions/categories');
    return handleResponse(response);
  },

  getMonthlySpending: async (year: number, month: number): Promise<ApiResponse<MonthlySpending>> => {
    const response = await apiClient.get(`/transactions/spending/${year}/${month}`);
    return handleResponse(response);
  },

  exportTransactions: async (params: {
    format: 'csv' | 'pdf';
    start_date?: string;
    end_date?: string;
    account_id?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get('/transactions/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },
};

// Budget and Goals API
export const budgetAPI = {
  getBudgets: async (): Promise<ApiResponse<Budget[]>> => {
    const response = await apiClient.get('/budgets');
    return handleResponse(response);
  },

  createBudget: async (budgetData: Partial<Budget>): Promise<ApiResponse<Budget>> => {
    const response = await apiClient.post('/budgets', budgetData);
    return handleResponse(response);
  },

  updateBudget: async (budgetId: string, budgetData: Partial<Budget>): Promise<ApiResponse<Budget>> => {
    const response = await apiClient.put(`/budgets/${budgetId}`, budgetData);
    return handleResponse(response);
  },

  deleteBudget: async (budgetId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/budgets/${budgetId}`);
    return handleResponse(response);
  },

  getGoals: async (): Promise<ApiResponse<Goal[]>> => {
    const response = await apiClient.get('/goals');
    return handleResponse(response);
  },

  createGoal: async (goalData: Partial<Goal>): Promise<ApiResponse<Goal>> => {
    const response = await apiClient.post('/goals', goalData);
    return handleResponse(response);
  },

  updateGoal: async (goalId: string, goalData: Partial<Goal>): Promise<ApiResponse<Goal>> => {
    const response = await apiClient.put(`/goals/${goalId}`, goalData);
    return handleResponse(response);
  },

  deleteGoal: async (goalId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/goals/${goalId}`);
    return handleResponse(response);
  },
};

// Wallet Integration API
export const walletAPI = {
  // Get wallet dashboard data
  getDashboard: async (): Promise<ApiResponse<WalletDashboardData>> => {
    const response = await apiClient.get('/wallets/dashboard');
    return handleResponse(response);
  },

  // Get all wallet connections
  getConnections: async (): Promise<ApiResponse<WalletConnection[]>> => {
    const response = await apiClient.get('/wallets/connections');
    return handleResponse(response);
  },

  // Connect a new wallet
  connectWallet: async (request: ConnectWalletRequest): Promise<ApiResponse<ConnectWalletResponse>> => {
    const response = await apiClient.post('/wallets/connect', request);
    return handleResponse(response);
  },

  // Disconnect a wallet
  disconnectWallet: async (connectionId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/wallets/${connectionId}`);
    return handleResponse(response);
  },

  // Sync wallet data
  syncWallet: async (connectionId: string, request?: SyncWalletRequest): Promise<ApiResponse<SyncWalletResponse>> => {
    const response = await apiClient.post(`/wallets/${connectionId}/sync`, request || {});
    return handleResponse(response);
  },

  // Get wallet sync status
  getSyncStatus: async (): Promise<ApiResponse<WalletSyncStatus[]>> => {
    const response = await apiClient.get('/wallets/sync/status');
    return handleResponse(response);
  },

  // Get payment methods for a wallet
  getPaymentMethods: async (connectionId: string): Promise<ApiResponse<WalletPaymentMethod[]>> => {
    const response = await apiClient.get(`/wallets/${connectionId}/payment-methods`);
    return handleResponse(response);
  },

  // Get transactions for a wallet
  getTransactions: async (
    connectionId: string, 
    params?: {
      limit?: number;
      offset?: number;
      since?: string;
    }
  ): Promise<ApiResponse<{
    transactions: WalletTransaction[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  }>> => {
    const response = await apiClient.get(`/wallets/${connectionId}/transactions`, { params });
    return handleResponse(response);
  },

  // Get balances for a wallet
  getBalances: async (connectionId: string): Promise<ApiResponse<WalletBalance[]>> => {
    const response = await apiClient.get(`/wallets/${connectionId}/balances`);
    return handleResponse(response);
  },

  // Update wallet settings
  updateSettings: async (
    connectionId: string, 
    settings: {
      display_name?: string;
      auto_sync_enabled?: boolean;
      sync_frequency?: number;
    }
  ): Promise<ApiResponse<Partial<WalletConnection>>> => {
    const response = await apiClient.put(`/wallets/${connectionId}/settings`, settings);
    return handleResponse(response);
  },

  // Get all transactions across all wallets
  getAllTransactions: async (params?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<ApiResponse<WalletTransaction[]>> => {
    const connections = await walletAPI.getConnections();
    const allTransactions: WalletTransaction[] = [];
    
    // Fetch transactions from all connected wallets
    for (const connection of connections.data) {
      try {
        const transactionResponse = await walletAPI.getTransactions(connection.id, params);
        allTransactions.push(...transactionResponse.data.transactions);
      } catch (error) {
        console.warn(`Failed to fetch transactions for wallet ${connection.id}:`, error);
      }
    }

    // Sort by transaction date (most recent first)
    allTransactions.sort((a, b) => 
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    );

    // Apply limit if specified
    const limitedTransactions = params?.limit 
      ? allTransactions.slice(params.offset || 0, (params.offset || 0) + params.limit)
      : allTransactions;

    return {
      data: limitedTransactions,
      message: 'Transactions retrieved successfully',
      status: 200
    };
  },
};

// Export the main API client for direct usage if needed
export { apiClient };

// Error types for better error handling
export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: any;
}

// Error handler utility
export const handleApiError = (error: any): ApiError => {
  if (error.response) {
    return {
      message: error.response.data?.message || 'An error occurred',
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      status: error.response.status,
      details: error.response.data?.details,
    };
  } else if (error.request) {
    return {
      message: 'Network error - please check your connection',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  } else {
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNEXPECTED_ERROR',
      status: 0,
    };
  }
};