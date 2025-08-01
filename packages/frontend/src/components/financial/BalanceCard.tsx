import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Eye, 
  EyeOff, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Refresh
} from 'lucide-react';
import { Account, AccountBalance } from '../../types/financial';
import { formatCurrency } from '../../utils/currency';

interface BalanceCardProps {
  account: Account;
  balance: AccountBalance;
  onRefresh: () => Promise<void>;
  showAnimations?: boolean;
}

export function BalanceCard({ 
  account, 
  balance, 
  onRefresh, 
  showAnimations = true 
}: BalanceCardProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previousBalance, setPreviousBalance] = useState(balance.current);
  const [balanceChange, setBalanceChange] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (balance.current !== previousBalance) {
      setBalanceChange(balance.current > previousBalance ? 'up' : 'down');
      setPreviousBalance(balance.current);
      
      // Clear animation after 2 seconds
      if (showAnimations) {
        const timer = setTimeout(() => setBalanceChange(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [balance.current, previousBalance, showAnimations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'checking':
        return 'bg-blue-100 text-blue-800';
      case 'savings':
        return 'bg-green-100 text-green-800';
      case 'investment':
        return 'bg-purple-100 text-purple-800';
      case 'credit':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'suspended':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'closed':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  return (
    <Card className={`relative transition-all duration-300 ${
      balanceChange === 'up' ? 'ring-2 ring-green-200 bg-green-50' :
      balanceChange === 'down' ? 'ring-2 ring-red-200 bg-red-50' : ''
    }`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium flex items-center">
            {getStatusIndicator(account.status)}
            <span className="ml-2">{account.account_name}</span>
          </CardTitle>
          <Badge className={getAccountTypeColor(account.account_type)}>
            {account.account_type}
          </Badge>
          {account.is_primary && (
            <Badge variant="outline">Primary</Badge>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBalance(!showBalance)}
            aria-label={showBalance ? 'Hide balance' : 'Show balance'}
          >
            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh balance"
          >
            <Refresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Current Balance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Current Balance</span>
            </div>
            <div className={`text-xl font-bold transition-all duration-500 ${
              balanceChange === 'up' ? 'text-green-600 animate-pulse' :
              balanceChange === 'down' ? 'text-red-600 animate-pulse' : ''
            }`}>
              {showBalance ? formatCurrency(balance.current, balance.currency) : '••••••'}
              {balanceChange && showAnimations && (
                <span className="ml-2 text-sm">
                  {balanceChange === 'up' ? (
                    <TrendingUp className="inline h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="inline h-4 w-4 text-red-500" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Available Balance */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available</span>
            <span className="font-medium">
              {showBalance ? formatCurrency(balance.available, balance.currency) : '••••••'}
            </span>
          </div>

          {/* Pending Transactions */}
          {balance.pending > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-medium text-orange-600">
                -{showBalance ? formatCurrency(balance.pending, balance.currency) : '••••••'}
              </span>
            </div>
          )}

          {/* Account Number */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Account</span>
              <span className="font-mono">
                •••• {account.account_number.slice(-4)}
              </span>
            </div>
            {account.institution_name && (
              <div className="text-xs text-muted-foreground mt-1">
                {account.institution_name}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}