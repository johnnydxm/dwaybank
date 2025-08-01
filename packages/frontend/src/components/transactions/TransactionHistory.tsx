import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  MapPin,
  Tag,
  Receipt
} from 'lucide-react';
import { Transaction, TransactionCategory, Account } from '../../types/financial';
import { formatCurrency, formatAmountWithSign } from '../../utils/currency';
import { formatTimeAgo } from '../../lib/utils';

interface TransactionHistoryProps {
  transactions: Transaction[];
  categories: TransactionCategory[];
  accounts: Account[];
  isLoading?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
  onExportTransactions?: (filters: TransactionFilters) => void;
}

interface TransactionFilters {
  search: string;
  category: string;
  account: string;
  type: 'all' | 'credit' | 'debit';
  dateRange: 'all' | '7d' | '30d' | '90d' | 'custom';
  status: 'all' | 'pending' | 'completed';
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

const DEFAULT_FILTERS: TransactionFilters = {
  search: '',
  category: 'all',
  account: 'all',
  type: 'all',
  dateRange: '30d',
  status: 'all'
};

export function TransactionHistory({
  transactions,
  categories,
  accounts,
  isLoading = false,
  onTransactionClick,
  onExportTransactions
}: TransactionHistoryProps) {
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'merchant'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm) ||
        t.merchant_name?.toLowerCase().includes(searchTerm) ||
        t.reference_id?.toLowerCase().includes(searchTerm)
      );
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category.id === filters.category);
    }

    // Account filter
    if (filters.account !== 'all') {
      filtered = filtered.filter(t => t.account_id === filters.account);
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'pending') {
        filtered = filtered.filter(t => t.pending);
      } else {
        filtered = filtered.filter(t => !t.pending);
      }
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (filters.startDate) {
            startDate = new Date(filters.startDate);
          } else {
            startDate = new Date(0);
          }
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        const afterStart = transactionDate >= startDate;
        const beforeEnd = filters.dateRange !== 'custom' || !filters.endDate || 
          transactionDate <= new Date(filters.endDate);
        return afterStart && beforeEnd;
      });
    }

    // Amount range filter
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter(t => Math.abs(t.amount) >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter(t => Math.abs(t.amount) <= filters.maxAmount!);
    }

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'merchant':
          comparison = (a.merchant_name || a.description).localeCompare(b.merchant_name || b.description);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [transactions, filters, sortBy, sortOrder]);

  const handleFilterChange = (key: keyof TransactionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === 'credit') {
      return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
    } else {
      return <ArrowUpRight className="h-4 w-4 text-red-600" />;
    }
  };

  const getCategoryIcon = (category: TransactionCategory) => {
    return <span className="text-lg" role="img" aria-label="Category">{category.icon}</span>;
  };

  const getAccount = (accountId: string) => {
    return accounts.find(a => a.id === accountId);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'search') return value.trim() !== '';
    if (key === 'dateRange') return value !== '30d';
    return value !== 'all' && value !== undefined;
  });

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {filteredTransactions.length} of {transactions.length} transactions
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExportTransactions?.(filters)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={filters.category} 
                  onValueChange={(value) => handleFilterChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account</Label>
                <Select 
                  value={filters.account} 
                  onValueChange={(value) => handleFilterChange('account', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={filters.type} 
                  onValueChange={(value) => handleFilterChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="credit">Income</SelectItem>
                    <SelectItem value="debit">Spending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select 
                  value={filters.dateRange} 
                  onValueChange={(value) => handleFilterChange('dateRange', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sort Options */}
          <div className="flex items-center space-x-4">
            <Label className="text-sm">Sort by:</Label>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="merchant">Merchant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading transactions...</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No transactions found
              </h3>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Your transactions will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTransactions.map((transaction, index) => {
                const account = getAccount(transaction.account_id);
                const amountInfo = formatAmountWithSign(transaction.amount, transaction.currency, transaction.type);
                
                return (
                  <div
                    key={transaction.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      transaction.pending ? 'opacity-75' : ''
                    }`}
                    onClick={() => onTransactionClick?.(transaction)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Transaction Icon */}
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-full ${
                            transaction.type === 'credit' 
                              ? 'bg-green-100' 
                              : 'bg-red-100'
                          }`}>
                            {getTransactionIcon(transaction)}
                          </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {transaction.merchant_name || transaction.description}
                            </p>
                            {transaction.pending && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatTimeAgo(transaction.date)}
                            </div>
                            
                            <div className="flex items-center">
                              {getCategoryIcon(transaction.category)}
                              <span className="ml-1">{transaction.category.name}</span>
                            </div>
                            
                            {account && (
                              <div className="flex items-center">
                                <span>{account.account_name}</span>
                              </div>
                            )}
                            
                            {transaction.location && (
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span>{transaction.location.address}</span>
                              </div>
                            )}
                          </div>

                          {/* Tags */}
                          {transaction.tags && transaction.tags.length > 0 && (
                            <div className="flex items-center space-x-1 mt-2">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              {transaction.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <div className={`font-semibold ${amountInfo.colorClass}`}>
                          {amountInfo.sign}{amountInfo.formatted}
                        </div>
                        {transaction.balance_after !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Balance: {formatCurrency(transaction.balance_after, transaction.currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}