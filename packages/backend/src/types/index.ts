/**
 * DwayBank Smart Wallet - Type Definitions
 * Foundation Layer Types for Authentication System
 */

import { Request, Response } from 'express';

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
}

// ============================================================================
// USER TYPES
// ============================================================================

export type UserStatus = 'pending' | 'active' | 'suspended' | 'closed';

export interface User extends BaseEntity {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  status: UserStatus;
  email_verified: boolean;
  phone_verified: boolean;
  kyc_status: KYCStatus;
  last_login?: Date;
  failed_login_attempts: number;
  locked_until?: Date;
  profile_picture?: string;
  timezone?: string;
  locale?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  status: UserStatus;
  email_verified: boolean;
  phone_verified: boolean;
  kyc_status: KYCStatus;
  profile_picture?: string;
  timezone?: string;
  locale?: string;
  created_at: Date;
  last_login?: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  timezone?: string;
  locale?: string;
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  timezone?: string;
  locale?: string;
  profile_picture?: string;
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string[];
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
  scope: string[];
  session_id: string;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  session_id: string;
  token_family: string;
  iat: number;
  exp: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
  mfa_required?: boolean;
  mfa_methods?: MFAMethod[];
}

export interface RegisterInput extends CreateUserInput {
  confirm_password: string;
  accept_terms: boolean;
  accept_privacy: boolean;
}

export interface RegisterResponse {
  user: UserProfile;
  verification_required: boolean;
  message: string;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus = 'active' | 'expired' | 'revoked';

export interface UserSession extends BaseEntity {
  user_id: string;
  session_id: string;
  refresh_token_hash: string;
  token_family: string;
  ip_address: string;
  user_agent: string;
  status: SessionStatus;
  expires_at: Date;
  last_used: Date;
  last_activity: Date;
}

export interface SessionInfo {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  last_used: Date;
  is_current: boolean;
  location?: string;
  device?: string;
}

// ============================================================================
// MULTI-FACTOR AUTHENTICATION TYPES
// ============================================================================

export type MFAMethod = 'totp' | 'sms' | 'email' | 'biometric';

export interface MFAConfig extends BaseEntity {
  user_id: string;
  method: MFAMethod;
  is_primary: boolean;
  is_enabled: boolean;
  secret?: string; // For TOTP
  phone_number?: string; // For SMS
  email?: string; // For email
  backup_codes: string[];
  last_used?: Date;
}

export interface MFASetupRequest {
  method: MFAMethod;
  phone_number?: string;
  email?: string;
}

export interface MFASetupResponse {
  method: MFAMethod;
  qr_code?: string; // For TOTP
  secret?: string; // For manual TOTP entry
  backup_codes: string[];
  verification_required: boolean;
}

export interface MFAVerificationRequest {
  method: MFAMethod;
  code: string;
  backup_code?: boolean;
}

export interface MFAVerificationResponse {
  verified: boolean;
  tokens?: AuthTokens;
  remaining_attempts?: number;
}

// ============================================================================
// KYC/AML TYPES
// ============================================================================

export type KYCStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'expired';

export interface KYCRecord extends BaseEntity {
  user_id: string;
  status: KYCStatus;
  provider: 'jumio' | 'onfido' | 'mock';
  provider_reference: string;
  document_type: string;
  document_number?: string;
  verification_result?: any;
  risk_score?: number;
  rejection_reason?: string;
  expires_at?: Date;
  verified_at?: Date;
}

export interface KYCInitiateRequest {
  document_type: 'passport' | 'drivers_license' | 'national_id';
  country_code: string;
}

export interface KYCInitiateResponse {
  kyc_id: string;
  upload_url?: string;
  verification_url?: string;
  reference: string;
}

// ============================================================================
// REQUEST/RESPONSE EXTENSIONS
// ============================================================================

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  session?: UserSession;
  requestId?: string;
}

export interface AuthenticatedResponse extends Response {
  // Additional response properties if needed
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  validation_errors?: ValidationError[];
}

// ============================================================================
// AUTHENTICATION CONTEXT & REQUEST TYPES
// ============================================================================

export interface AuthenticationContext {
  ipAddress: string;
  userAgent: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'api';
  country?: string;
  city?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  context: AuthenticationContext;
}

