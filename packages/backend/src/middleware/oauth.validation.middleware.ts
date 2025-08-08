/**
 * OAuth 2.0 and OpenID Connect Validation Middleware
 * Validates OAuth 2.0 requests according to RFC 6749 and OpenID Connect specifications
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../config/logger';
import type { ApiResponse } from '../types';

/**
 * OAuth 2.0 Authorization Request Validation
 * RFC 6749 Section 4.1.1
 */
export const validateOAuthAuthorize = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    client_id: Joi.string().required(),
    redirect_uri: Joi.string().uri().required(),
    response_type: Joi.string().valid('code').required(),
    scope: Joi.string().default('openid profile email'),
    state: Joi.string().optional(),
    // PKCE parameters (RFC 7636)
    code_challenge: Joi.string().optional(),
    code_challenge_method: Joi.string().valid('S256').optional(),
    // OpenID Connect parameters
    nonce: Joi.string().optional(),
    prompt: Joi.string().valid('none', 'login', 'consent', 'select_account').optional(),
    max_age: Joi.number().integer().min(0).optional(),
    ui_locales: Joi.string().optional(),
    id_token_hint: Joi.string().optional(),
    login_hint: Joi.string().optional(),
    acr_values: Joi.string().optional(),
  });

  const { error, value } = schema.validate(req.query, {
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDescription = error.details.map(detail => detail.message).join(', ');
    
    logger.warn('Invalid OAuth authorization request', {
      error: errorDescription,
      query: req.query,
      ip: req.ip,
    });

    // For authorization endpoint errors, we should redirect back to client
    // if redirect_uri is valid, otherwise return JSON error
    const redirectUri = req.query.redirect_uri as string;
    const state = req.query.state as string;

    if (redirectUri && isValidUri(redirectUri)) {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set('error', 'invalid_request');
      errorUrl.searchParams.set('error_description', errorDescription);
      if (state) errorUrl.searchParams.set('state', state);
      
      res.redirect(errorUrl.toString());
      return;
    }

    res.status(400).json({
      success: false,
      message: 'Invalid OAuth authorization request',
      error: 'invalid_request',
      error_description: errorDescription,
      state,
      timestamp: new Date().toISOString(),
    } as ApiResponse);
    return;
  }

  // Validate PKCE consistency
  if (value.code_challenge && !value.code_challenge_method) {
    const errorDescription = 'code_challenge_method is required when code_challenge is provided';
    
    if (value.redirect_uri && isValidUri(value.redirect_uri)) {
      const errorUrl = new URL(value.redirect_uri);
      errorUrl.searchParams.set('error', 'invalid_request');
      errorUrl.searchParams.set('error_description', errorDescription);
      if (value.state) errorUrl.searchParams.set('state', value.state);
      
      res.redirect(errorUrl.toString());
      return;
    }

    res.status(400).json({
      error: 'invalid_request',
      error_description: errorDescription,
      state: value.state,
    });
    return;
  }

  req.query = value;
  next();
};

/**
 * OAuth 2.0 Token Request Validation
 * RFC 6749 Section 4.1.3
 */
export const validateOAuthToken = (req: Request, res: Response, next: NextFunction): void => {
  const baseSchema = {
    client_id: Joi.string().required(),
    client_secret: Joi.string().optional(), // Can be in Authorization header
  };

  // Different validation based on grant type
  const grantTypeSchemas = {
    authorization_code: Joi.object({
      ...baseSchema,
      grant_type: Joi.string().valid('authorization_code').required(),
      code: Joi.string().required(),
      redirect_uri: Joi.string().uri().required(),
      // PKCE parameters
      code_verifier: Joi.string().optional(),
    }),
    refresh_token: Joi.object({
      ...baseSchema,
      grant_type: Joi.string().valid('refresh_token').required(),
      refresh_token: Joi.string().required(),
      scope: Joi.string().optional(),
    }),
  };

  const grantType = req.body.grant_type;
  
  if (!grantType || !grantTypeSchemas[grantType as keyof typeof grantTypeSchemas]) {
    res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: `Grant type '${grantType}' is not supported`,
    });
    return;
  }

  const schema = grantTypeSchemas[grantType as keyof typeof grantTypeSchemas];
  const { error, value } = schema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDescription = error.details.map(detail => detail.message).join(', ');
    
    logger.warn('Invalid OAuth token request', {
      error: errorDescription,
      grantType,
      clientId: req.body.client_id,
      ip: req.ip,
    });

    res.status(400).json({
      error: 'invalid_request',
      error_description: errorDescription,
    });
    return;
  }

  req.body = value;
  next();
};

