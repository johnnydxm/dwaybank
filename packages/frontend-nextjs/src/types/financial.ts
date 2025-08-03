export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'investment' | 'credit';
  balance: number;
  available_balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  created_at: string;
  updated_at: string;
  institution_name?: string;
  account_name: string;
  is_primary: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  category: TransactionCategory;
  description: string;
  merchant_name?: string;
  date: string;
  pending: boolean;
  balance_after: number;
  reference_id?: string;
  tags?: string[];
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  metadata?: Record<string, any>;
}

export interface TransactionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_category_id?: string;
  budget_limit?: number;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  spent: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  alerts_enabled: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  category: string;
  description?: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: 'bank_account' | 'credit_card' | 'debit_card' | 'digital_wallet';
  name: string;
  last_four: string;
  expiry_date?: string;
  brand?: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'transaction' | 'security' | 'budget' | 'goal' | 'system';
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  user_id: string;
  type: 'suspicious_login' | 'unusual_transaction' | 'location_change' | 'device_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  resolved: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface FinancialInsight {
  id: string;
  user_id: string;
  type: 'spending_pattern' | 'saving_opportunity' | 'budget_alert' | 'investment_tip';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  category?: string;
  action_items?: string[];
  created_at: string;
}

export interface MonthlySpending {
  month: string;
  total: number;
  categories: {
    [categoryId: string]: {
      name: string;
      amount: number;
      percentage: number;
      transactions_count: number;
    };
  };
}

export interface AccountBalance {
  current: number;
  available: number;
  pending: number;
  currency: string;
}

export interface TransferRequest {
  from_account_id: string;
  to_account_id?: string;
  to_external_account?: {
    routing_number: string;
    account_number: string;
    account_name: string;
    bank_name: string;
  };
  amount: number;
  currency: string;
  description?: string;
  scheduled_date?: string;
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    end_date?: string;
    occurrences?: number;
  };
}

export interface BiometricAuthRequest {
  type: 'fingerprint' | 'face_id' | 'voice';
  challenge: string;
  expires_at: string;
}

export interface DeviceInfo {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'mobile' | 'desktop' | 'tablet';
  platform: string;
  browser?: string;
  is_trusted: boolean;
  last_used: string;
  created_at: string;
}