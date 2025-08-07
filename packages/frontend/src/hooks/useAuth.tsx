import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, handleApiError, ApiError } from '../services/api';
import { User, LoginRequest, RegisterRequest } from '../types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<any>;
  register: (userData: RegisterRequest) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyMFA: (code: string, userId: string, sessionId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!localStorage.getItem('access_token');

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await authAPI.getProfile();
          setUser(response.data);
        } catch (error) {
          // Token might be invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<any> => {
    setIsLoading(true);
    try {
      const response = await authAPI.login(credentials);
      
      // Check if MFA is required
      if (response.data.mfa_required) {
        setIsLoading(false);
        return {
          success: false,
          mfa_required: true,
          user: response.data.user,
          session_id: response.data.session_id,
          message: 'MFA verification required'
        };
      }
      
      const { user: userData, tokens } = response.data;

      // Store tokens (handle both camelCase and snake_case)
      localStorage.setItem('access_token', tokens.accessToken || tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refreshToken || tokens.refresh_token);

      // Set user state
      setUser(userData);

      setIsLoading(false);
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      const apiError = handleApiError(error);
      throw error; // Let the component handle the error
    }
  };

  const register = async (userData: RegisterRequest): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await authAPI.register(userData);
      const { user: newUser, tokens } = response.data;

      // Store tokens
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);

      // Set user state
      setUser(newUser);

      setIsLoading(false);
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      const apiError = handleApiError(error);
      return { 
        success: false, 
        error: apiError.message || 'Registration failed. Please try again.' 
      };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Call logout API to invalidate tokens on server
      await authAPI.logout();
    } catch (error) {
      // Even if API call fails, we should clear local state
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!localStorage.getItem('access_token')) {
      return;
    }

    try {
      const response = await authAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      // Don't clear tokens here, let the axios interceptor handle token refresh
    }
  };

  const verifyMFA = async (code: string, userId: string, sessionId: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authAPI.verifyMFA(code, userId, sessionId);
      const { user: userData, tokens } = response.data;

      // Store tokens (handle both camelCase and snake_case)
      localStorage.setItem('access_token', tokens.accessToken || tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refreshToken || tokens.refresh_token);

      // Set user state
      setUser(userData);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
    verifyMFA,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};