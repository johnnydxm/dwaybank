/**
 * Mock Services for Development
 * Provides in-memory implementations of database and Redis for local development
 */

import { UserProfile, CreateUserInput, LoginCredentials } from '../types';
import logger from '../config/logger';

// In-memory user storage
const users = new Map<string, any>();
const sessions = new Map<string, any>();
const tokens = new Map<string, any>();

// Mock database pool
export const mockPool = {
  connect: async () => ({
    query: async (sql: string, params?: any[]) => {
      logger.debug('Mock DB Query', { sql, params });
      
      // Mock user creation
      if (sql.includes('INSERT INTO users')) {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = {
          id: userId,
          email: params?.[0] || '',
          password_hash: params?.[1] || '',
          first_name: params?.[2] || '',
          last_name: params?.[3] || '',
          phone_number: params?.[4] || null,
          status: 'active',
          email_verified: false,
          phone_verified: false,
          kyc_status: 'pending',
          timezone: params?.[5] || 'UTC',
          locale: params?.[6] || 'en-US',
          created_at: new Date(),
          last_login: null
        };
        
        users.set(userId, user);
        
        return {
          rows: [user],
          rowCount: 1
        };
      }
      
      // Mock user lookup by email
      if (sql.includes('SELECT') && sql.includes('WHERE email =')) {
        const email = params?.[0]?.toLowerCase();
        const user = Array.from(users.values()).find(u => u.email.toLowerCase() === email);
        
        return {
          rows: user ? [user] : [],
          rowCount: user ? 1 : 0
        };
      }
      
      // Mock user lookup by ID
      if (sql.includes('SELECT') && sql.includes('WHERE id =')) {
        const userId = params?.[0];
        const user = users.get(userId);
        
        return {
          rows: user ? [user] : [],
          rowCount: user ? 1 : 0
        };
      }
      
      // Mock user update
      if (sql.includes('UPDATE users')) {
        const userId = params?.[params.length - 1];
        const user = users.get(userId);
        
        if (user) {
          // Update user fields based on the query
          return {
            rows: [user],
            rowCount: 1
          };
        }
        
        return {
          rows: [],
          rowCount: 0
        };
      }
      
      // Mock other queries
      return {
        rows: [],
        rowCount: 0
      };
    },
    release: () => {},
  }),
  
  query: async (sql: string, params?: any[]) => {
    const client = await mockPool.connect();
    const result = await client.query(sql, params);
    client.release();
    return result;
  }
};

// Mock Redis client
export const mockRedis = {
  get: async (key: string) => {
    const value = tokens.get(key);
    logger.debug('Mock Redis GET', { key, found: !!value });
    return value || null;
  },
  
  set: async (key: string, value: string) => {
    tokens.set(key, value);
    logger.debug('Mock Redis SET', { key });
    return 'OK';
  },
  
  setEx: async (key: string, seconds: number, value: string) => {
    tokens.set(key, value);
    // In a real implementation, we'd set a timeout to delete the key
    setTimeout(() => {
      tokens.delete(key);
    }, seconds * 1000);
    logger.debug('Mock Redis SETEX', { key, seconds });
    return 'OK';
  },
  
  del: async (...keys: string[]) => {
    let count = 0;
    keys.forEach(key => {
      if (tokens.delete(key)) count++;
    });
    logger.debug('Mock Redis DEL', { keys, deletedCount: count });
    return count;
  },
  
  keys: async (pattern: string) => {
    const allKeys = Array.from(tokens.keys());
    // Simple pattern matching - in real Redis this would be more sophisticated
    const matchingKeys = allKeys.filter(key => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(key);
    });
    logger.debug('Mock Redis KEYS', { pattern, matchingKeys });
    return matchingKeys;
  }
};

