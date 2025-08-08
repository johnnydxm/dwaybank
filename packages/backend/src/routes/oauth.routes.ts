/**
 * OAuth 2.0 + OpenID Connect Routes for DwayBank Smart Wallet
 * RFC 6749 (OAuth 2.0) and OpenID Connect 1.0 compliant implementation
 */

import { Router, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { jwtService } from '../services/jwt.service';
import { redis } from '../config/database';
import logger, { auditLogger } from '../config/logger';
import { config } from '../config/environment';
import type { 
  AuthenticatedRequest, 
  ApiResponse, 
  AuthenticationContext 
} from '../types';

// Import middleware
import {
  authenticateToken,
  authRateLimit,
  validateRequest,
  securityMiddleware,
} from '../middleware/auth.middleware';

// Import validation middleware
import {
  validateOAuthAuthorize,
  validateOAuthToken,
  validateOAuthRevoke,
  validateOAuthIntrospect,
} from '../middleware/oauth.validation.middleware';

const router = Router();

// Apply common middleware
router.use(validateRequest);
router.use(securityMiddleware);

// ============================================================================
// OAUTH 2.0 AUTHORIZATION SERVER ENDPOINTS
// ============================================================================

/**
 * GET /oauth/v1/authorize
 * OAuth 2.0 Authorization Endpoint
 * RFC 6749 Section 3.1
 */
router.get('/authorize',
  authRateLimit,
  validateOAuthAuthorize,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        nonce,
        prompt,
        max_age,
      } = req.query as any;

      // Validate client_id and redirect_uri
      const client = await validateOAuthClient(client_id, redirect_uri);
      if (!client) {
        res.status(400).json({
          error: 'invalid_client',
          error_description: 'Invalid client_id or redirect_uri',
          state,
        });
        return;
      }

      // Check if user is authenticated
      if (!req.user) {
        // Redirect to login with authorization request preserved
        const loginUrl = `/auth/login?${new URLSearchParams({
          continue: req.originalUrl,
          client_id,
          redirect_uri,
          state: state || '',
        })}`;

        res.redirect(loginUrl);
        return;
      }

      // Generate authorization code
      const authCode = generateAuthorizationCode();
      
      // Store authorization code with metadata
      const codeData = {
        client_id,
        redirect_uri,
        user_id: req.user.id,
        scope: scope || 'openid profile email',
        code_challenge,
        code_challenge_method,
        nonce,
        expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes
        created_at: Date.now(),
      };

      await redis.setEx(`oauth:code:${authCode}`, 600, JSON.stringify(codeData));

      // Log authorization
      auditLogger.info('OAuth authorization granted', {
        userId: req.user.id,
        clientId: client_id,
        scope: scope || 'openid profile email',
        ip: req.ip,
      });

      // Redirect back to client with authorization code
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', authCode);
      if (state) redirectUrl.searchParams.set('state', state);

      res.redirect(redirectUrl.toString());

    } catch (error) {
      logger.error('OAuth authorization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during authorization',
        state: req.query.state,
      });
    }
  }
);

/**
 * POST /oauth/v1/token
 * OAuth 2.0 Token Endpoint
 * RFC 6749 Section 3.2
 */
router.post('/token',
  authRateLimit,
  validateOAuthToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        grant_type,
        code,
        redirect_uri,
        client_id,
        client_secret,
        code_verifier,
        refresh_token,
        scope,
      } = req.body;

      // Validate client credentials
      const client = await validateOAuthClient(client_id, redirect_uri, client_secret);
      if (!client) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      let tokenResponse;

      switch (grant_type) {
        case 'authorization_code':
          tokenResponse = await handleAuthorizationCodeGrant({
            code,
            redirect_uri,
            client_id,
            code_verifier,
          });
          break;

        case 'refresh_token':
          tokenResponse = await handleRefreshTokenGrant({
            refresh_token,
            client_id,
            scope,
          });
          break;

        default:
          res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: `Grant type '${grant_type}' is not supported`,
          });
          return;
      }

      if (!tokenResponse) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        });
        return;
      }

      res.json(tokenResponse);

    } catch (error) {
      logger.error('OAuth token request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        grantType: req.body.grant_type,
        clientId: req.body.client_id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token exchange',
      });
    }
  }
);

/**
 * POST /oauth/v1/revoke
 * OAuth 2.0 Token Revocation Endpoint
 * RFC 7009
 */
