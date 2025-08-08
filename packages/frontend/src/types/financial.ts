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

export interface TransactionFilter {
  category?: string;
  type?: 'income' | 'expense' | 'transfer';
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  merchant?: string;
}

// ============================================================================
// WALLET INTEGRATION TYPES
// ============================================================================

export type WalletType = 'apple_pay' | 'google_pay' | 'metamask' | 'samsung_pay' | 'paypal' | 'manual';
export type WalletStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending_auth';

export interface WalletConnection {
  id: string;
  wallet_type: WalletType;
  display_name: string;
  status: WalletStatus;
  last_sync?: Date;
  sync_count: number;
  is_primary: boolean;
  auto_sync_enabled: boolean;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WalletPaymentMethod {
  id: string;
  wallet_connection_id: string;
  external_method_id: string;
  type: 'credit_card' | 'debit_card' | 'bank_account' | 'crypto_wallet' | 'digital_wallet';
  display_name: string;
  last_four_digits?: string;
  card_brand?: string;
  currency: string;
  is_active: boolean;
  current_balance?: number;
  available_balance?: number;
  pending_balance?: number;
  balance_usd?: number;
  balance_last_updated?: Date;
  balance_source?: 'api' | 'cache' | 'manual';
}

export interface WalletBalance {
  payment_method_id: string;
  current_balance: number;
  available_balance: number;
  pending_balance: number;
  currency: string;
  last_updated: Date;
  exchange_rate_usd?: number;
  balance_usd?: number;
  balance_source: 'api' | 'cache' | 'manual';
}

export interface WalletTransaction {
  id: string;
  wallet_connection_id: string;
  payment_method_id?: string;
  external_transaction_id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name?: string;
  merchant_category?: string;
  transaction_date: Date;
  posted_date?: Date;
  transaction_type: 'debit' | 'credit' | 'transfer' | 'fee';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  exchange_rate_usd?: number;
  amount_usd?: number;
  metadata?: any;
  created_at: Date;
}

export interface WalletDashboardData {
  total_balance_usd: number;
  connected_wallets: WalletConnection[];
  payment_methods: WalletPaymentMethod[];
  recent_transactions: WalletTransaction[];
  sync_status: {
    last_full_sync?: Date;
    pending_syncs: number;
    failed_syncs: number;
  };
}

export interface ConnectWalletRequest {
  wallet_type: WalletType;
  auth_code?: string;
  access_token?: string;
  display_name?: string;
  metadata?: any;
}

export interface ConnectWalletResponse {
  connection_id: string;
  status: WalletStatus;
  payment_methods: WalletPaymentMethod[];
  message: string;
  auth_url?: string;
}

export interface SyncWalletRequest {
  connection_id: string;
  force_refresh?: boolean;
}

export interface SyncWalletResponse {
  connection_id: string;
  status: WalletStatus;
  payment_methods_synced: number;
  transactions_synced: number;
  balances_updated: number;
  last_sync: Date;
  errors: string[];
}