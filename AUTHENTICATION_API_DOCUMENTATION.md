# DwayBank Smart Wallet - Authentication API Documentation

## Overview

The DwayBank Smart Wallet Authentication API provides a comprehensive, secure authentication system with multi-factor authentication (MFA), session management, and robust security controls. The API is built with enterprise-grade security standards and follows RESTful conventions.

## Base URL

```
Development: http://localhost:3000/api/v1/auth
Production: https://api.dwaybank.com/api/v1/auth
```

## Authentication

Most endpoints require a valid JWT access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Rate Limiting

All endpoints are protected by rate limiting to prevent abuse:

- **Login**: 5 attempts per 15 minutes per IP/user
- **Registration**: 3 attempts per hour per IP
- **Password Reset**: 3 attempts per hour per IP
- **Email Verification**: 3 attempts per 5 minutes per IP
- **General Auth**: 5 attempts per 15 minutes per IP/user

## Response Format

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "message": string,
  "data": object | null,
  "error": string | null,
  "timestamp": string,
  "requestId": string,
  "validation_errors": array | null
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | Missing or invalid authentication token |
| `AUTHORIZATION_FAILED` | Insufficient permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `USER_ALREADY_EXISTS` | Email already registered |
| `INVALID_CREDENTIALS` | Invalid email or password |
| `INVALID_TOKEN` | Invalid or expired token |
| `INVALID_MFA_CODE` | Invalid MFA verification code |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `ACCOUNT_INACTIVE` | Account is not active |
| `EMAIL_VERIFICATION_REQUIRED` | Email must be verified |
| `WEAK_PASSWORD` | Password doesn't meet strength requirements |

---

# Endpoints

## User Registration & Authentication

### POST /register

Register a new user account with email verification.

**Rate Limit**: 3 attempts per hour per IP

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "confirm_password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "timezone": "America/New_York",
  "locale": "en-US",
  "accept_terms": true,
  "accept_privacy": true
}
```

**Validation Rules:**
- Email: Valid email format, max 255 characters
- Password: Min 8 chars, max 128 chars, must contain uppercase, lowercase, number, and special character
- Names: 1-50 characters, letters/spaces/hyphens/apostrophes only
- Phone: International format (+1234567890)
- Terms/Privacy: Must be `true`

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully. Please verify your email address.",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "status": "pending",
      "email_verified": false,
      "created_at": "2025-07-29T10:00:00.000Z"
    },
    "verification_required": true
  }
}
```

**Error Response (409 - User Exists):**
```json
{
  "success": false,
  "message": "An account with this email address already exists",
  "error": "USER_ALREADY_EXISTS"
}
```

---

### POST /login

Authenticate user and receive access tokens. Returns MFA challenge if MFA is enabled.

**Rate Limit**: 5 attempts per 15 minutes per IP

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "remember_me": false
}
```

**Response (200 - No MFA):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "status": "active",
      "email_verified": true,
      "created_at": "2025-07-29T10:00:00.000Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
      "expires_in": 900,
      "token_type": "Bearer",
      "scope": ["read", "write"]
    }
  }
}
```

**Response (200 - MFA Required):**
```json
{
  "success": true,
  "message": "MFA verification required",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "mfa_required": true,
    "mfa_methods": [
      {
        "id": "mfa-config-id",
        "method": "totp",
        "isPrimary": true
      }
    ]
  }
}
```

---

### POST /verify-mfa

Complete MFA verification and receive access tokens.

**Rate Limit**: 5 attempts per 15 minutes per IP

**Headers:**
```
X-User-ID: uuid-here
X-Session-ID: session-uuid-here
```

**Request Body:**
```json
{
  "code": "123456",
  "method": "totp",
  "config_id": "mfa-config-uuid",
  "is_backup_code": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "MFA verification successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
      "expires_in": 900,
      "token_type": "Bearer",
      "scope": ["read", "write"]
    }
  }
}
```

---

### POST /logout

Logout user and revoke session. Can logout from current device or all devices.

**Authentication**: Required

**Request Body:**
```json
{
  "all_devices": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### POST /refresh

Refresh access token using refresh token.

**Rate Limit**: 5 attempts per 15 minutes per IP

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
      "expires_in": 900,
      "token_type": "Bearer",
      "scope": ["read", "write"]
    }
  }
}
```

---

## User Profile Management

### GET /profile

Get current user profile information.

**Authentication**: Required

**Response (200):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone_number": "+1234567890",
      "status": "active",
      "email_verified": true,
      "phone_verified": false,
      "kyc_status": "pending",
      "profile_picture": "https://example.com/avatar.jpg",
      "timezone": "America/New_York",
      "locale": "en-US",
      "created_at": "2025-07-29T10:00:00.000Z",
      "last_login": "2025-07-29T15:30:00.000Z"
    }
  }
}
```

---

### PUT /profile

Update user profile information.

**Authentication**: Required  
**Email Verification**: Required

**Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+1987654321",
  "timezone": "America/Los_Angeles",
  "locale": "en-US",
  "profile_picture": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      // Updated user object
    }
  }
}
```

---

## Password Management

### POST /forgot-password

Request password reset email.

**Rate Limit**: 3 attempts per hour per IP

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account with this email exists, a password reset link has been sent."
}
```

---

### POST /reset-password

Complete password reset using token from email.

**Rate Limit**: 3 attempts per hour per IP

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecurePassword123!",
  "confirm_password": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

### PUT /change-password

Change password for authenticated user.

**Authentication**: Required  
**Email Verification**: Required  
**Rate Limit**: 5 attempts per 15 minutes per IP

**Request Body:**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePassword123!",
  "confirm_password": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully. You have been logged out from all devices."
}
```

---

## Email Verification

