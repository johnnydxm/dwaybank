'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MoreVertical,
  Trash2
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { WalletConnectionDialog } from '@/components/wallet/WalletConnectionDialog';
import { walletAPI, handleApiError } from '@/lib/api';
import { 
  WalletDashboardData, 
  WalletTransaction, 
  WalletConnection,
  WalletType,
  WalletStatus 
} from '@/types/financial';

function DashboardPageContent() {
  const { user, logout } = useAuth();
  const [dashboardData, setDashboardData] = useState<WalletDashboardData | null>(null);
  const [walletConnections, setWalletConnections] = useState<WalletConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastSyncFailed, setLastSyncFailed] = useState<string[]>([]);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [syncingWallets, setSyncingWallets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Enhanced real-time polling for sync status updates
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let quickPollInterval: NodeJS.Timeout;

    const hasSyncingWallets = dashboardData?.connected_wallets?.some(w => w.status === 'syncing') || false;
    const hasPendingWallets = dashboardData?.connected_wallets?.some(w => w.status === 'pending' || w.status === 'pending_auth') || false;
    
    if (hasSyncingWallets && !isLoading && !isRefreshing) {
      // Quick polling every 5 seconds for active syncing
      quickPollInterval = setInterval(() => {
        loadDashboardData(true);
      }, 5000);
    } else if (hasPendingWallets && !isLoading && !isRefreshing) {
      // Medium polling every 15 seconds for pending auth
      pollInterval = setInterval(() => {
        loadDashboardData(true);
      }, 15000);
    } else if (dashboardData?.connected_wallets && dashboardData.connected_wallets.length > 0) {
      // Regular polling every 60 seconds for general updates
      pollInterval = setInterval(() => {
        loadDashboardData(true);
      }, 60000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (quickPollInterval) clearInterval(quickPollInterval);
    };
  }, [dashboardData?.connected_wallets, isLoading, isRefreshing]);

  const loadDashboardData = async (force = false) => {
    try {
      if (force) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      // Load dashboard data and wallet connections in parallel
      const [dashboardResponse, connectionsResponse] = await Promise.all([
        walletAPI.getDashboard(),
        walletAPI.getConnections()
      ]);

      setDashboardData(dashboardResponse.data);
      setWalletConnections(connectionsResponse.data);
      setRetryCount(0); // Reset retry count on success
      
      // Check for any failed wallet syncs
      const failedWallets = dashboardResponse.data?.connected_wallets?.filter(w => w.status === 'error').map(w => w.display_name) || [];
      setLastSyncFailed(failedWallets);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
      setRetryCount(prev => prev + 1);
      
      // Auto-retry once if network error and first failure
      if (apiError.code === 'NETWORK_ERROR' && retryCount === 0 && !force) {
        setTimeout(() => {
          loadDashboardData(true);
        }, 3000);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleWalletSync = async (connectionId: string) => {
    try {
      setSyncingWallets(prev => new Set([...prev, connectionId]));
      setError(null);
      
      const response = await walletAPI.syncWallet(connectionId, { force_refresh: true });
      
      // Check for partial sync or errors
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Wallet sync completed with errors:', response.data.errors);
        setError(`Sync completed with issues: ${response.data.errors.join(', ')}`);
      }
      
      // Reload dashboard data after sync
      await loadDashboardData(true);
      
    } catch (error) {
      console.error('Failed to sync wallet:', error);
      const apiError = handleApiError(error);
      
      // Provide more specific error messages
      let errorMessage = apiError.message;
      if (apiError.code === 'WALLET_NOT_FOUND') {
        errorMessage = 'Wallet connection not found. Please reconnect your wallet.';
      } else if (apiError.code === 'NETWORK_ERROR') {
        errorMessage = 'Network connection issue. Please check your internet and try again.';
      } else if (apiError.status === 429) {
        errorMessage = 'Too many sync requests. Please wait a moment and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setSyncingWallets(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const handleWalletConnected = () => {
    // Reload dashboard data when a new wallet is connected
    loadDashboardData(true);
  };

  const handleDisconnectWallet = async (connectionId: string, walletName: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${walletName}? This will remove all associated payment methods and transaction history from your dashboard.`)) {
      return;
    }

    try {
      setSyncingWallets(prev => new Set([...prev, connectionId]));
      setError(null);
      
      await walletAPI.disconnectWallet(connectionId);
      
      // Reload dashboard data after disconnect
      await loadDashboardData(true);
      
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      const apiError = handleApiError(error);
      setError(`Failed to disconnect wallet: ${apiError.message}`);
    } finally {
      setSyncingWallets(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const getTotalBalance = () => {
    return dashboardData?.total_balance_usd || 0;
  };

  const getTotalWallets = () => {
    return dashboardData?.connected_wallets?.length || 0;
  };

  const getActiveWallets = () => {
    return dashboardData?.connected_wallets?.filter(w => w.status === 'connected').length || 0;
  };

  const getWalletBalance = (walletId: string) => {
    const walletPaymentMethods = dashboardData?.payment_methods?.filter(pm => pm.wallet_connection_id === walletId) || [];
    return walletPaymentMethods.reduce((total, pm) => {
      const balance = pm.balance?.current_balance || 0;
      const exchangeRate = pm.balance?.exchange_rate_usd || 1;
      return total + (balance * exchangeRate);
    }, 0);
  };

  const getPaymentMethodsCount = (walletId: string) => {
    return dashboardData?.payment_methods?.filter(pm => pm.wallet_connection_id === walletId && pm.is_active).length || 0;
  };

  const getTransactionsCount = (walletId: string) => {
    return dashboardData?.recent_transactions?.filter(tx => tx.wallet_connection_id === walletId).length || 0;
  };

  const getBalancesByCurrency = () => {
    if (!dashboardData?.payment_methods) return [];
    
    const currencyBalances = new Map<string, { total: number; walletCount: number; }>();
    
    dashboardData.payment_methods.forEach(pm => {
      if (pm.balance && pm.is_active) {
        const currency = pm.balance.currency;
        const balanceUSD = pm.balance.current_balance * (pm.balance.exchange_rate_usd || 1);
        
        if (currencyBalances.has(currency)) {
          const existing = currencyBalances.get(currency)!;
          existing.total += balanceUSD;
          existing.walletCount += 1;
        } else {
          currencyBalances.set(currency, { total: balanceUSD, walletCount: 1 });
        }
      }
    });
    
    return Array.from(currencyBalances.entries()).map(([currency, data]) => ({
      currency,
      total_balance: data.total,
      wallet_count: data.walletCount
    }));
  };

  const getCurrencyCount = () => {
    const currencies = new Set(
      dashboardData?.payment_methods
        ?.filter(pm => pm.balance && pm.is_active)
        ?.map(pm => pm.balance!.currency) || []
    );
    return currencies.size;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
    return `${amount.toFixed(4)} ${currency}`;
  };

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'apple_pay':
        return '🍎';
      case 'google_pay':
        return '🎨';
      case 'metamask':
        return '🦊';
      case 'samsung_pay':
        return '📱';
      case 'paypal':
        return '💙';
      default:
        return '💳';
    }
  };

  const getStatusBadge = (status: WalletStatus) => {
    const variants = {
      connected: 'default',
      disconnected: 'destructive',
      syncing: 'secondary',
      error: 'destructive',
      pending: 'secondary',
      pending_auth: 'secondary'
    } as const;

    const icons = {
      connected: <CheckCircle className="h-3 w-3 mr-1" />,
      disconnected: <AlertCircle className="h-3 w-3 mr-1" />,
      syncing: <RefreshCw className="h-3 w-3 mr-1 animate-spin" />,
      error: <AlertCircle className="h-3 w-3 mr-1" />,
      pending: <RefreshCw className="h-3 w-3 mr-1" />,
      pending_auth: <AlertCircle className="h-3 w-3 mr-1" />
    };

    return (
      <Badge variant={variants[status] || 'default'} className="flex items-center">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />;
      case 'debit':
        return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
      default:
        return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'credit':
        return 'bg-green-100 text-green-600';
      case 'debit':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3 sm:py-4">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">DwayBank</h1>
                <Badge variant="secondary" className="text-xs">Dashboard</Badge>
              </div>
              <LoadingSpinner size="sm" />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-600">Loading your financial dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Failed to Load Dashboard
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => loadDashboardData()} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">DwayBank</h1>
              <Badge variant="secondary" className="text-xs">Dashboard</Badge>
              {dashboardData?.sync_status && (
                <Badge 
                  variant={dashboardData.sync_status.failed_syncs > 0 ? 'destructive' : 
                          dashboardData.sync_status.pending_syncs > 0 ? 'secondary' : 'default'}
                  className="text-xs"
                >
                  {dashboardData.sync_status.failed_syncs > 0 ? 'Sync Issues' :
                   dashboardData.sync_status.pending_syncs > 0 ? 'Syncing' : 'Synced'}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {lastSyncFailed.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    // Trigger sync for all failed wallets
                    lastSyncFailed.forEach(async (walletName) => {
                      const wallet = dashboardData?.connected_wallets?.find(w => w.display_name === walletName);
                      if (wallet) {
                        await handleWalletSync(wallet.id);
                      }
                    });
                  }}
                  disabled={isRefreshing}
                  className="text-orange-600 hover:text-orange-700"
                  title={`${lastSyncFailed.length} wallet(s) failed to sync: ${lastSyncFailed.join(', ')}`}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {lastSyncFailed.length} Sync Failed
                </Button>
              )}
              {error && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => loadDashboardData(true)}
                  disabled={isRefreshing}
                  className="text-red-600 hover:text-red-700"
                  title={error}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Error
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => loadDashboardData(true)}
                disabled={isRefreshing}
                className="min-h-[40px]"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage src={user?.profile_picture} alt="Profile picture" />
                <AvatarFallback>
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={logout}
                className="min-h-[40px] hidden sm:flex"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8" role="main" aria-label="Dashboard content">
        {/* Overview Cards */}
        <section aria-labelledby="overview-heading" className="mb-6 sm:mb-8">
          <h2 id="overview-heading" className="sr-only">Account Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBalances(!showBalances)}
                className="min-h-[44px] min-w-[44px]"
                aria-label={showBalances ? 'Hide balance amounts' : 'Show balance amounts'}
                aria-pressed={!showBalances}
              >
                {showBalances ? 
                  <Eye className="h-4 w-4" aria-hidden="true" /> : 
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                }
              </Button>
            </CardHeader>
            <CardContent>
              <div 
                className="text-xl sm:text-2xl font-bold" 
                aria-live="polite"
                aria-label={showBalances ? `Total balance: ${formatCurrency(getTotalBalance())}` : 'Balance hidden'}
              >
                {showBalances ? formatCurrency(getTotalBalance()) : '••••'}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {getTotalWallets()} connected wallets
              </p>
              {dashboardData?.sync_status?.last_full_sync && (
                <p className="text-xs text-gray-400 mt-1">
                  Last sync: {new Date(dashboardData.sync_status.last_full_sync).toLocaleDateString()}
                  {dashboardData.sync_status.pending_syncs > 0 && (
                    <span className="ml-2 inline-flex items-center">
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      {dashboardData.sync_status.pending_syncs} syncing
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Wallets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {getTotalWallets()}
              </div>
              <p className="text-xs text-muted-foreground">
                {getActiveWallets()} active
              </p>
              {getCurrencyCount() > 1 && (
                <p className="text-xs text-gray-400 mt-1">
                  {getCurrencyCount()} currencies
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {dashboardData?.recent_transactions?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Recent activity
              </p>
              {dashboardData?.recent_transactions && dashboardData.recent_transactions.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Latest: {new Date(dashboardData.recent_transactions[0].transaction_date).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Wallets */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Your Wallets</CardTitle>
                  <CardDescription>
                    Manage your connected payment methods
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  className="min-h-[44px] self-start sm:self-center"
                  onClick={() => setShowConnectDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Connect Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <nav aria-label="Connected wallets">
                {dashboardData?.connected_wallets && dashboardData.connected_wallets.length > 0 ? (
                  <ul className="space-y-3" role="list">
                    {dashboardData.connected_wallets.map((wallet) => (
                      <li key={wallet.id}>
                        <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="text-xl sm:text-2xl" role="img" aria-label={`${wallet.wallet_type} wallet`}>
                              {getWalletIcon(wallet.wallet_type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base truncate">{wallet.display_name}</p>
                              <p className="text-xs sm:text-sm text-gray-500" aria-live="polite">
                                {showBalances 
                                  ? formatCurrency(getWalletBalance(wallet.id))
                                  : '••••'
                                }
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-400">
                                  {getPaymentMethodsCount(wallet.id)} payment methods
                                </span>
                                {wallet.last_sync && (
                                  <span className="text-xs text-gray-400">
                                    • Last sync: {new Date(wallet.last_sync).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="ml-3 flex items-center space-x-2">
                            {getStatusBadge(wallet.status)}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleWalletSync(wallet.id)}
                              disabled={
                                isRefreshing || 
                                wallet.status === 'syncing' || 
                                syncingWallets.has(wallet.id)
                              }
                              className="min-h-[32px] min-w-[32px] p-1"
                              aria-label={`Sync ${wallet.display_name}`}
                            >
                              <RefreshCw className={`h-3 w-3 ${
                                wallet.status === 'syncing' || syncingWallets.has(wallet.id) 
                                  ? 'animate-spin' 
                                  : ''
                              }`} />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="min-h-[32px] min-w-[32px] p-1"
                                  aria-label={`${wallet.display_name} actions`}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleDisconnectWallet(wallet.id, wallet.display_name)}
                                  disabled={syncingWallets.has(wallet.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Disconnect
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No wallets connected</p>
                    <p className="text-sm">Connect your first wallet to get started</p>
                  </div>
                )}
              </nav>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <CardDescription>
                Your latest wallet activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <nav aria-label="Recent transactions">
                {dashboardData?.recent_transactions && dashboardData.recent_transactions.length > 0 ? (
                  <ul className="space-y-3" role="list">
                    {dashboardData.recent_transactions.map((transaction) => (
                      <li key={transaction.id}>
                        <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div 
                              className={`p-2 rounded-full ${getTransactionColor(transaction.transaction_type)}`}
                              role="img"
                              aria-label={`${transaction.transaction_type} transaction`}
                            >
                              {getTransactionIcon(transaction.transaction_type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base truncate">
                                {transaction.description}
                              </p>
                              <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
                                <span>
                                  {new Date(transaction.transaction_date).toLocaleDateString()}
                                </span>
                                {transaction.merchant_name && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{transaction.merchant_name}</span>
                                  </>
                                )}
                                {/* Show wallet name for transaction */}
                                {(() => {
                                  const wallet = dashboardData?.connected_wallets?.find(w => 
                                    w.id === transaction.wallet_connection_id
                                  );
                                  return wallet && (
                                    <>
                                      <span>•</span>
                                      <span className="text-xs text-gray-400">
                                        {getWalletIcon(wallet.wallet_type)} {wallet.display_name}
                                      </span>
                                    </>
                                  );
                                })()}
                                {transaction.status !== 'completed' && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {transaction.status}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="ml-3 text-right">
                            <div className={`font-medium text-sm sm:text-base ${
                              transaction.transaction_type === 'credit' 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {transaction.transaction_type === 'credit' ? '+' : '-'}
                              {showBalances 
                                ? formatCurrency(transaction.amount, transaction.currency)
                                : '••••'
                              }
                            </div>
                            {transaction.fee_amount && transaction.fee_amount > 0 && (
                              <div className="text-xs text-gray-400">
                                Fee: {formatCurrency(transaction.fee_amount, transaction.currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No transactions yet</p>
                    <p className="text-sm">Your transaction history will appear here</p>
                  </div>
                )}
              </nav>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation />

      {/* Wallet Connection Dialog */}
      <WalletConnectionDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        onWalletConnected={handleWalletConnected}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardPageContent />
    </ProtectedRoute>
  );
}