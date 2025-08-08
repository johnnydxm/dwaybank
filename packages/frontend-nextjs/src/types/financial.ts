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

// Wallet Integration Types
export interface WalletConnection {
  id: string;
  user_id: string;
  wallet_type: WalletType;
  external_wallet_id: string;
  display_name: string;
  status: WalletStatus;
  last_sync: string | null;
  sync_count: number;
  error_message: string | null;
  is_primary: boolean;
  auto_sync_enabled: boolean;
  sync_frequency: number;
  created_at: string;
  updated_at: string;
}

export type WalletType = 'apple_pay' | 'google_pay' | 'metamask' | 'samsung_pay' | 'paypal' | 'manual';
export type WalletStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending' | 'pending_auth';

export interface WalletBalance {
  id: string;
  payment_method_id: string;
  current_balance: number;
  available_balance: number;
  pending_balance: number;
  currency: string;
  last_updated: string;
  sync_status: 'success' | 'error' | 'pending';
  error_message: string | null;
}

export interface WalletPaymentMethod {
  id: string;
  wallet_connection_id: string;
  external_payment_method_id: string;
  type: 'card' | 'account' | 'crypto' | 'other';
  display_name: string;
  last_four: string | null;
  currency: string;
  brand: string | null;
  is_primary: boolean;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_connection_id: string;
  payment_method_id: string | null;
  external_transaction_id: string;
  amount: number;
  currency: string;
  transaction_type: 'credit' | 'debit' | 'transfer' | 'fee';
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  description: string;
  merchant_name: string | null;
  category: string | null;
  transaction_date: string;
  processed_date: string | null;
  fee_amount: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WalletDashboardData {
  total_balance_usd: number;
  connected_wallets: WalletConnection[];
  payment_methods: (WalletPaymentMethod & { balance?: WalletBalance })[];
  recent_transactions: WalletTransaction[];
  sync_status: {
    last_full_sync: string | null;
    pending_syncs: number;
    failed_syncs: number;
  };
}

export interface ConnectWalletRequest {
  wallet_type: WalletType;
  auth_code?: string;
  access_token?: string;
  display_name?: string;
  metadata?: Record<string, any>;
}

export interface ConnectWalletResponse {
  connection_id: string;
  status: WalletStatus;
  payment_methods: WalletPaymentMethod[];
  message: string;
  auth_url?: string;
  requires_additional_auth?: boolean;
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
  errors?: string[];
}

export interface WalletSyncStatus {
  id: string;
  wallet_type: WalletType;
  display_name: string;
  status: WalletStatus;
  last_sync: string | null;
  sync_count: number;
  error_message: string | null;
  last_sync_status: 'success' | 'error' | 'pending' | null;
  last_sync_duration: number | null;
  last_sync_completed: string | null;
}