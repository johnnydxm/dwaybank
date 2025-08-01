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
import { Account, AccountBalance } from '../types/financial';
import { accountAPI, walletAPI } from '../services/api';
import { formatCurrency } from '../utils/currency';

export default function WalletsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [connectedWallets, setConnectedWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { isMobile, settings } = useAccessibility();
  const { announceNavigation } = useScreenReader();

  useEffect(() => {
    announceNavigation('Wallets page');
    loadWalletsData();
  }, []);

  const loadWalletsData = async () => {
    setIsLoading(true);
    try {
      // Mock data for demonstration
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

      const mockWallets = [
        {
          id: '1',
          name: 'Apple Pay',
          type: 'apple_pay',
          status: 'connected',
          lastSync: '2 hours ago',
          transactionCount: 42
        },
        {
          id: '2',
          name: 'Google Pay',
          type: 'google_pay',
          status: 'syncing',
          lastSync: '1 day ago',
          transactionCount: 18
        }
      ];

      setAccounts(mockAccounts);
      setConnectedWallets(mockWallets);

      // Create balances
      const balanceMap = new Map<string, AccountBalance>();
      mockAccounts.forEach(account => {
        balanceMap.set(account.id, {
          current: account.balance,
          available: account.available_balance,
          pending: Math.random() * 100,
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

  const handleConnectWallet = () => {
    console.log('Navigate to connect wallet');
  };

  const handleWalletAction = (walletId: string, action: string) => {
    console.log(`${action} wallet:`, walletId);
  };

  const getTotalBalance = () => {
    return accounts
      .filter(account => account.currency === 'USD')
      .reduce((total, account) => total + account.balance, 0);
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'apple_pay':
        return '🍎';
      case 'google_pay':
        return '🎨';
      case 'samsung_pay':
        return '📱';
      case 'paypal':
        return '💙';
      case 'venmo':
        return '💸';
      default:
        return '💳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50';
      case 'syncing':
        return 'text-yellow-600 bg-yellow-50';
      case 'disconnected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
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
              <Button size="sm" onClick={handleConnectWallet}>
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
                  Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <Wallet className="h-12 w-12 text-blue-200 mb-2" />
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {connectedWallets.length} Connected
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
              <Button variant="outline" size="sm" onClick={handleConnectWallet}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>

            <div className="space-y-3">
              {connectedWallets.map((wallet) => (
                <TouchOptimizedCard
                  key={wallet.id}
                  onTap={() => handleWalletAction(wallet.id, 'view')}
                  onSwipeLeft={() => handleWalletAction(wallet.id, 'settings')}
                  className="border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getWalletIcon(wallet.type)}
                      </div>
                      <div>
                        <p className="font-medium">{wallet.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>Last sync: {wallet.lastSync || 'Never'}</span>
                          {wallet.transactionCount && (
                            <span>• {wallet.transactionCount} transactions</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(wallet.status)}>
                        {wallet.status === 'connected' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {wallet.status === 'syncing' && <Sync className="h-3 w-3 mr-1 animate-spin" />}
                        {wallet.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TouchOptimizedCard>
              ))}
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
                    { name: 'Apple Pay', type: 'apple_pay', icon: '🍎' },
                    { name: 'Google Pay', type: 'google_pay', icon: '🎨' },
                    { name: 'Samsung Pay', type: 'samsung_pay', icon: '📱' },
                    { name: 'PayPal', type: 'paypal', icon: '💙' },
                  ].map((wallet) => (
                    <Button
                      key={wallet.type}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-center space-y-2"
                      onClick={() => console.log('Connect', wallet.type)}
                    >
                      <span className="text-2xl">{wallet.icon}</span>
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