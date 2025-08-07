'use client';

import { useState, useEffect, useCallback } from 'react';
import { walletAPI, handleApiError } from '@/lib/api';
import {
  WalletDashboardData,
  WalletConnection,
  WalletSyncStatus,
  ConnectWalletRequest,
  SyncWalletRequest,
} from '@/types/financial';

interface UseWalletsReturn {
  // Data
  dashboardData: WalletDashboardData | null;
  connections: WalletConnection[];
  syncStatuses: WalletSyncStatus[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Error handling
  error: string | null;
  
  // Actions
  loadDashboard: (force?: boolean) => Promise<void>;
  connectWallet: (request: ConnectWalletRequest) => Promise<void>;
  syncWallet: (connectionId: string, options?: SyncWalletRequest) => Promise<void>;
  disconnectWallet: (connectionId: string) => Promise<void>;
  updateWalletSettings: (connectionId: string, settings: any) => Promise<void>;
  
  // Utility
  getTotalBalance: () => number;
  getWalletCount: () => number;
  getActiveWalletCount: () => number;
  clearError: () => void;
}

export function useWallets(): UseWalletsReturn {
  const [dashboardData, setDashboardData] = useState<WalletDashboardData | null>(null);
  const [connections, setConnections] = useState<WalletConnection[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<WalletSyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (force = false) => {
    try {
      if (force) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Load all wallet data in parallel
      const [dashboardResponse, connectionsResponse, syncStatusResponse] = await Promise.all([
        walletAPI.getDashboard(),
        walletAPI.getConnections(),
        walletAPI.getSyncStatus(),
      ]);

      setDashboardData(dashboardResponse.data);
      setConnections(connectionsResponse.data);
      setSyncStatuses(syncStatusResponse.data);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const connectWallet = useCallback(async (request: ConnectWalletRequest) => {
    try {
      setError(null);
      const response = await walletAPI.connectWallet(request);
      
      // Reload dashboard data after successful connection
      if (response.data.status === 'connected') {
        await loadDashboard(true);
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
      throw error;
    }
  }, [loadDashboard]);

  const syncWallet = useCallback(async (connectionId: string, options?: SyncWalletRequest) => {
    try {
      setError(null);
      setIsRefreshing(true);
      
      await walletAPI.syncWallet(connectionId, options);
      
      // Reload dashboard data after sync
      await loadDashboard(true);
    } catch (error) {
      console.error('Failed to sync wallet:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const disconnectWallet = useCallback(async (connectionId: string) => {
    try {
      setError(null);
      await walletAPI.disconnectWallet(connectionId);
      
      // Reload dashboard data after disconnection
      await loadDashboard(true);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
      throw error;
    }
  }, [loadDashboard]);

  const updateWalletSettings = useCallback(async (connectionId: string, settings: any) => {
    try {
      setError(null);
      await walletAPI.updateSettings(connectionId, settings);
      
      // Reload dashboard data after settings update
      await loadDashboard(true);
    } catch (error) {
      console.error('Failed to update wallet settings:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
      throw error;
    }
  }, [loadDashboard]);

  const getTotalBalance = useCallback(() => {
    return dashboardData?.summary?.total_balance_usd || 0;
  }, [dashboardData]);

  const getWalletCount = useCallback(() => {
    return dashboardData?.summary?.total_wallets || 0;
  }, [dashboardData]);

  const getActiveWalletCount = useCallback(() => {
    return dashboardData?.summary?.active_wallets || 0;
  }, [dashboardData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-refresh for syncing wallets
  useEffect(() => {
    const hasSyncingWallets = dashboardData?.wallets?.some(w => w.status === 'syncing') || false;
    
    if (hasSyncingWallets && !isLoading && !isRefreshing) {
      const pollInterval = setInterval(() => {
        loadDashboard(true);
      }, 15000); // Poll every 15 seconds for syncing wallets

      return () => clearInterval(pollInterval);
    }
  }, [dashboardData, isLoading, isRefreshing, loadDashboard]);

  // Regular sync status check
  useEffect(() => {
    const statusInterval = setInterval(() => {
      if (!isLoading && !isRefreshing && connections.length > 0) {
        // Light refresh - just check sync status
        walletAPI.getSyncStatus()
          .then(response => setSyncStatuses(response.data))
          .catch(error => console.warn('Failed to update sync status:', error));
      }
    }, 60000); // Check every minute

    return () => clearInterval(statusInterval);
  }, [connections, isLoading, isRefreshing]);

  return {
    // Data
    dashboardData,
    connections,
    syncStatuses,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Error handling
    error,
    
    // Actions
    loadDashboard,
    connectWallet,
    syncWallet,
    disconnectWallet,
    updateWalletSettings,
    
    // Utility
    getTotalBalance,
    getWalletCount,
    getActiveWalletCount,
    clearError,
  };
}