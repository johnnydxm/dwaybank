import { useState, useEffect, useContext, createContext, type ReactNode } from 'react';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types/auth';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  verifyMFA: (code: string, userId: string, sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      
      if (token) {
        try {
          const response = await authAPI.getProfile();
          setUser(response.data);
        } catch (error) {
          // Invalid token, remove it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const response = await authAPI.login(credentials);
      const authData = response.data;

      // If MFA is required, return the response for the component to handle
      if (authData.mfa_required) {
        return authData;
      }

      // If tokens are provided, save them and set user
      if (authData.tokens) {
        localStorage.setItem('access_token', authData.tokens.access_token);
        localStorage.setItem('refresh_token', authData.tokens.refresh_token);
        setUser(authData.user);
      }

      return authData;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const response = await authAPI.register(data);
      const authData = response.data;

      // If email verification is required, return the response for the component to handle
      if (authData.verification_required) {
        return authData;
      }

      // If tokens are provided, save them and set user
      if (authData.tokens) {
        localStorage.setItem('access_token', authData.tokens.access_token);
        localStorage.setItem('refresh_token', authData.tokens.refresh_token);
        setUser(authData.user);
      }

      return authData;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authAPI.logout();
    } catch (error) {
      // Logout anyway even if API call fails
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setIsLoading(false);
    }
  };

  const verifyMFA = async (code: string, userId: string, sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await authAPI.verifyMFA(code, userId, sessionId);
      const authData = response.data;

      if (authData.tokens) {
        localStorage.setItem('access_token', authData.tokens.access_token);
        localStorage.setItem('refresh_token', authData.tokens.refresh_token);
        setUser(authData.user);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    verifyMFA,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};