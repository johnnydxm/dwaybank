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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">DwayBank</h1>
              <Badge variant="secondary">Dashboard</Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src={user?.profile_picture} />
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
              <Button variant="outline" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBalances(!showBalances)}
              >
                {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
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
              <div className="text-2xl font-bold">{wallets.length}</div>
              <p className="text-xs text-muted-foreground">
                {wallets.filter(w => w.status === 'connected').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">
                This week
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Wallets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Wallets</CardTitle>
                  <CardDescription>
                    Manage your connected payment methods
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getWalletIcon(wallet.type)}
                      </div>
                      <div>
                        <p className="font-medium">{wallet.name}</p>
                        <p className="text-sm text-gray-500">
                          {showBalances 
                            ? formatCurrency(wallet.balance, wallet.currency)
                            : '••••'
                          }
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(wallet.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest wallet activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        transaction.type === 'incoming' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.type === 'incoming' 
                          ? <ArrowDownLeft className="h-4 w-4" />
                          : <ArrowUpRight className="h-4 w-4" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`font-medium ${
                      transaction.type === 'incoming' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.type === 'incoming' ? '+' : '-'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </div>
                  </div>
                ))}
              </div>
              
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No transactions yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}