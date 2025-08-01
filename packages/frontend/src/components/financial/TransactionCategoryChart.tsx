import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Transaction, TransactionCategory } from '../../types/financial';
import { formatCurrency, formatPercentage } from '../../utils/currency';

interface CategoryData {
  category: TransactionCategory;
  amount: number;
  percentage: number;
  transactionCount: number;
  change: number; // percentage change from previous period
}

interface TransactionCategoryChartProps {
  transactions: Transaction[];
  categories: TransactionCategory[];
  currency?: string;
  title?: string;
  showComparison?: boolean;
  previousPeriodTransactions?: Transaction[];
}

export function TransactionCategoryChart({
  transactions,
  categories,
  currency = 'USD',
  title = 'Spending by Category',
  showComparison = false,
  previousPeriodTransactions = []
}: TransactionCategoryChartProps) {
  const categoryData = useMemo(() => {
    // Calculate current period spending
    const categoryMap = new Map<string, {
      amount: number;
      count: number;
      category: TransactionCategory;
    }>();

    const debitTransactions = transactions.filter(t => t.type === 'debit');
    const totalSpending = debitTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Group transactions by category
    debitTransactions.forEach(transaction => {
      const category = categories.find(c => c.id === transaction.category.id);
      if (!category) return;

      const existing = categoryMap.get(category.id) || {
        amount: 0,
        count: 0,
        category
      };

      categoryMap.set(category.id, {
        amount: existing.amount + Math.abs(transaction.amount),
        count: existing.count + 1,
        category
      });
    });

    // Calculate previous period for comparison
    const previousCategoryMap = new Map<string, number>();
    if (showComparison && previousPeriodTransactions.length > 0) {
      previousPeriodTransactions
        .filter(t => t.type === 'debit')
        .forEach(transaction => {
          const categoryId = transaction.category.id;
          const existing = previousCategoryMap.get(categoryId) || 0;
          previousCategoryMap.set(categoryId, existing + Math.abs(transaction.amount));
        });
    }

    // Convert to array and calculate percentages
    const data: CategoryData[] = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const percentage = totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0;
      const previousAmount = previousCategoryMap.get(categoryId) || 0;
      const change = previousAmount > 0 ? ((data.amount - previousAmount) / previousAmount) * 100 : 0;

      return {
        category: data.category,
        amount: data.amount,
        percentage,
        transactionCount: data.count,
        change
      };
    });

    // Sort by amount (highest first)
    return data.sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, showComparison, previousPeriodTransactions]);

  const getChangeIndicator = (change: number) => {
    if (!showComparison || change === 0) return null;
    
    const isIncrease = change > 0;
    const colorClass = isIncrease ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';
    const sign = isIncrease ? '+' : '';
    
    return (
      <Badge variant="secondary" className={colorClass}>
        {sign}{formatPercentage(change)}
      </Badge>
    );
  };

  const getCategoryIcon = (icon: string) => {
    // For now, return emoji. In a real app, you might use a proper icon library
    return <span className="text-lg" role="img" aria-label="Category icon">{icon}</span>;
  };

  const maxAmount = categoryData.length > 0 ? categoryData[0].amount : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline">
            {categoryData.length} categories
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categoryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No spending data available
            </div>
          ) : (
            categoryData.map((data) => (
              <div key={data.category.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {getCategoryIcon(data.category.icon)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-sm">{data.category.name}</p>
                        {getChangeIndicator(data.change)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {data.transactionCount} transaction{data.transactionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(data.amount, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPercentage(data.percentage)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Progress 
                    value={data.percentage} 
                    className="h-2"
                    style={{
                      backgroundColor: `${data.category.color}20`, // 20% opacity background
                    }}
                  />
                  
                  {/* Budget comparison if available */}
                  {data.category.budget_limit && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Budget: {formatCurrency(data.category.budget_limit, currency)}
                      </span>
                      <span className={`font-medium ${
                        data.amount > data.category.budget_limit ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {data.amount > data.category.budget_limit ? 'Over' : 'Under'} by{' '}
                        {formatCurrency(Math.abs(data.amount - data.category.budget_limit), currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {categoryData.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Spending</span>
              <span className="font-semibold">
                {formatCurrency(
                  categoryData.reduce((sum, data) => sum + data.amount, 0), 
                  currency
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}