// Mock session service methods
export const mockSessionService = {
  createSession: async (userId: string, ipAddress: string, userAgent: string, options?: any) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tokenFamily = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      token_family: tokenFamily,
      status: 'active',
      expires_at: new Date(Date.now() + (options?.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
      created_at: new Date(),
      last_activity: new Date()
    };
    
    sessions.set(sessionId, session);
    
    logger.debug('Mock session created', { sessionId, userId });
    
    return {
      sessionId,
      tokenFamily,
      session
    };
  },
  
  getSession: async (sessionId: string) => {
    const session = sessions.get(sessionId);
    logger.debug('Mock session lookup', { sessionId, found: !!session });
    return session || null;
  },
  
  updateSessionActivity: async (sessionId: string, accessTokenJti?: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.last_activity = new Date();
      logger.debug('Mock session activity updated', { sessionId });
    }
  },
  
  revokeSession: async (sessionId: string, reason?: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.status = 'revoked';
      session.revoked_at = new Date();
      session.revoked_reason = reason;
      logger.debug('Mock session revoked', { sessionId, reason });
      return true;
    }
    return false;
  },
  
  revokeUserSessions: async (userId: string, excludeSessionId?: string, reason?: string) => {
    let revokedCount = 0;
    
    sessions.forEach((session, sessionId) => {
      if (session.user_id === userId && sessionId !== excludeSessionId && session.status === 'active') {
        session.status = 'revoked';
        session.revoked_at = new Date();
        session.revoked_reason = reason;
        revokedCount++;
      }
    });
    
    logger.debug('Mock user sessions revoked', { userId, excludeSessionId, revokedCount });
    return revokedCount;
  },
  
  getUserSessions: async (userId: string) => {
    const userSessions = Array.from(sessions.values())
      .filter(session => session.user_id === userId && session.status === 'active')
      .map(session => ({
        id: session.id,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        created_at: session.created_at,
        last_activity: session.last_activity,
        expires_at: session.expires_at
      }));
    
    logger.debug('Mock user sessions retrieved', { userId, sessionCount: userSessions.length });
    return userSessions;
  },
  
  cleanupExpiredSessions: async () => {
    let cleanedCount = 0;
    const now = new Date();
    
    sessions.forEach((session, sessionId) => {
      if (session.expires_at < now) {
        sessions.delete(sessionId);
        cleanedCount++;
      }
    });
    
    logger.debug('Mock expired sessions cleaned', { cleanedCount });
    return cleanedCount;
  },
  
  getSessionStats: async () => {
    const allSessions = Array.from(sessions.values());
    const now = new Date();
    
    return {
      totalActive: allSessions.filter(s => s.status === 'active' && s.expires_at > now).length,
      totalExpired: allSessions.filter(s => s.expires_at <= now).length,
      suspiciousCount: 0 // Mock value
    };
  }
};

// Mock MFA service
export const mockMfaService = {
  getUserMFAMethods: async (userId: string) => {
    logger.debug('Mock MFA methods lookup', { userId });
    // Return empty array - no MFA enabled in development
    return [];
  },
  
  verifyCode: async (options: any) => {
    logger.debug('Mock MFA verification', { options });
    // Always return success for development
    return {
      success: true,
      method: options.method || 'totp',
      configId: options.configId,
      remainingBackupCodes: 8
    };
  }
};

// Mock email service
export const mockEmailService = {
  sendVerificationEmail: async (email: string, data: any) => {
    logger.info('Mock email sent - Verification', { 
      to: email, 
      firstName: data.firstName,
      verificationUrl: data.verificationUrl 
    });
    return true;
  },
  
  sendPasswordResetEmail: async (email: string, data: any) => {
    logger.info('Mock email sent - Password Reset', { 
      to: email, 
      firstName: data.firstName,
      resetUrl: data.resetUrl 
    });
    return true;
  }
};

/**
 * Initialize mock services by replacing imports in the application
 */
export function createMockServices() {
  logger.info('Initializing mock services for development');
  
  // Replace database pool
  require('../config/database').pool = mockPool;
  
  // Replace Redis client
  require('../config/database').redis = mockRedis;
  
  // Replace session service methods
  const sessionService = require('../services/session.service').sessionService;
  Object.assign(sessionService, mockSessionService);
  
  // Replace MFA service methods
  const mfaService = require('../services/mfa.service').mfaService;
  Object.assign(mfaService, mockMfaService);
  
  // Replace email service methods
  const emailService = require('../services/email.service').emailService;
  Object.assign(emailService, mockEmailService);
  
  logger.info('Mock services initialized successfully');
}