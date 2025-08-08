/**
 * DwayBank Smart Wallet - Frontend Wallet API Service
 * Handles wallet integration API calls from the frontend
 */

import { API_BASE_URL } from '../config/api';
import {
  WalletConnection,
  WalletPaymentMethod,
  WalletBalance,
  WalletTransaction,
  WalletDashboardData,
  ConnectWalletRequest,
  ConnectWalletResponse,
  SyncWalletRequest,
  SyncWalletResponse,
  WalletType
} from '../types/financial';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

class WalletApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/wallets`;
  }

  /**
   * Get authentication headers with JWT token
   */
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Handle API response and extract data
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return data;
  }

  /**
   * Get wallet dashboard data
   */
  async getDashboard(): Promise<WalletDashboardData> {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<WalletDashboardData>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get wallet dashboard:', error);
      throw error;
    }
  }

  /**
   * Get all wallet connections for the user
   */
  async getConnections(): Promise<WalletConnection[]> {
    try {
      const response = await fetch(`${this.baseUrl}/connections`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<WalletConnection[]>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get wallet connections:', error);
      throw error;
    }
  }

  /**
   * Connect a new wallet
   */
  async connectWallet(request: ConnectWalletRequest): Promise<ConnectWalletResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      const result = await this.handleResponse<ConnectWalletResponse>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  /**
   * Sync wallet data
   */
  async syncWallet(connectionId: string, forceRefresh = false): Promise<SyncWalletResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${connectionId}/sync`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ force_refresh: forceRefresh })
      });

      const result = await this.handleResponse<SyncWalletResponse>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to sync wallet:', error);
      throw error;
    }
  }

  /**
   * Disconnect a wallet
   */
  async disconnectWallet(connectionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${connectionId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      await this.handleResponse<void>(response);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  /**
   * Get payment methods for a specific wallet
   */
  async getPaymentMethods(connectionId: string): Promise<WalletPaymentMethod[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${connectionId}/payment-methods`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<WalletPaymentMethod[]>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a specific wallet
   */
  async getTransactions(
    connectionId: string, 
    options: { limit?: number; offset?: number; since?: Date } = {}
  ): Promise<{ transactions: WalletTransaction[]; pagination: any }> {
    try {
      const params = new URLSearchParams();
      
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.since) params.append('since', options.since.toISOString());

      const url = `${this.baseUrl}/${connectionId}/transactions?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<{ transactions: WalletTransaction[]; pagination: any }>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get transactions:', error);
      throw error;
    }
  }

  /**
   * Get balances for a specific wallet
   */
  async getBalances(connectionId: string): Promise<WalletBalance[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${connectionId}/balances`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<WalletBalance[]>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get balances:', error);
      throw error;
    }
  }

  /**
   * Get sync status for all wallets
   */
  async getSyncStatus(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sync/status`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result = await this.handleResponse<any[]>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  /**
   * Update wallet settings
   */
  async updateWalletSettings(
    connectionId: string, 
    settings: {
      display_name?: string;
      auto_sync_enabled?: boolean;
      sync_frequency?: number;
    }
  ): Promise<WalletConnection> {
    try {
      const response = await fetch(`${this.baseUrl}/${connectionId}/settings`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(settings)
      });

      const result = await this.handleResponse<WalletConnection>(response);
      return result.data!;
    } catch (error) {
      console.error('Failed to update wallet settings:', error);
      throw error;
    }
  }

  /**
   * Get wallet icon for display
   */
  getWalletIcon(walletType: WalletType): string {
    const icons: Record<WalletType, string> = {
      'apple_pay': '🍎',
      'google_pay': '🎨',
      'metamask': '🦊',
      'samsung_pay': '📱',
      'paypal': '💙',
      'manual': '💳'
    };
    
    return icons[walletType] || '💳';
  }

  /**
   * Get wallet display name
   */
  getWalletDisplayName(walletType: WalletType): string {
    const names: Record<WalletType, string> = {
      'apple_pay': 'Apple Pay',
      'google_pay': 'Google Pay',
      'metamask': 'MetaMask',
      'samsung_pay': 'Samsung Pay',
      'paypal': 'PayPal',
      'manual': 'Manual Entry'
    };
    
    return names[walletType] || walletType;
  }

  /**
   * Get wallet status color class
   */
  getStatusColorClass(status: string): string {
    const statusColors: Record<string, string> = {
      'connected': 'text-green-600 bg-green-50',
      'syncing': 'text-yellow-600 bg-yellow-50',
      'error': 'text-red-600 bg-red-50',
      'disconnected': 'text-gray-600 bg-gray-50',
      'pending_auth': 'text-blue-600 bg-blue-50'
    };
    
    return statusColors[status] || 'text-gray-600 bg-gray-50';
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format crypto amount
   */
  formatCrypto(amount: number, symbol: string): string {
    if (amount < 0.001) {
      return `${amount.toFixed(8)} ${symbol}`;
    } else if (amount < 1) {
      return `${amount.toFixed(4)} ${symbol}`;
    } else {
      return `${amount.toFixed(2)} ${symbol}`;
    }
  }

  /**
   * Get payment method type icon
   */
  getPaymentMethodIcon(type: string): string {
    const typeIcons: Record<string, string> = {
      'credit_card': '💳',
      'debit_card': '💳',
      'bank_account': '🏦',
      'crypto_wallet': '₿',
      'digital_wallet': '📱'
    };
    
    return typeIcons[type] || '💳';
  }

  /**
   * Check if wallet type supports real-time balances
   */
  supportsRealTimeBalances(walletType: WalletType): boolean {
    // Only MetaMask currently supports real-time blockchain balance queries
    // Apple Pay and Google Pay have limited balance API access
    return walletType === 'metamask';
  }

  /**
   * Check if wallet type supports transaction history
   */
  supportsTransactionHistory(walletType: WalletType): boolean {
    // MetaMask supports full transaction history via blockchain APIs
    // Apple Pay and Google Pay have limited transaction access
    return walletType === 'metamask';
  }

  /**
   * Get recommended sync frequency for wallet type
   */
  getRecommendedSyncFrequency(walletType: WalletType): number {
    const frequencies: Record<WalletType, number> = {
      'apple_pay': 60,      // 1 hour (limited API access)
      'google_pay': 60,     // 1 hour (limited API access)
      'metamask': 5,        // 5 minutes (real-time blockchain data)
      'samsung_pay': 60,    // 1 hour
      'paypal': 30,         // 30 minutes
      'manual': 1440        // 24 hours (manual entry)
    };
    
    return frequencies[walletType] || 60;
  }
}

export const walletApi = new WalletApiService();
export default walletApi;