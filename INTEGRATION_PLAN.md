# DwayBank Frontend-Backend Integration Plan

## Overview
This document outlines the step-by-step integration process to connect the DwayBank frontend with the real backend services, replacing the mock server implementation.

## Current Status ✅
- **Field Mapping**: Frontend User types updated to match backend UserProfile structure
- **JWT Service**: Production-ready JWT authentication service implemented
- **Real Routes**: Enterprise-grade authentication routes with security middleware
- **API Service**: Frontend API service updated for real backend response structure
- **Database Setup**: Migration scripts and database setup tools created
- **Production Server**: New production server replacing mock implementation

## Integration Steps

### Phase 1: Database Setup
```bash
# 1. Ensure PostgreSQL and Redis are running
# 2. Navigate to backend directory
cd packages/backend

# 3. Install dependencies
npm install

# 4. Setup database and run migrations
npm run db:setup

# 5. Verify database setup
npm run typecheck
```

### Phase 2: Backend Startup
```bash
# Start the production backend (port 3004)
npm run dev
```

### Phase 3: Frontend Configuration
```bash
# Navigate to frontend directory
cd packages/frontend

# Update environment configuration if needed
# Ensure VITE_API_BASE_URL points to http://localhost:3004/api/v1

# Start frontend
npm run dev
```

### Phase 4: Integration Testing

#### Test Sequence
1. **Registration Flow**
   - Navigate to `/register`
   - Test with: `email: test@example.com, password: Test123456!`
   - Verify user creation in database
   - Check email verification flow

2. **Login Flow** 
   - Navigate to `/login`
   - Test with registered credentials
   - Verify JWT token storage
   - Check profile data retrieval

3. **Authentication Persistence**
   - Refresh browser
   - Verify auto-login with stored tokens
   - Test token refresh mechanism

4. **Profile Management**
   - Update profile information
   - Verify changes persist
   - Test validation errors

## Field Mapping Verification

### Frontend User Interface
```typescript
interface User {
  id: string;
  email: string;
  first_name: string;        // ✅ Matches backend
  last_name: string;         // ✅ Matches backend  
  email_verified: boolean;   // ✅ Matches backend
  phone_verified?: boolean;  // ✅ Added to match backend
  kyc_status?: string;       // ✅ Added to match backend
  status: 'pending' | 'active' | 'suspended' | 'closed'; // ✅ Updated
  // ... other fields
}
```

### Backend UserProfile Response
```typescript
interface UserProfile {
  id: string;
  email: string;
  first_name: string;        // ✅ Matches frontend
  last_name: string;         // ✅ Matches frontend
  email_verified: boolean;   // ✅ Matches frontend
  phone_verified: boolean;   // ✅ Matches frontend
  kyc_status: KYCStatus;     // ✅ Matches frontend
  status: UserStatus;        // ✅ Matches frontend
  // ... other fields
}
```

## API Response Structure

### Backend Response Format
```typescript
{
  success: boolean;
  message: string;
  data: {
    user: UserProfile;
    tokens?: AuthTokens;
  };
  timestamp: string;
  requestId?: string;
}
```

### Frontend API Handler
```typescript
const handleResponse = <T>(response: AxiosResponse<BackendApiResponse<T>>) => ({
  data: response.data.data,      // ✅ Correctly extracts nested data
  message: response.data.message,
  status: response.status,
});
```

## Security Implementation

### JWT Token Flow
1. **Login**: Backend generates access + refresh tokens
2. **Storage**: Frontend stores tokens in localStorage  
3. **Requests**: Access token sent in Authorization header
4. **Refresh**: Automatic token refresh on 401 responses
5. **Logout**: Token invalidation and cleanup

### Security Features
- ✅ CORS configuration for localhost development
- ✅ Helmet security headers
- ✅ Request rate limiting
- ✅ Password hashing with bcrypt
- ✅ JWT token rotation
- ✅ Session management with Redis
- ✅ Audit logging

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dwaybank_dev
DB_USER=dwaybank
DB_PASSWORD=dwaybank_secure_2024

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dwaybank_redis_2024

# JWT Secrets (32+ characters)
JWT_SECRET=dwaybank_jwt_secret_2024_development_32chars_minimum_required
JWT_REFRESH_SECRET=dwaybank_refresh_secret_2024_development_32chars_minimum_required

# Encryption (64 hex characters)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## Troubleshooting Guide

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   brew services list | grep postgresql
   # Start if needed
   brew services start postgresql
   ```

2. **Redis Connection Failed** 
   ```bash
   # Check Redis status
   brew services list | grep redis
   # Start if needed  
   brew services start redis
   ```

3. **JWT Secret Validation Error**
   - Ensure JWT secrets are at least 32 characters
   - Check .env.development file exists and is loaded

4. **CORS Errors**
   - Verify frontend URL in CORS_ORIGIN environment variable
   - Check that frontend runs on allowed ports (3000-3003)

5. **Token Refresh Issues**
   - Check Redis connection for token storage
   - Verify refresh token endpoints are working
   - Clear localStorage and re-login

### Validation Commands
```bash
# Backend health check
curl http://localhost:3004/health

# API info
curl http://localhost:3004/api

# Test registration
curl -X POST http://localhost:3004/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!","first_name":"Test","last_name":"User"}'
```

## Success Criteria

### Integration Complete When:
- ✅ User registration works end-to-end
- ✅ Login produces valid JWT tokens
- ✅ Profile data displays correctly
- ✅ Token refresh works automatically
- ✅ Authentication persists across browser refresh
- ✅ Logout clears tokens and redirects
- ✅ Error handling displays meaningful messages
- ✅ Database stores user data correctly

## Next Steps

After successful integration:
1. Enable email verification functionality
2. Implement password reset flow
3. Add MFA setup capabilities
4. Connect account management features
5. Implement transaction processing
6. Add comprehensive error monitoring

## Security Considerations

### Production Readiness Checklist
- ✅ Environment-specific configuration
- ✅ Secure password hashing (bcrypt rounds: 12)
- ✅ JWT token expiration (15m access, 7d refresh)
- ✅ Rate limiting on authentication endpoints
- ✅ Request logging and audit trails
- ✅ SQL injection prevention with parameterized queries
- ✅ CORS configuration for allowed origins
- ✅ Security headers via Helmet
- ✅ Session management with Redis

### Monitoring & Observability
- ✅ Structured logging with Winston
- ✅ Performance monitoring with response times
- ✅ Health check endpoints
- ✅ Database connection monitoring
- ✅ Error tracking and alerting ready