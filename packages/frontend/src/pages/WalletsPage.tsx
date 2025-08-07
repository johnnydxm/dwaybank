import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { BalanceCard } from '../components/financial/BalanceCard';
import { MobileNavigation } from '../components/mobile/MobileNavigation';
import { QuickActionCard, TouchOptimizedCard } from '../components/mobile/TouchOptimizedCard';
import { useAccessibility, useScreenReader } from '../components/accessibility/AccessibilityProvider';
import { 
  Plus, 
  CreditCard, 
  Smartphone, 
  Wallet, 
  TrendingUp, 
  ArrowUpDown,
  Settings,
  Eye,
  EyeOff,
  Sync,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { 
  Account, 
  AccountBalance, 
  WalletDashboardData, 
  WalletConnection, 
  WalletPaymentMethod,
  WalletType 
} from '../types/financial';
import { accountAPI } from '../services/api';
import walletApi from '../services/walletApi';
import { formatCurrency } from '../utils/currency';

export default function WalletsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [walletDashboard, setWalletDashboard] = useState<WalletDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const { isMobile, settings } = useAccessibility();
  const { announceNavigation } = useScreenReader();

  useEffect(() => {
    announceNavigation('Wallets page');
    loadWalletsData();
  }, []);

  const loadWalletsData = async () => {
    setIsLoading(true);
    try {
      // Load both traditional accounts and wallet dashboard data
      const [accountsData, walletData] = await Promise.all([
        loadTraditionalAccounts(),
        walletApi.getDashboard()
      ]);

      setWalletDashboard(walletData);

      // Create balances map for traditional accounts
      const balanceMap = new Map<string, AccountBalance>();
      accountsData.forEach(account => {
        balanceMap.set(account.id, {
          current: account.balance,
          available: account.available_balance,
          pending: Math.random() * 100, // Would come from API in real implementation
          currency: account.currency
        });
      });
      setBalances(balanceMap);

    } catch (err: any) {
      console.error('Failed to load wallets data:', err);
      setError('Failed to load wallet information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTraditionalAccounts = async (): Promise<Account[]> => {
    try {
      // This would be replaced with actual account API call
      const mockAccounts: Account[] = [
        {
          id: '1',
          user_id: 'user1',
          account_number: '1234567890',
          account_type: 'checking',
          balance: 2500.75,
          available_balance: 2400.75,
          currency: 'USD',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-31T00:00:00Z',
          institution_name: 'Chase Bank',
          account_name: 'Primary Checking',
          is_primary: true
        },
        {
          id: '2',
          user_id: 'user1',
          account_number: '0987654321',
          account_type: 'savings',
          balance: 15000.00,
          available_balance: 15000.00,
          currency: 'USD',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-31T00:00:00Z',
          institution_name: 'Wells Fargo',
          account_name: 'High Yield Savings',
          is_primary: false
        }
      ];

      setAccounts(mockAccounts);
      return mockAccounts;
    } catch (error) {
      console.error('Failed to load traditional accounts:', error);
      return [];
    }
  };

  const handleRefreshBalance = async (accountId: string) => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentBalance = balances.get(accountId);
      if (currentBalance) {
        const updatedBalance = {
          ...currentBalance,
          current: currentBalance.current + (Math.random() - 0.5) * 100
        };
        setBalances(prev => new Map(prev.set(accountId, updatedBalance)));
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectWallet = async (walletType: WalletType) => {
    try {
      setError('');
      
      const connectRequest = {
        wallet_type: walletType,
        display_name: walletApi.getWalletDisplayName(walletType)
      };

      const result = await walletApi.connectWallet(connectRequest);
      
      if (result.status === 'pending_auth' && result.auth_url) {
        // Handle OAuth flow - redirect user or show QR code
        if (walletType === 'metamask') {
          // For MetaMask, show QR code or deeplink
          alert(`Scan this QR code with MetaMask: ${result.auth_url}`);
        } else {
          // For OAuth flows, redirect to authorization URL
          window.open(result.auth_url, '_blank');
        }
      } else if (result.status === 'connected') {
        // Wallet connected successfully, refresh dashboard
        await loadWalletsData();
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(`Failed to connect ${walletApi.getWalletDisplayName(walletType)}: ${err.message}`);
    }
  };

  const handleWalletAction = async (walletId: string, action: string) => {
    try {
      setError('');
      
      switch (action) {
        case 'sync':
          await handleSyncWallet(walletId);
          break;
        case 'disconnect':
          await handleDisconnectWallet(walletId);
          break;
        case 'settings':
          // Navigate to wallet settings (would be implemented)
          console.log('Navigate to wallet settings:', walletId);
          break;
        default:
          console.log(`Unknown wallet action: ${action}`);
      }
    } catch (err: any) {
      console.error(`Failed to ${action} wallet:`, err);
      setError(`Failed to ${action} wallet: ${err.message}`);
    }
  };

  const handleSyncWallet = async (walletId: string) => {
    try {
      setIsSyncing(walletId);
      await walletApi.syncWallet(walletId, true);
      await loadWalletsData(); // Refresh dashboard after sync
    } catch (err: any) {
      console.error('Failed to sync wallet:', err);
      throw err;
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDisconnectWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to disconnect this wallet?')) {
      return;
    }

    try {
      await walletApi.disconnectWallet(walletId);
      await loadWalletsData(); // Refresh dashboard after disconnect
    } catch (err: any) {
      console.error('Failed to disconnect wallet:', err);
      throw err;
    }
  };

  const getTotalBalance = () => {
    const traditionalBalance = accounts
      .filter(account => account.currency === 'USD')
      .reduce((total, account) => total + account.balance, 0);
    
    const walletBalance = walletDashboard?.total_balance_usd || 0;
    
    return traditionalBalance + walletBalance;
  };

  const getWalletIcon = (type: WalletType) => {
    return walletApi.getWalletIcon(type);
  };

  const getStatusColor = (status: string) => {
    return walletApi.getStatusColorClass(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your wallets...</p>
        </div>
        {isMobile && <MobileNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Wallets</h1>
              <p className="text-sm text-muted-foreground">
                Manage your accounts and connected payment methods
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBalances(!showBalances)}
                aria-label={showBalances ? 'Hide balances' : 'Show balances'}
              >
                {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={() => {
                // For now, just connect Google Pay as default - would show dropdown in real implementation
                handleConnectWallet('google_pay');
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Total Balance Overview */}
        <Card className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Total Balance</p>
                <p className="text-3xl font-bold">
                  {showBalances ? formatCurrency(getTotalBalance()) : '••••••'}
                </p>
                <p className="text-blue-100 text-sm mt-1">
                  Across {accounts.length + (walletDashboard?.connected_wallets.length || 0)} account{(accounts.length + (walletDashboard?.connected_wallets.length || 0)) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <Wallet className="h-12 w-12 text-blue-200 mb-2" />
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {(walletDashboard?.connected_wallets.length || 0)} Connected
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {isMobile && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <QuickActionCard
              icon={ArrowUpDown}
              title="Transfer"
              description="Between accounts"
              onAction={() => console.log('Transfer')}
              color="blue"
            />
            <QuickActionCard
              icon={TrendingUp}
              title="Invest"
              description="Start investing"
              onAction={() => console.log('Invest')}
              color="green"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bank Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bank Accounts</h2>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>

            <div className="space-y-4">
              {accounts.map((account) => {
                const balance = balances.get(account.id);
                if (!balance) return null;

                return (
                  <BalanceCard
                    key={account.id}
                    account={account}
                    balance={balance}
                    onRefresh={() => handleRefreshBalance(account.id)}
                    showAnimations={!settings.reduceMotion}
                  />
                );
              })}
            </div>
          </div>

          {/* Connected Wallets */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Connected Wallets</h2>
              <Button variant="outline" size="sm" onClick={() => {
                // For now, just connect Google Pay as default - would show dropdown in real implementation
                handleConnectWallet('google_pay');
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>

            <div className="space-y-3">
              {walletDashboard?.connected_wallets.map((wallet) => (
                <TouchOptimizedCard
                  key={wallet.id}
                  onTap={() => handleWalletAction(wallet.id, 'view')}
                  onSwipeLeft={() => handleWalletAction(wallet.id, 'settings')}
                  className="border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getWalletIcon(wallet.wallet_type)}
                      </div>
                      <div>
                        <p className="font-medium">{wallet.display_name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>Last sync: {wallet.last_sync ? new Date(wallet.last_sync).toLocaleString() : 'Never'}</span>
                          <span>• {wallet.sync_count} syncs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(wallet.status)}>
                        {wallet.status === 'connected' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {(wallet.status === 'syncing' || isSyncing === wallet.id) && <Sync className="h-3 w-3 mr-1 animate-spin" />}
                        {isSyncing === wallet.id ? 'syncing' : wallet.status}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleWalletAction(wallet.id, 'sync')}
                        disabled={isSyncing === wallet.id}
                        title="Sync wallet"
                      >
                        <Sync className={`h-4 w-4 ${isSyncing === wallet.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleWalletAction(wallet.id, 'settings')}
                        title="Wallet settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TouchOptimizedCard>
              )) || []}
            </div>

            {/* Available Wallets to Connect */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available Wallets</CardTitle>
                <CardDescription>
                  Connect popular payment methods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'Apple Pay', type: 'apple_pay' as WalletType },
                    { name: 'Google Pay', type: 'google_pay' as WalletType },
                    { name: 'MetaMask', type: 'metamask' as WalletType },
                    { name: 'Samsung Pay', type: 'samsung_pay' as WalletType },
                  ].filter(wallet => 
                    // Filter out already connected wallets
                    !walletDashboard?.connected_wallets.some(conn => conn.wallet_type === wallet.type)
                  ).map((wallet) => (
                    <Button
                      key={wallet.type}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-center space-y-2"
                      onClick={() => handleConnectWallet(wallet.type)}
                      disabled={isLoading}
                    >
                      <span className="text-2xl">{getWalletIcon(wallet.type)}</span>
                      <span className="text-sm font-medium">{wallet.name}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {isMobile && <MobileNavigation />}
    </div>
  );
}