router.post('/revoke',
  authRateLimit,
  validateOAuthRevoke,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { token, token_type_hint, client_id, client_secret } = req.body;

      // Validate client credentials
      const client = await validateOAuthClient(client_id, null, client_secret);
      if (!client) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      // Revoke the token
      const revoked = await jwtService.revokeToken(token);

      auditLogger.info('OAuth token revoked', {
        clientId: client_id,
        tokenTypeHint: token_type_hint,
        revoked,
        ip: req.ip,
      });

      // OAuth 2.0 revocation endpoint returns 200 even for invalid tokens
      res.status(200).send();

    } catch (error) {
      logger.error('OAuth token revocation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId: req.body.client_id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token revocation',
      });
    }
  }
);

/**
 * POST /oauth/v1/introspect
 * OAuth 2.0 Token Introspection Endpoint
 * RFC 7662
 */
router.post('/introspect',
  authRateLimit,
  validateOAuthIntrospect,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { token, token_type_hint, client_id, client_secret } = req.body;

      // Validate client credentials
      const client = await validateOAuthClient(client_id, null, client_secret);
      if (!client) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        });
        return;
      }

      // Introspect the token
      const introspection = await jwtService.validateAccessToken(token);

      if (!introspection.isValid) {
        res.json({ active: false });
        return;
      }

      // Get user information
      const user = await userService.getUserById(introspection.payload!.sub);
      if (!user) {
        res.json({ active: false });
        return;
      }

      res.json({
        active: true,
        sub: introspection.payload!.sub,
        email: introspection.payload!.email,
        scope: introspection.payload!.scope.join(' '),
        client_id: client_id,
        exp: introspection.payload!.exp,
        iat: introspection.payload!.iat,
        token_type: 'Bearer',
      });

    } catch (error) {
      logger.error('OAuth token introspection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId: req.body.client_id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during token introspection',
      });
    }
  }
);

// ============================================================================
// OPENID CONNECT ENDPOINTS
// ============================================================================

/**
 * GET /.well-known/openid_configuration
 * OpenID Connect Discovery Document
 * OpenID Connect Discovery 1.0 Section 4
 */
router.get('/.well-known/openid_configuration', (req: AuthenticatedRequest, res: Response): void => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/v1/authorize`,
    token_endpoint: `${baseUrl}/oauth/v1/token`,
    revocation_endpoint: `${baseUrl}/oauth/v1/revoke`,
    introspection_endpoint: `${baseUrl}/oauth/v1/introspect`,
    userinfo_endpoint: `${baseUrl}/oauth/v1/userinfo`,
    jwks_uri: `${baseUrl}/oauth/v1/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [config.jwt.algorithm],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: [
      'sub', 'iss', 'aud', 'exp', 'iat', 'nonce',
      'email', 'email_verified', 'name', 'family_name', 'given_name',
      'picture', 'locale', 'updated_at'
    ],
    code_challenge_methods_supported: ['S256'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    introspection_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  });
});

/**
 * GET /oauth/v1/userinfo
 * OpenID Connect UserInfo Endpoint
 * OpenID Connect Core 1.0 Section 5.3
 */
router.get('/userinfo',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'The access token provided is expired, revoked, malformed, or invalid',
        });
        return;
      }

      // Return standard OpenID Connect claims
      res.json({
        sub: req.user.id,
        email: req.user.email,
        email_verified: req.user.email_verified,
        name: `${req.user.first_name} ${req.user.last_name}`,
        given_name: req.user.first_name,
        family_name: req.user.last_name,
        picture: req.user.profile_picture || null,
        locale: req.user.locale || 'en-US',
        updated_at: Math.floor(new Date(req.user.updated_at).getTime() / 1000),
      });

    } catch (error) {
      logger.error('UserInfo request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during userinfo request',
      });
    }
  }
);

/**
 * GET /oauth/v1/jwks
 * JSON Web Key Set Endpoint
 * RFC 7517
 */