// ============================================================================
// SECURITY TYPES
// ============================================================================

export interface SecurityEvent {
  type: 'login' | 'logout' | 'mfa_setup' | 'mfa_verify' | 'password_change' | 'suspicious_activity';
  user_id?: string;
  ip_address: string;
  user_agent: string;
  details: any;
  risk_score?: number;
  blocked?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  blocked: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Required<T> = { [P in keyof T]-?: T[P] };

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ============================================================================
// WALLET INTEGRATION TYPES
// ============================================================================

export type WalletType = 'apple_pay' | 'google_pay' | 'metamask' | 'samsung_pay' | 'paypal' | 'manual';
export type WalletStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending_auth';
export type PaymentMethodType = 'credit_card' | 'debit_card' | 'bank_account' | 'crypto_wallet' | 'digital_wallet';

export interface WalletConnection extends BaseEntity {
  user_id: string;
  wallet_type: WalletType;
  external_wallet_id: string;
  display_name: string;
  status: WalletStatus;
  last_sync: Date;
  sync_frequency: number; // minutes
  metadata: any; // wallet-specific data
  access_token?: string; // encrypted
  refresh_token?: string; // encrypted
  token_expires_at?: Date;
  error_message?: string;
  sync_count: number;
  is_primary: boolean;
}

export interface PaymentMethod extends BaseEntity {
  wallet_connection_id: string;
  external_method_id: string;
  type: PaymentMethodType;
  display_name: string;
  last_four_digits?: string;
  card_brand?: string; // visa, mastercard, amex, etc.
  expiry_month?: number;
  expiry_year?: number;
  currency: string;
  is_active: boolean;
  metadata: any;
}

export interface WalletBalance {
  payment_method_id: string;
  current_balance: number;
  available_balance: number;
  pending_balance: number;
  currency: string;
  last_updated: Date;
  exchange_rate_usd?: number; // for crypto/foreign currency
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
  transaction_type: 'debit' | 'credit' | 'transfer' | 'fee';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  metadata: any;
  created_at: Date;
}

// ============================================================================
// WALLET INTEGRATION REQUEST/RESPONSE TYPES
// ============================================================================

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
  payment_methods: PaymentMethod[];
  message: string;
  auth_url?: string; // for OAuth flows
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

export interface WalletDashboardData {
  total_balance_usd: number;
  connected_wallets: WalletConnection[];
  payment_methods: (PaymentMethod & { balance?: WalletBalance })[];
  recent_transactions: WalletTransaction[];
  sync_status: {
    last_full_sync: Date;
    pending_syncs: number;
    failed_syncs: number;
  };
}

// ============================================================================
// APPLE PAY INTEGRATION TYPES
// ============================================================================

export interface ApplePayCard {
  deviceAccountIdentifier: string;
  deviceAccountNumberSuffix: string;
  localizedDescription: string;
  paymentNetwork: string;
  passActivationState: 'activated' | 'suspended' | 'deactivated';
  passTypeIdentifier: string;
}

export interface ApplePayTokenRequest {
  merchantIdentifier: string;
  domainName: string;
  displayName: string;
  certificateChain: string[];
}

// ============================================================================
// GOOGLE PAY INTEGRATION TYPES
// ============================================================================

export interface GooglePayCard {
  resourceId: string;
  cardDisplayName: string;
  lastFourDigits: string;
  cardNetwork: string;
  tokenizationData: {
    type: string;
    token: string;
  };
  issuerDisplayName: string;
  cardClass: 'CREDIT' | 'DEBIT' | 'PREPAID';
}

export interface GooglePayAPIResponse<T> {
  result: T[];
  nextPageToken?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ============================================================================
// METAMASK INTEGRATION TYPES
// ============================================================================

export interface MetaMaskAccount {
  address: string;
  chainId: number;
  networkName: string;
  balance: string; // in wei for ETH
  balanceFormatted: string; // in ETH
}

export interface MetaMaskTokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
}

export interface WalletConnectSession {
  sessionId: string;
  accounts: string[];
  chainId: number;
  peerMeta: {
    description: string;
    url: string;
    icons: string[];
    name: string;
  };
}