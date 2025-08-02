import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter,
  ChevronRight,
  Calendar,
  DollarSign
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
  category?: string;
  merchant?: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionListProps {
  transactions: Transaction[];
  showSearch?: boolean;
  showFilters?: boolean;
  onTransactionSelect?: (transaction: Transaction) => void;
  maxHeight?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

export function TransactionList({
  transactions,
  showSearch = false,
  showFilters = false,
  onTransactionSelect,
  maxHeight = 'max-h-96',
  variant = 'default'
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
    return `${amount} ${currency}`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      short: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      full: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string, status: string) => {
    const iconClass = cn(
      'h-4 w-4',
      status === 'failed' ? 'text-red-500' : 
      type === 'incoming' ? 'text-green-600' : 'text-red-600'
    );

    return type === 'incoming' 
      ? <ArrowDownLeft className={iconClass} aria-hidden="true" />
      : <ArrowUpRight className={iconClass} aria-hidden="true" />;
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || transaction.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">Transactions</CardTitle>
          
          {(showSearch || showFilters) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 min-w-[200px]"
                    aria-label="Search transactions"
                  />
                </div>
              )}
              
              {showFilters && (
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm bg-white min-h-[44px]"
                  aria-label="Filter by transaction type"
                >
                  <option value="all">All Types</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions found</p>
            {searchTerm && (
              <Button 
                variant="ghost" 
                onClick={() => setSearchTerm('')}
                className="mt-2"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className={cn('overflow-y-auto', maxHeight)}>
            <nav aria-label="Transaction list">
              <ul className="space-y-2" role="list">
                {filteredTransactions.map((transaction) => {
                  const dateInfo = formatDate(transaction.timestamp);
                  
                  return (
                    <li key={transaction.id}>
                      <div
                        className={cn(
                          'flex items-center justify-between p-3 sm:p-4 border rounded-lg transition-colors',
                          'hover:bg-gray-50 focus-within:bg-gray-50',
                          onTransactionSelect && 'cursor-pointer'
                        )}
                        onClick={() => onTransactionSelect?.(transaction)}
                        role={onTransactionSelect ? 'button' : undefined}
                        tabIndex={onTransactionSelect ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (onTransactionSelect && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onTransactionSelect(transaction);
                          }
                        }}
                        aria-label={`${transaction.type} transaction: ${transaction.description}, ${formatCurrency(transaction.amount, transaction.currency)}, ${dateInfo.full}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {/* Transaction Type Icon */}
                          <div 
                            className={cn(
                              'flex items-center justify-center p-2 rounded-full',
                              transaction.status === 'failed' ? 'bg-red-100' :
                              transaction.type === 'incoming' ? 'bg-green-100' : 'bg-red-100'
                            )}
                            role="img"
                            aria-label={`${transaction.type} transaction${transaction.status === 'failed' ? ' (failed)' : ''}`}
                          >
                            {getTypeIcon(transaction.type, transaction.status)}
                          </div>

                          {/* Transaction Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm sm:text-base truncate">
                                {transaction.description}
                              </p>
                              {variant === 'detailed' && getStatusBadge(transaction.status)}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              <time dateTime={transaction.timestamp}>
                                {dateInfo.short}
                              </time>
                              
                              {variant === 'detailed' && transaction.category && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.category}</span>
                                </>
                              )}
                              
                              {variant === 'detailed' && transaction.merchant && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.merchant}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount and Action */}
                        <div className="flex items-center space-x-2 ml-3">
                          <div className={cn(
                            'text-right',
                            'font-medium text-sm sm:text-base',
                            transaction.status === 'failed' ? 'text-red-600' :
                            transaction.type === 'incoming' ? 'text-green-600' : 'text-red-600'
                          )}>
                            <div className="flex items-center space-x-1">
                              <DollarSign className="h-3 w-3" aria-hidden="true" />
                              <span>
                                {transaction.type === 'incoming' ? '+' : '-'}
                                {formatCurrency(transaction.amount, transaction.currency)}
                              </span>
                            </div>
                          </div>
                          
                          {onTransactionSelect && (
                            <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        )}
      </CardContent>
    </Card>
  );
}