router.get('/jwks', (req: AuthenticatedRequest, res: Response): void => {
  // For HMAC algorithms, we don't expose the secret
  // For RSA/ECDSA algorithms, we would expose the public key
  if (config.jwt.algorithm.startsWith('HS')) {
    res.json({ keys: [] });
  } else {
    // TODO: Implement RSA/ECDSA public key exposure
    res.json({ keys: [] });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate OAuth client credentials
 */
async function validateOAuthClient(
  clientId: string,
  redirectUri?: string,
  clientSecret?: string
): Promise<boolean> {
  // TODO: Implement proper client validation from database
  // For now, accept a demo client
  const validClients = {
    'dwaybank-web-app': {
      secret: process.env.OAUTH_CLIENT_SECRET || 'demo-client-secret',
      redirectUris: [
        'http://localhost:3001/auth/callback',
        'https://app.dwaybank.com/auth/callback',
        'https://staging.dwaybank.com/auth/callback',
      ],
    },
  };

  const client = validClients[clientId as keyof typeof validClients];
  if (!client) return false;

  // Validate redirect URI if provided
  if (redirectUri && !client.redirectUris.includes(redirectUri)) {
    return false;
  }

  // Validate client secret if provided
  if (clientSecret && client.secret !== clientSecret) {
    return false;
  }

  return true;
}

/**
 * Generate cryptographically secure authorization code
 */
function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(params: {
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier?: string;
}): Promise<any> {
  const { code, redirect_uri, client_id, code_verifier } = params;

  // Retrieve and validate authorization code
  const codeData = await redis.get(`oauth:code:${code}`);
  if (!codeData) return null;

  const authData = JSON.parse(codeData);

  // Validate code hasn't expired
  if (Date.now() > authData.expires_at) {
    await redis.del(`oauth:code:${code}`);
    return null;
  }

  // Validate parameters match
  if (authData.client_id !== client_id || authData.redirect_uri !== redirect_uri) {
    return null;
  }

  // Validate PKCE if code challenge was used
  if (authData.code_challenge) {
    if (!code_verifier) return null;
    
    const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (hash !== authData.code_challenge) return null;
  }

  // Delete authorization code (single use)
  await redis.del(`oauth:code:${code}`);

  // Get user for token generation
  const user = await userService.getUserById(authData.user_id);
  if (!user) return null;

  // Generate tokens
  const sessionId = uuidv4();
  const tokenFamily = uuidv4();
  
  const tokens = jwtService.generateTokenPair(user, {
    sessionId,
    tokenFamily,
    scope: authData.scope.split(' '),
  });

  // Generate ID token for OpenID Connect
  const idToken = await generateIdToken(user, {
    clientId: client_id,
    nonce: authData.nonce,
    scope: authData.scope,
  });

  auditLogger.info('OAuth tokens issued', {
    userId: user.id,
    clientId: client_id,
    scope: authData.scope,
  });

  return {
    access_token: tokens.access_token,
    token_type: 'Bearer',
    expires_in: tokens.expires_in,
    refresh_token: tokens.refresh_token,
    id_token: idToken,
    scope: authData.scope,
  };
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(params: {
  refresh_token: string;
  client_id: string;
  scope?: string;
}): Promise<any> {
  const { refresh_token, client_id, scope } = params;

  // Validate refresh token
  const validation = await jwtService.validateRefreshToken(refresh_token);
  if (!validation.isValid || !validation.payload) {
    return null;
  }

  // Get user
  const user = await userService.getUserById(validation.payload.sub);
  if (!user) return null;

  // Generate new tokens
  const newTokens = await jwtService.refreshTokens(refresh_token, user);
  if (!newTokens) return null;

  // Generate new ID token
  const idToken = await generateIdToken(user, {
    clientId: client_id,
    scope: scope || 'openid profile email',
  });

  return {
    access_token: newTokens.access_token,
    token_type: 'Bearer',
    expires_in: newTokens.expires_in,
    refresh_token: newTokens.refresh_token,
    id_token: idToken,
    scope: scope || 'openid profile email',
  };
}

/**
 * Generate OpenID Connect ID Token
 */
async function generateIdToken(
  user: any,
  options: {
    clientId: string;
    nonce?: string;
    scope: string;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  const payload = {
    iss: baseUrl,
    sub: user.id,
    aud: options.clientId,
    exp: now + 3600, // 1 hour
    iat: now,
    auth_time: now,
    nonce: options.nonce,
  };

  // Add additional claims based on scope
  const scopes = options.scope.split(' ');
  if (scopes.includes('email')) {
    Object.assign(payload, {
      email: user.email,
      email_verified: user.email_verified,
    });
  }

  if (scopes.includes('profile')) {
    Object.assign(payload, {
      name: `${user.first_name} ${user.last_name}`,
      given_name: user.first_name,
      family_name: user.last_name,
      picture: user.profile_picture,
      locale: user.locale || 'en-US',
      updated_at: Math.floor(new Date(user.updated_at).getTime() / 1000),
    });
  }

  // Sign with same key as access tokens
  return jwtService.generateAccessToken(user, {
    sessionId: uuidv4(),
    tokenFamily: uuidv4(),
    scope: scopes,
  });
}

export default router;