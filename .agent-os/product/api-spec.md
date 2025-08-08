# API Specification

## Overview

DwayBank Smart Wallet API provides a comprehensive set of endpoints for financial management, authentication, and security. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.dwaybank.com`
- **Version**: `v1`

## Authentication

### JWT Token Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Multi-Factor Authentication

Certain endpoints require MFA verification. MFA tokens are sent in the request body:

```json
{
  "mfaToken": "123456",
  "mfaType": "totp"
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": "Additional error details"
  }
}
```

## Authentication Endpoints

### POST /api/v1/auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "country": "US",
  "acceptTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "status": "pending_verification",
    "message": "Account created successfully. Please verify your email."
  }
}
```

### POST /api/v1/auth/login

Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "status": "active"
    }
  }
}
```

### POST /api/v1/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 3600
  }
}
```

### POST /api/v1/auth/logout

Logout user and invalidate tokens.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/v1/auth/verify-mfa

Verify multi-factor authentication.

**Request Body:**
```json
{
  "mfaToken": "123456",
  "mfaType": "totp",
  "sessionId": "session_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "sessionId": "session_uuid",
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

## User Management Endpoints

### GET /api/v1/auth/profile

Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "dateOfBirth": "1990-01-01",
    "country": "US",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-01T12:00:00Z"
  }
}
```

### PUT /api/v1/auth/profile

Update user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "country": "US",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

### POST /api/v1/auth/change-password

Change user password.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "mfaToken": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## MFA Management Endpoints

### POST /api/v1/mfa/setup

Setup multi-factor authentication.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "mfaType": "totp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": ["123456", "234567", "345678"]
  }
}
```

### POST /api/v1/mfa/verify-setup

Verify MFA setup.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "mfaToken": "123456",
  "mfaType": "totp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA setup verified successfully"
}
```

### POST /api/v1/mfa/disable

Disable multi-factor authentication.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "mfaToken": "123456",
  "mfaType": "totp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA disabled successfully"
}
```

## Session Management Endpoints

### GET /api/v1/sessions

Get active user sessions.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_uuid",
        "deviceType": "desktop",
        "browser": "Chrome",
        "os": "Windows",
        "ipAddress": "192.168.1.1",
        "lastActive": "2024-01-01T12:00:00Z",
        "isCurrent": true
      }
    ]
  }
}
```

### DELETE /api/v1/sessions/{sessionId}

Revoke specific session.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

### DELETE /api/v1/sessions/all

Revoke all sessions except current.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "All other sessions revoked successfully"
}
```

## Security Endpoints

### GET /api/v1/security/events

Get security events for user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `type` (string): Event type filter
- `startDate` (string): Start date filter
- `endDate` (string): End date filter

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_uuid",
        "type": "login",
        "description": "Successful login from Chrome on Windows",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2024-01-01T12:00:00Z",
        "riskScore": 0.1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### POST /api/v1/security/report-suspicious

Report suspicious activity.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "eventType": "suspicious_login",
  "description": "Login attempt from unknown location",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "additionalDetails": "Additional context"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Suspicious activity reported successfully"
}
```

## Health Check Endpoints

### GET /health

Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0",
    "services": {
      "database": "connected",
      "redis": "connected",
      "email": "connected"
    }
  }
}
```

### GET /api

Get API information.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "DwayBank Smart Wallet API",
    "version": "1.0.0",
    "description": "Unified financial management platform API",
    "endpoints": {
      "auth": "/api/v1/auth/*",
      "mfa": "/api/v1/mfa/*",
      "sessions": "/api/v1/sessions/*",
      "security": "/api/v1/security/*"
    }
  }
}
```

## Error Codes

### Authentication Errors (AUTH_*)
- `AUTH_001`: Invalid credentials
- `AUTH_002`: Account locked
- `AUTH_003`: Account not verified
- `AUTH_004`: Token expired
- `AUTH_005`: Invalid token
- `AUTH_006`: MFA required
- `AUTH_007`: MFA verification failed

### Validation Errors (VAL_*)
- `VAL_001`: Required field missing
- `VAL_002`: Invalid email format
- `VAL_003`: Password too weak
- `VAL_004`: Invalid phone number
- `VAL_005`: Invalid date format

### Security Errors (SEC_*)
- `SEC_001`: Rate limit exceeded
- `SEC_002`: Suspicious activity detected
- `SEC_003`: IP blocked
- `SEC_004`: Device not recognized

### Server Errors (SRV_*)
- `SRV_001`: Database connection error
- `SRV_002`: Redis connection error
- `SRV_003`: Email service error
- `SRV_004`: Internal server error

## Rate Limiting

### Default Limits
- **Authentication endpoints**: 5 requests per minute per IP
- **API endpoints**: 100 requests per minute per user
- **MFA endpoints**: 3 requests per minute per user
- **Security endpoints**: 10 requests per minute per user

### Headers
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Webhooks

### Event Types
- `user.registered`: New user registration
- `user.login`: User login
- `user.logout`: User logout
- `mfa.enabled`: MFA enabled
- `mfa.disabled`: MFA disabled
- `security.alert`: Security alert triggered

### Webhook Payload
```json
{
  "event": "user.login",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "userId": "uuid",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

## SDKs and Libraries

### Official SDKs
- **JavaScript/TypeScript**: `@dwaybank/api-client`
- **Python**: `dwaybank-python`
- **Java**: `dwaybank-java`
- **C#**: `DwayBank.ApiClient`

### Community Libraries
- **PHP**: `dwaybank-php`
- **Ruby**: `dwaybank-ruby`
- **Go**: `dwaybank-go`

## Documentation

- **Interactive API Docs**: Available at `/api/docs`
- **Postman Collection**: Available for download
- **OpenAPI Specification**: Available at `/api/openapi.json`
- **SDK Documentation**: Available in each SDK repository

---

**Note**: This API specification is versioned and backward compatible. Breaking changes will be communicated in advance and new versions will be released with proper migration guides. 