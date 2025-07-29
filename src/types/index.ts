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