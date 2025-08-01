import { useState, useEffect } from 'react';
import { TransactionHistory } from '../components/transactions/TransactionHistory';
import { PaymentForm } from '../components/transactions/PaymentForm';
import { TransactionCategoryChart } from '../components/financial/TransactionCategoryChart';
import { MobileNavigation } from '../components/mobile/MobileNavigation';
import { useAccessibility, useScreenReader } from '../components/accessibility/AccessibilityProvider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Plus, 
  ArrowUpDown, 
  Download, 
  Filter,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { Transaction, TransactionCategory, Account, PaymentMethod, TransferRequest } from '../types/financial';
import { transactionAPI, accountAPI, paymentAPI } from '../services/api';
import { formatCurrency } from '../utils/currency';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { isMobile } = useAccessibility();
  const { announceNavigation, announceAction } = useScreenReader();

  useEffect(() => {
    announceNavigation('Transactions page');
    loadTransactionsData();
  }, []);

  const loadTransactionsData = async () => {
    setIsLoading(true);
    try {
      // Mock transaction data for demonstration
      const mockTransactions: Transaction[] = [
        {
          id: '1',
          account_id: '1',
          amount: -45.67,
          currency: 'USD',
          type: 'debit',
          category: {
            id: 'food',
            name: 'Food & Dining',
            icon: '🍽️',
            color: '#FF6B6B'
          },
          description: 'Starbucks Coffee',
          merchant_name: 'Starbucks',
          date: new Date().toISOString(),
          pending: false,
          balance_after: 2454.33,
          reference_id: 'TXN_001',
          tags: ['coffee', 'morning'],
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            address: '123 Main St, New York, NY'
          }
        },
        {
          id: '2',
          account_id: '1',
          amount: 2500.00,
          currency: 'USD',
          type: 'credit',
          category: {
            id: 'income',
            name: 'Salary',
            icon: '💼',
            color: '#4ECDC4'
          },
          description: 'Monthly Salary',
          date: new Date(Date.now() - 86400000).toISOString(),
          pending: false,
          balance_after: 4954.33,
          reference_id: 'TXN_002'
        },
        {
          id: '3',
          account_id: '2',
          amount: -120.00,
          currency: 'USD',
          type: 'debit',
          category: {
            id: 'shopping',
            name: 'Shopping',
            icon: '🛍️',
            color: '#FFE66D'
          },
          description: 'Amazon Purchase',
          merchant_name: 'Amazon',
          date: new Date(Date.now() - 172800000).toISOString(),
          pending: true,
          balance_after: 14880.00,
          reference_id: 'TXN_003',
          tags: ['online', 'electronics']
        }
      ];

      const mockCategories: TransactionCategory[] = [
        { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
        { id: 'income', name: 'Salary', icon: '💼', color: '#4ECDC4' },
        { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FFE66D', budget_limit: 500 },
        { id: 'transport', name: 'Transportation', icon: '🚗', color: '#95E1D3' },
        { id: 'utilities', name: 'Utilities', icon: '💡', color: '#F38BA8' }
      ];

      const mockAccounts: Account[] = [
        {
          id: '1',
          user_id: 'user1',
          account_number: '1234567890',
          account_type: 'checking',
          balance: 2454.33,
          available_balance: 2354.33,
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
          balance: 14880.00,
          available_balance: 14880.00,
          currency: 'USD',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-31T00:00:00Z',
          institution_name: 'Wells Fargo',
          account_name: 'High Yield Savings',
          is_primary: false
        }
      ];

      const mockPaymentMethods: PaymentMethod[] = [
        {
          id: '1',
          user_id: 'user1',
          type: 'bank_account',
          name: 'Primary Checking',
          last_four: '7890',
          is_default: true,
          is_verified: true,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      setTransactions(mockTransactions);
      setCategories(mockCategories);
      setAccounts(mockAccounts);
      setPaymentMethods(mockPaymentMethods);

    } catch (err: any) {
      console.error('Failed to load transactions data:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    console.log('Transaction details:', transaction);
  };

  const handleExportTransactions = (filters: any) => {
    announceAction('Exporting transactions');
    console.log('Export with filters:', filters);
  };

  const handleSendMoney = () => {
    setShowPaymentForm(true);
    announceAction('Opening send money form');
  };

  const handleTransferSubmit = async (transferData: TransferRequest) => {
    try {
      announceAction('Processing transfer');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowPaymentForm(false);
      announceAction('Transfer completed successfully');
      
      await loadTransactionsData();
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const getTransactionStats = () => {
    const currentMonth = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const now = new Date();
      return transactionDate.getMonth() === now.getMonth() && 
             transactionDate.getFullYear() === now.getFullYear();
    });

    const income = currentMonth
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = currentMonth
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { income, expenses, netIncome: income - expenses };
  };

  const stats = getTransactionStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
        {isMobile && <MobileNavigation />}
      </div>
    );
  }

  if (showPaymentForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <PaymentForm
            accounts={accounts}
            paymentMethods={paymentMethods}
            onSubmit={handleTransferSubmit}
            onCancel={() => setShowPaymentForm(false)}
          />
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
              <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
              <p className="text-sm text-muted-foreground">
                Track your spending and manage transfers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm" onClick={handleSendMoney}>
                <Plus className="h-4 w-4 mr-2" />
                Send Money
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

        {/* Monthly Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.income)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.expenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                stats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(stats.netIncome)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions for Mobile */}
        {isMobile && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button 
              className="h-16 flex flex-col items-center justify-center space-y-1"
              onClick={handleSendMoney}
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="text-sm">Send Money</span>
            </Button>
            <Button 
              variant="outline"
              className="h-16 flex flex-col items-center justify-center space-y-1"
              onClick={() => handleExportTransactions({})}
            >
              <Download className="h-5 w-5" />
              <span className="text-sm">Export</span>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transaction History */}
          <div className="lg:col-span-2">
            <TransactionHistory
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              onTransactionClick={handleTransactionClick}
              onExportTransactions={handleExportTransactions}
            />
          </div>

          {/* Category Breakdown */}
          <div>
            <TransactionCategoryChart
              transactions={transactions}
              categories={categories}
              title="Monthly Spending"
              showComparison={false}
            />
          </div>
        </div>
      </main>

      {isMobile && <MobileNavigation />}
    </div>
  );
}