### POST /verify-email

Verify email address using token from verification email.

**Rate Limit**: 3 attempts per 5 minutes per IP

**Request Body:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verification successful"
}
```

---

### POST /resend-verification

Resend email verification email.

**Rate Limit**: 3 attempts per 5 minutes per IP  
**Authentication**: Optional (if not authenticated, must provide email)

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If your account exists and is not verified, a new verification email has been sent."
}
```

---

## Session Management

### GET /sessions

List all active sessions for the authenticated user.

**Authentication**: Required

**Query Parameters:**
- `page` (integer, 1-1000, default: 1)
- `limit` (integer, 1-100, default: 20)
- `sort` (string, values: created_at|last_used|status, default: created_at)
- `order` (string, values: asc|desc, default: desc)

**Response (200):**
```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "id": "session-uuid",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2025-07-29T10:00:00.000Z",
        "last_used": "2025-07-29T15:30:00.000Z",
        "is_current": true,
        "location": "New York, NY",
        "device": "Chrome on macOS"
      }
    ],
    "total": 3
  }
}
```

---

### DELETE /sessions/:sessionId

Terminate a specific session.

**Authentication**: Required

**Response (200):**
```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

---

### DELETE /sessions

Terminate all sessions except the current one.

**Authentication**: Required

**Response (200):**
```json
{
  "success": true,
  "message": "3 session(s) terminated successfully",
  "data": {
    "revoked_sessions": 3
  }
}
```

---

## Security Features

### Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-Request-ID: unique-request-id`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

### Content-Type Validation

POST/PUT/PATCH requests must use `Content-Type: application/json`.

### API Version Support

Optional header: `X-API-Version: v1`

### Request Tracking

All requests receive a unique `X-Request-ID` for tracking and debugging.

---

## Development Setup

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dwaybank_dev
DB_USER=dwaybank
DB_PASSWORD=your_password

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=your_jwt_secret_32_characters_minimum
JWT_REFRESH_SECRET=your_jwt_refresh_secret_32_characters_minimum

# Security
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your_64_character_hex_encryption_key
CORS_ORIGIN=http://localhost:3001

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@yourdomain.com

# SMS Configuration (Optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Database Setup

1. Create PostgreSQL database
2. Run migrations: `npm run migrate`
3. Verify tables are created

### Running the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Testing
npm test
```

---

## Integration Examples

### Frontend Integration (JavaScript)

```javascript
// Login
const login = async (email, password) => {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    if (result.data.mfa_required) {
      // Handle MFA challenge
      return { mfaRequired: true, methods: result.data.mfa_methods };
    } else {
      // Store tokens
      localStorage.setItem('access_token', result.data.tokens.access_token);
      localStorage.setItem('refresh_token', result.data.tokens.refresh_token);
      return { success: true, user: result.data.user };
    }
  }
  
  return { success: false, error: result.message };
};

// Authenticated API calls
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    // Token expired, try refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry original request
      return makeAuthenticatedRequest(url, options);
    } else {
      // Redirect to login
      window.location.href = '/login';
      return null;
    }
  }
  
  return response.json();
};

// Token refresh
const refreshToken = async () => {
  const refresh_token = localStorage.getItem('refresh_token');
  
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    localStorage.setItem('access_token', result.data.tokens.access_token);
    localStorage.setItem('refresh_token', result.data.tokens.refresh_token);
    return true;
  }
  
  // Refresh failed, clear tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  return false;
};
```

### Mobile Integration (React Native)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  static async login(email, password) {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const result = await response.json();
      
      if (result.success && !result.data.mfa_required) {
        await AsyncStorage.setItem('access_token', result.data.tokens.access_token);
        await AsyncStorage.setItem('refresh_token', result.data.tokens.refresh_token);
      }
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  static async getProfile() {
    const token = await AsyncStorage.getItem('access_token');
    
    const response = await fetch('/api/v1/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    return response.json();
  }
}
```

---

## Security Considerations

### Password Requirements

- Minimum 8 characters, maximum 128 characters
- Must contain at least one:
  - Lowercase letter (a-z)
  - Uppercase letter (A-Z)
  - Number (0-9)
  - Special character (@$!%*?&)
- Cannot be common passwords (password, 123456, etc.)
- Cannot contain more than 2 consecutive repeated characters

### Token Security

- Access tokens expire in 15 minutes by default
- Refresh tokens expire in 7 days by default
- Tokens are revoked on password change
- Tokens include session binding to prevent theft

### Rate Limiting

- Aggressive rate limiting on authentication endpoints
- IP-based and user-based rate limiting
- Progressive delays for repeated failures
- Account lockout after multiple failed attempts

### Session Security

- Session binding to IP address and user agent
- Session expiration and cleanup
- Ability to revoke individual or all sessions
- Session hijacking protection

### Data Protection

- All passwords are hashed with bcrypt (12 rounds)
- Sensitive data encrypted at rest
- Audit logging for all security events
- Input validation and sanitization

---

## Support

For technical support or questions about the Authentication API:

- **Documentation**: This file and inline code comments
- **Testing**: Use the provided test suites in `/src/test/`
- **Configuration**: See `.env.example` for all configuration options
- **Database**: Check `/database/migrations/` for schema structure

---

## Changelog

### Version 1.0.0 (Foundation Layer)
- ✅ Complete user registration and authentication
- ✅ JWT token management with refresh capability
- ✅ Multi-factor authentication integration
- ✅ Password management (change, reset)
- ✅ Email verification system
- ✅ Session management and security
- ✅ Comprehensive rate limiting
- ✅ Input validation and security middleware
- ✅ Audit logging and monitoring
- ✅ Database migrations and token management
- ✅ Security headers and CORS configuration
- ✅ Error handling and response standardization