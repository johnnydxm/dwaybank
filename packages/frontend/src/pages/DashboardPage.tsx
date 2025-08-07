import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { walletAPI } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import LoadingSpinner from '../components/ui/loading-spinner';
import MobileNavigation from '../components/mobile/MobileNavigation';

interface WalletBalance {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  status: 'connected' | 'disconnected' | 'syncing';
}

interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
  wallet_id: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API calls (replace with actual API calls)
      const [walletsResponse, transactionsResponse] = await Promise.all([
        // walletAPI.getWallets(),
        // walletAPI.getTransactions()
        
        // Mock data for now
        Promise.resolve({ data: [
          {
            id: '1',
            name: 'Apple Pay',
            type: 'apple_pay',
            balance: 1250.50,
            currency: 'USD',
            status: 'connected' as const
          },
          {
            id: '2', 
            name: 'Google Pay',
            type: 'google_pay',
            balance: 750.25,
            currency: 'USD',
            status: 'connected' as const
          },
          {
            id: '3',
            name: 'MetaMask',
            type: 'metamask',
            balance: 0.15,
            currency: 'ETH',
            status: 'syncing' as const
          }
        ]}),
        Promise.resolve({ data: [
          {
            id: '1',
            type: 'incoming' as const,
            amount: 150.00,
            currency: 'USD',
            description: 'Coffee shop payment',
            timestamp: new Date().toISOString(),
            wallet_id: '1'
          },
          {
            id: '2',
            type: 'outgoing' as const,
            amount: 50.00,
            currency: 'USD',
            description: 'Grocery store',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            wallet_id: '2'
          }
        ]})
      ]);

      setWallets(walletsResponse.data);
      setTransactions(transactionsResponse.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalBalance = () => {
    return wallets
      .filter(wallet => wallet.currency === 'USD')
      .reduce((total, wallet) => total + wallet.balance, 0);
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
    return `${amount} ${currency}`;
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'apple_pay':
        return '🍎';
      case 'google_pay':
        return '🎨';
      case 'metamask':
        return '🦊';
      default:
        return '💳';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: 'default',
      disconnected: 'destructive',
      syncing: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
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
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
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
                aria-label={showBalances ? `Total balance: ${formatCurrency(getTotalBalance(), 'USD')}` : 'Balance hidden'}
              >
                {showBalances ? formatCurrency(getTotalBalance(), 'USD') : '••••'}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all connected wallets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Wallets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{wallets.length}</div>
              <p className="text-xs text-muted-foreground">
                {wallets.filter(w => w.status === 'connected').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">
                This week
              </p>
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
                <Button size="sm" className="min-h-[44px] self-start sm:self-center">
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Connect Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <nav aria-label="Connected wallets">
                <ul className="space-y-3" role="list">
                  {wallets.map((wallet) => (
                    <li key={wallet.id}>
                      <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="text-xl sm:text-2xl" role="img" aria-label={`${wallet.type} wallet`}>
                            {getWalletIcon(wallet.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base truncate">{wallet.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500" aria-live="polite">
                              {showBalances 
                                ? formatCurrency(wallet.balance, wallet.currency)
                                : '••••'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="ml-3">
                          {getStatusBadge(wallet.status)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
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
                <ul className="space-y-3" role="list">
                  {transactions.map((transaction) => (
                    <li key={transaction.id}>
                      <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div 
                            className={`p-2 rounded-full ${
                              transaction.type === 'incoming' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}
                            role="img"
                            aria-label={transaction.type === 'incoming' ? 'Incoming transaction' : 'Outgoing transaction'}
                          >
                            {transaction.type === 'incoming' 
                              ? <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                              : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base truncate">{transaction.description}</p>
                            <p className="text-xs sm:text-sm text-gray-500">
                              {new Date(transaction.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className={`font-medium text-sm sm:text-base ml-3 ${
                          transaction.type === 'incoming' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {transaction.type === 'incoming' ? '+' : '-'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  );
}