import axios, { AxiosResponse, AxiosError } from 'axios';
import { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest, 
  MFASetupResponse,
  MFAVerificationRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  User,
  SessionInfo
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token: newRefreshToken } = response.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Authentication
  login: (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login', data),
    
  register: (data: RegisterRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register', data),
    
  logout: (): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/logout'),
    
  refreshToken: (refreshToken: string): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
    
  // Email Verification
  sendVerificationEmail: (): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/send-verification'),
    
  verifyEmail: (token: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/verify-email', { token }),
    
  // MFA
  setupMFA: (): Promise<AxiosResponse<MFASetupResponse>> =>
    api.post('/auth/mfa/setup'),
    
  verifyMFA: (data: MFAVerificationRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/mfa/verify', data),
    
  disableMFA: (data: { password: string }): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/mfa/disable', data),
    
  generateBackupCodes: (): Promise<AxiosResponse<{ backup_codes: string[] }>> =>
    api.post('/auth/mfa/backup-codes'),
    
  // Password Management
  changePassword: (data: PasswordChangeRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/change-password', data),
    
  resetPassword: (data: PasswordResetRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/reset-password', data),
    
  confirmPasswordReset: (data: PasswordResetConfirmRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/reset-password/confirm', data),
    
  // Profile Management
  getProfile: (): Promise<AxiosResponse<User>> =>
    api.get('/auth/profile'),
    
  updateProfile: (data: Partial<User>): Promise<AxiosResponse<User>> =>
    api.put('/auth/profile', data),
    
  // Session Management
  getSessions: (): Promise<AxiosResponse<SessionInfo[]>> =>
    api.get('/auth/sessions'),
    
  terminateSession: (sessionId: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/auth/sessions/${sessionId}`),
    
  terminateAllSessions: (): Promise<AxiosResponse<{ message: string }>> =>
    api.delete('/auth/sessions/all'),
};

// Wallet API placeholder
export const walletAPI = {
  // Add wallet-specific endpoints here
  getWallets: (): Promise<AxiosResponse<any[]>> =>
    api.get('/wallets'),
    
  connectWallet: (walletType: string, credentials: any): Promise<AxiosResponse<any>> =>
    api.post('/wallets/connect', { wallet_type: walletType, ...credentials }),
    
  getTransactions: (walletId?: string): Promise<AxiosResponse<any[]>> =>
    api.get('/transactions', { params: { wallet_id: walletId } }),
};

export default api;