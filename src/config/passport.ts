import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { config } from './environment';
import logger, { auditLogger } from './logger';
import type { Request } from 'express';
import type { UserProfile, JWTPayload } from '../types';

/**
 * Passport.js Configuration for DwayBank Authentication
 * Implements Local and JWT strategies for OAuth 2.0 + OpenID Connect foundation
 */

// Custom JWT extractor that checks multiple locations
const jwtExtractor = (req: Request): string | null => {
  let token: string | null = null;

  // 1. Authorization header (Bearer token)
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // 2. Cookie (for web sessions)
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  // 3. Query parameter (for API usage, less secure)
  if (!token && req.query && req.query.access_token) {
    token = req.query.access_token as string;
  }

  // 4. Custom header (for mobile apps)
  if (!token && req.headers['x-access-token']) {
    token = req.headers['x-access-token'] as string;
  }

  return token;
};

/**
 * Local Strategy for username/password authentication
 */
passport.use('local', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true,
}, async (req: Request, email: string, password: string, done) => {
  try {
    // Extract context information from request
    const context = {
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      deviceType: req.get('X-Device-Type') as 'mobile' | 'desktop' | 'tablet' | 'api' || 'desktop',
      country: req.get('X-Country-Code'),
      city: req.get('X-City'),
    };

    // Authenticate user
    const loginResult = await authService.login({
      email,
      password,
      remember_me: req.body.remember_me || false,
    }, context);

    if (!loginResult) {
      auditLogger.warn('Local strategy authentication failed', {
        email,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return done(null, false, { 
        message: 'Invalid email or password' 
      });
    }

    // Check if MFA is required
    if (loginResult.mfa_required) {
      auditLogger.info('MFA required for login', {
        userId: loginResult.user.id,
        email: loginResult.user.email,
        ipAddress: context.ipAddress,
      });

      return done(null, false, {
        message: 'Multi-factor authentication required',
        mfa_required: true,
        mfa_methods: loginResult.mfa_methods,
        user_id: loginResult.user.id,
      });
    }

    // Successful authentication
    auditLogger.info('Local strategy authentication successful', {
      userId: loginResult.user.id,
      email: loginResult.user.email,
      ipAddress: context.ipAddress,
    });

    // Attach tokens to user object for access in route handlers
    const userWithTokens = {
      ...loginResult.user,
      tokens: loginResult.tokens,
    };

    return done(null, userWithTokens);

  } catch (error) {
    logger.error('Local strategy error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email,
      ipAddress: req.ip,
    });

    return done(error);
  }
}));

/**
 * JWT Strategy for token-based authentication
 */
passport.use('jwt', new JwtStrategy({
  jwtFromRequest: jwtExtractor,
  secretOrKey: config.jwt.secret,
  algorithms: [config.jwt.algorithm as any],
  audience: 'dwaybank-client',
  issuer: 'dwaybank-api',
  passReqToCallback: true,
}, async (req: Request, payload: JWTPayload, done) => {
  try {
    // Validate token structure
    if (!payload.sub || !payload.email || !payload.session_id) {
      auditLogger.warn('Invalid JWT payload structure', {
        sub: payload.sub,
        email: payload.email,
        sessionId: payload.session_id,
        ipAddress: req.ip,
      });

      return done(null, false, { 
        message: 'Invalid token structure' 
      });
    }

    // Get user from database
    const user = await userService.getUserById(payload.sub);
    if (!user) {
      auditLogger.warn('JWT authentication failed - user not found', {
        userId: payload.sub,
        email: payload.email,
        ipAddress: req.ip,
      });

      return done(null, false, { 
        message: 'User not found' 
      });
    }

    // Check user account status
    if (user.status !== 'active' && user.status !== 'pending') {
      auditLogger.warn('JWT authentication failed - inactive user', {
        userId: user.id,
        status: user.status,
        ipAddress: req.ip,
      });

      return done(null, false, { 
        message: 'User account is not active' 
      });
    }

    // Validate session is still active (this would typically check Redis/DB)
    // For now, we'll assume the session is valid if the JWT is valid

    // Add JWT payload to user object for access in routes
    const authenticatedUser = {
      ...user,
      jwt_payload: payload,
      session_id: payload.session_id,
    };

    auditLogger.debug('JWT authentication successful', {
      userId: user.id,
      email: user.email,
      sessionId: payload.session_id,
      ipAddress: req.ip,
    });

    return done(null, authenticatedUser);

  } catch (error) {
    logger.error('JWT strategy error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: payload?.sub,
      ipAddress: req.ip,
    });

    return done(error);
  }
}));