/**
 * OAuth 2.0 Token Revocation Request Validation
 * RFC 7009 Section 2.1
 */
export const validateOAuthRevoke = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    token: Joi.string().required(),
    token_type_hint: Joi.string().valid('access_token', 'refresh_token').optional(),
    client_id: Joi.string().required(),
    client_secret: Joi.string().optional(), // Can be in Authorization header
  });

  const { error, value } = schema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDescription = error.details.map(detail => detail.message).join(', ');
    
    logger.warn('Invalid OAuth revocation request', {
      error: errorDescription,
      clientId: req.body.client_id,
      ip: req.ip,
    });

    res.status(400).json({
      error: 'invalid_request',
      error_description: errorDescription,
    });
    return;
  }

  req.body = value;
  next();
};

/**
 * OAuth 2.0 Token Introspection Request Validation
 * RFC 7662 Section 2.1
 */
export const validateOAuthIntrospect = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    token: Joi.string().required(),
    token_type_hint: Joi.string().valid('access_token', 'refresh_token').optional(),
    client_id: Joi.string().required(),
    client_secret: Joi.string().optional(), // Can be in Authorization header
  });

  const { error, value } = schema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDescription = error.details.map(detail => detail.message).join(', ');
    
    logger.warn('Invalid OAuth introspection request', {
      error: errorDescription,
      clientId: req.body.client_id,
      ip: req.ip,
    });

    res.status(400).json({
      error: 'invalid_request',
      error_description: errorDescription,
    });
    return;
  }

  req.body = value;
  next();
};

/**
 * OpenID Connect UserInfo Request Validation
 * OpenID Connect Core 1.0 Section 5.3.1
 */
export const validateUserInfo = (req: Request, res: Response, next: NextFunction): void => {
  // UserInfo endpoint requires Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      error: 'invalid_request',
      error_description: 'Authorization header is required',
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'invalid_request',
      error_description: 'Authorization header must use Bearer token',
    });
    return;
  }

  const token = authHeader.substring(7);
  if (!token || token.trim().length === 0) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Access token is required',
    });
    return;
  }

  next();
};

/**
 * Validate scope parameter
 */
export const validateScope = (scope: string): boolean => {
  const validScopes = ['openid', 'profile', 'email', 'offline_access', 'read', 'write'];
  const requestedScopes = scope.split(' ');
  
  return requestedScopes.every(s => validScopes.includes(s));
};

/**
 * Validate if a string is a valid URI
 */
function isValidUri(uri: string): boolean {
  try {
    new URL(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate PKCE code challenge
 */
export const validateCodeChallenge = (codeChallenge: string, method: string = 'S256'): boolean => {
  if (method !== 'S256') return false;
  
  // S256: BASE64URL(SHA256(code_verifier))
  // Code challenge should be 43-128 characters, URL-safe base64
  const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
  return codeChallenge.length >= 43 && 
         codeChallenge.length <= 128 && 
         base64UrlPattern.test(codeChallenge);
};

/**
 * Validate PKCE code verifier
 */
export const validateCodeVerifier = (codeVerifier: string): boolean => {
  // Code verifier should be 43-128 characters, URL-safe
  const validPattern = /^[A-Za-z0-9._~-]+$/;
  return codeVerifier.length >= 43 && 
         codeVerifier.length <= 128 && 
         validPattern.test(codeVerifier);
};

/**
 * Middleware to extract client credentials from Authorization header
 * Supports both Basic authentication and client_secret in body
 */
export const extractClientCredentials = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
      const [clientId, clientSecret] = credentials.split(':');
      
      if (clientId && clientSecret) {
        req.body.client_id = req.body.client_id || clientId;
        req.body.client_secret = req.body.client_secret || clientSecret;
      }
    } catch (error) {
      logger.warn('Invalid Basic authentication header', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });
      
      res.status(400).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials format',
      });
      return;
    }
  }
  
  next();
};