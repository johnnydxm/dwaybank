/**
 * API Configuration for DwayBank Frontend
 */

// Base URL for the DwayBank API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/api/v1/auth/login',
  AUTH_REGISTER: '/api/v1/auth/register',
  AUTH_PROFILE: '/api/v1/auth/profile',
  AUTH_REFRESH: '/api/v1/auth/refresh',
  AUTH_LOGOUT: '/api/v1/auth/logout',
  
  // Dashboard
  DASHBOARD: '/api/v1/dashboard',
  WALLETS_DASHBOARD: '/api/v1/wallets/dashboard',
  
  // Wallets
  WALLETS: '/api/v1/wallets',
  WALLET_CONNECT: '/api/v1/wallets/connect',
  
  // Transactions
  TRANSACTIONS: '/api/v1/transactions',
  TRANSACTION_CATEGORIES: '/api/v1/transactions/categories',
  
  // Budgets
  BUDGETS: '/api/v1/budgets',
  
  // Goals  
  GOALS: '/api/v1/goals',
  
  // Insights
  INSIGHTS: '/api/v1/insights',
  
  // Accounts
  ACCOUNTS: '/api/v1/accounts',
} as const;

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 10000;

// Default headers
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
} as const;