/**
 * Serialize user for session storage (not used in JWT-based auth, but required by Passport)
 */
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session storage (not used in JWT-based auth, but required by Passport)
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

/**
 * Custom authentication middleware for API routes
 */
export const authenticateJWT = (req: Request, res: any, next: any) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: UserProfile | false, info: any) => {
    if (err) {
      logger.error('JWT authentication middleware error', {
        error: err.message,
        path: req.path,
        method: req.method,
        ipAddress: req.ip,
      });

      return res.status(500).json({
        error: 'Authentication Error',
        message: 'Internal authentication error',
        timestamp: new Date().toISOString(),
      });
    }

    if (!user) {
      auditLogger.warn('JWT authentication failed in middleware', {
        path: req.path,
        method: req.method,
        ipAddress: req.ip,
        reason: info?.message || 'Unknown',
      });

      return res.status(401).json({
        error: 'Unauthorized',
        message: info?.message || 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
    }

    // Attach user to request for route handlers
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = (req: Request, res: any, next: any) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: UserProfile | false) => {
    if (err) {
      logger.warn('Optional authentication error', { error: err.message });
    }

    // Attach user if available, but don't fail
    if (user) {
      req.user = user;
    }

    next();
  })(req, res, next);
};

/**
 * Login middleware using local strategy
 */
export const authenticateLocal = (req: Request, res: any, next: any) => {
  passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      logger.error('Local authentication middleware error', {
        error: err.message,
        email: req.body.email,
        ipAddress: req.ip,
      });

      return res.status(500).json({
        error: 'Authentication Error',
        message: 'Internal authentication error',
        timestamp: new Date().toISOString(),
      });
    }

    if (!user) {
      auditLogger.warn('Local authentication failed in middleware', {
        email: req.body.email,
        ipAddress: req.ip,
        reason: info?.message || 'Unknown',
        mfaRequired: info?.mfa_required,
      });

      const statusCode = info?.mfa_required ? 202 : 401;
      const response: any = {
        error: info?.mfa_required ? 'MFA Required' : 'Unauthorized',
        message: info?.message || 'Authentication failed',
        timestamp: new Date().toISOString(),
      };

      if (info?.mfa_required) {
        response.mfa_required = true;
        response.mfa_methods = info.mfa_methods;
        response.user_id = info.user_id;
      }

      return res.status(statusCode).json(response);
    }

    // Successful authentication
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    // For now, we'll implement basic role checking
    // In a full implementation, this would check user roles from database
    const userRoles = ['user']; // Default role for all authenticated users

    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      auditLogger.warn('Authorization failed - insufficient permissions', {
        userId: (req.user as any).id,
        requiredRoles: roles,
        userRoles,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Scope-based authorization middleware for OAuth-style permissions
 */
export const requireScope = (requiredScopes: string[]) => {
  return (req: Request, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    const user = req.user as any;
    const userScopes = user.jwt_payload?.scope || ['read', 'write'];

    const hasRequiredScope = requiredScopes.every(scope => 
      userScopes.includes(scope)
    );

    if (!hasRequiredScope) {
      auditLogger.warn('Authorization failed - insufficient scope', {
        userId: user.id,
        requiredScopes,
        userScopes,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient token scope',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Email verification requirement middleware
 */
export const requireEmailVerification = (req: Request, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  const user = req.user as UserProfile;
  
  if (!user.email_verified) {
    auditLogger.warn('Access denied - email not verified', {
      userId: user.id,
      email: user.email,
      path: req.path,
    });

    return res.status(403).json({
      error: 'Email Verification Required',
      message: 'Please verify your email address to access this resource',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * KYC verification requirement middleware
 */
export const requireKYCVerification = (req: Request, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  const user = req.user as UserProfile;
  
  if (user.kyc_status !== 'approved') {
    auditLogger.warn('Access denied - KYC not verified', {
      userId: user.id,
      kycStatus: user.kyc_status,
      path: req.path,
    });

    return res.status(403).json({
      error: 'KYC Verification Required',
      message: 'Please complete identity verification to access this resource',
      kyc_status: user.kyc_status,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

export default passport;