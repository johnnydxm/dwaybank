# TaskMaster Foundation Layer - Detailed Task Expansion (Phase 1: Months 1-2)

**Based on Complexity Analysis & DwayBank Technical Architecture**

---

## Task 1: User Authentication System with MFA and KYC

### Overview
- **Complexity Score**: 7.5/10
- **Estimated Effort**: 120 person-hours (3 weeks, 2 developers)
- **Risk Level**: Medium-High
- **Dependencies**: Database schema, KYC provider selection
- **Technology Stack**: Node.js, TypeScript, PostgreSQL, Redis, OAuth 2.0, JWT

### Detailed Implementation Subtasks

#### 1.1 OAuth 2.0 + OpenID Connect Foundation (24 hours)
**Responsible**: Senior Backend Developer
**Duration**: 3 days

**Subtasks**:
- Set up Passport.js with OAuth 2.0 strategy (8h)
- Implement JWT token generation with RS256 signing (6h)
- Create refresh token rotation mechanism (6h)
- Build session management with Redis (4h)

**Technical Specifications**:
```typescript
interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string[];
}

interface UserSession {
  user_id: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
}
```

**Acceptance Criteria**:
- JWT tokens expire in 15 minutes
- Refresh tokens rotate on each use
- Session data stored in Redis with TTL
- Support for multiple concurrent sessions per user

#### 1.2 Multi-Factor Authentication (MFA) (32 hours)
**Responsible**: Mid-Level Backend Developer + Senior Developer (Code Review)
**Duration**: 4 days

**Subtasks**:
- TOTP (Time-based One-Time Password) implementation (12h)
- SMS verification via Twilio integration (8h)
- Email verification backup method (6h)
- Biometric authentication preparation (mobile) (6h)

**Technology Integration**:
- **TOTP**: `otplib` library for Google Authenticator compatibility
- **SMS**: Twilio API integration
- **Email**: SendGrid/AWS SES integration
- **Biometric**: TouchID/FaceID via React Native libraries

**Security Requirements**:
```typescript
interface MFAConfig {
  method: 'totp' | 'sms' | 'email' | 'biometric';
  is_primary: boolean;
  backup_codes: string[]; // 10 single-use backup codes
  created_at: Date;
  last_used: Date;
}

interface MFAVerification {
  user_id: string;
  method: string;
  code: string;
  expires_at: Date;
  attempts: number;
  max_attempts: 3;
}
```

#### 1.3 KYC/AML Identity Verification (40 hours)
**Responsible**: Senior Backend Developer
**Duration**: 5 days

**Subtasks**:
- Jumio SDK integration for document verification (16h)
- Identity document processing workflow (12h)
- Address verification system (8h)
- Risk scoring integration (4h)

**KYC Workflow Implementation**:
```typescript
interface KYCRequest {
  user_id: string;
  document_type: 'passport' | 'drivers_license' | 'national_id';
  document_front: string; // base64 encoded image
  document_back?: string;
  selfie_image: string;
  address_proof?: string;
}

interface KYCResult {
  verification_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'requires_review';
  confidence_score: number;
  extracted_data: {
    full_name: string;
    date_of_birth: string;
    document_number: string;
    address: Address;
  };
  risk_flags: string[];
}
```

**Compliance Requirements**:
- GDPR compliant document storage (encrypted)
- AML screening against OFAC sanctions lists
- Identity verification confidence >95%
- Document fraud detection enabled

#### 1.4 User Profile & Preferences Management (16 hours)
**Responsible**: Mid-Level Backend Developer
**Duration**: 2 days

**Subtasks**:
- User profile CRUD operations (8h)
- Preference management system (4h)
- Privacy settings implementation (4h)

**Database Schema**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    kyc_status VARCHAR(20) DEFAULT 'pending',
    risk_profile JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL,
    secret_key VARCHAR(255),
    backup_codes TEXT[],
    is_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 1.5 Security Hardening & Rate Limiting (8 hours)
**Responsible**: Senior Backend Developer
**Duration**: 1 day

**Subtasks**:
- Implement rate limiting for auth endpoints (4h)
- Add security headers and CORS configuration (2h)
- Set up audit logging for all auth events (2h)

**Rate Limiting Configuration**:
```typescript
const authRateLimits = {
  login: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  register: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 registrations per hour
  mfa_verify: { windowMs: 5 * 60 * 1000, max: 10 }, // 10 attempts per 5 minutes
  password_reset: { windowMs: 60 * 60 * 1000, max: 3 } // 3 resets per hour
};
```

### Resource Requirements

#### Human Resources
- **Senior Backend Developer** (1 FTE): 40 hours
- **Mid-Level Backend Developer** (1 FTE): 48 hours
- **Security Consultant** (0.2 FTE): 8 hours (architecture review)
- **DevOps Engineer** (0.3 FTE): 12 hours (deployment setup)
- **QA Engineer** (0.5 FTE): 20 hours (testing)

#### Infrastructure Requirements
- **Development Environment**: AWS EKS cluster with 2 nodes
- **Database**: PostgreSQL 14+ with encrypted storage
- **Cache**: Redis 7+ for session management
- **External Services**: 
  - Jumio KYC API ($0.50 per verification)
  - Twilio SMS API ($0.0075 per message)
  - SendGrid email ($0.0001 per email)

#### Third-Party Integrations
- **Jumio**: Document verification and KYC compliance
- **Twilio**: SMS verification for MFA
- **SendGrid**: Email verification and notifications
- **Auth0** (optional fallback): Managed authentication service

### Testing & Validation Requirements

#### Unit Testing (16 hours)
- JWT token generation and validation tests
- MFA code generation and verification tests
- KYC workflow unit tests
- Rate limiting functionality tests
- **Target Coverage**: 90% code coverage

#### Integration Testing (12 hours)
- End-to-end authentication flow testing
- KYC provider integration testing
- MFA provider integration testing
- Database integration testing

#### Security Testing (8 hours)
- Penetration testing for auth endpoints
- OWASP Top 10 vulnerability scanning
- Token security and expiration testing
- Rate limiting bypass attempt testing

### Risk Mitigation Strategies

#### High-Risk Areas & Mitigations

**1. KYC Provider Dependency (Risk: 8/10)**
- **Mitigation**: Implement fallback to manual review process
- **Backup Plan**: Secondary KYC provider (Onfido) integration ready
- **Monitoring**: KYC provider uptime and response time alerts

**2. Token Security Vulnerabilities (Risk: 9/10)**
- **Mitigation**: Use RS256 signing with key rotation
- **Backup Plan**: Emergency token revocation system
- **Monitoring**: Suspicious token usage pattern detection

**3. MFA Bypass Attacks (Risk: 7/10)**
- **Mitigation**: Multiple MFA methods with backup codes
- **Backup Plan**: Account lockout and manual recovery process
- **Monitoring**: Failed MFA attempt rate monitoring

#### Security Controls
```typescript
const securityControls = {
  password_policy: {
    min_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: true,
    prevent_common_passwords: true
  },
  account_lockout: {
    failed_attempts_threshold: 5,
    lockout_duration_minutes: 30,
    progressive_delays: true
  },
  session_security: {
    secure_cookies: true,
    http_only: true,
    same_site: 'strict',
    session_timeout_minutes: 15
  }
};
```

### Acceptance Criteria & Quality Gates

#### Functional Requirements
- [ ] Users can register with email and password
- [ ] Email verification required before account activation
- [ ] KYC verification completed within 24 hours (95% SLA)
- [ ] MFA setup required for all users
- [ ] Support for TOTP, SMS, and email MFA methods
- [ ] Secure password reset functionality
- [ ] OAuth 2.0 compliant token management

#### Non-Functional Requirements
- [ ] Authentication response time <200ms (95th percentile)
- [ ] KYC verification accuracy >95%
- [ ] System uptime >99.5%
- [ ] Rate limiting prevents brute force attacks
- [ ] All auth events logged for audit compliance
- [ ] GDPR compliant data handling

#### Security Requirements
- [ ] PCI DSS Level 2 compliance for sensitive data
- [ ] AES-256 encryption for data at rest
- [ ] TLS 1.3 for data in transit
- [ ] Regular security audit compliance
- [ ] Vulnerability scan results with 0 critical issues

---

## Task 2: Database Schema and Core Data Models

### Overview
- **Complexity Score**: 6.8/10
- **Estimated Effort**: 80 person-hours (2 weeks, 1 senior + 1 mid developer)
- **Risk Level**: Medium
- **Dependencies**: Requirements finalization, data modeling workshops
- **Technology Stack**: PostgreSQL 14+, Liquibase, Redis, Event Sourcing

### Detailed Implementation Subtasks

#### 2.1 Core Database Architecture Setup (16 hours)
**Responsible**: Senior Database Developer
**Duration**: 2 days

**Subtasks**:
- PostgreSQL 14+ cluster setup with replication (8h)
- Database connection pooling configuration (4h)
- Backup and recovery strategy implementation (4h)

**Database Configuration**:
```sql
-- PostgreSQL configuration for financial applications
-- postgresql.conf optimizations
shared_buffers = '256MB'
effective_cache_size = '1GB'
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

-- Enable row-level security for multi-tenancy
ALTER DATABASE dwaybank SET row_security = on;
```

#### 2.2 User & Authentication Schema (12 hours)
**Responsible**: Mid-Level Database Developer
**Duration**: 1.5 days

**Core User Tables**:
```sql
-- Users table with KYC and risk profile
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected', 'under_review')),
    kyc_data JSONB,
    risk_profile JSONB DEFAULT '{"level": "medium", "score": 50}',
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    email_verified_at TIMESTAMP,
    phone_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Multi-factor authentication
CREATE TABLE user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email', 'biometric')),
    secret_key VARCHAR(255),
    backup_codes TEXT[],
    phone_number VARCHAR(20),
    email_address VARCHAR(255),
    is_enabled BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, method)
);

-- User sessions for security tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    location JSONB,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.3 Wallet & Payment Method Schema (20 hours)
**Responsible**: Senior Database Developer
**Duration**: 2.5 days

**Wallet Integration Tables**:
```sql
-- Connected wallets and payment methods
CREATE TABLE connected_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN ('apple_pay', 'google_pay', 'metamask', 'manual_card', 'bank_account')),
    external_id VARCHAR(255), -- external wallet/card identifier
    encrypted_credentials TEXT, -- encrypted connection credentials
    display_name VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    balance_cache DECIMAL(18,8),
    balance_updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet balances (real-time and historical)
CREATE TABLE wallet_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES connected_wallets(id) ON DELETE CASCADE,
    balance DECIMAL(18,8) NOT NULL,
    available_balance DECIMAL(18,8),
    currency VARCHAR(10) NOT NULL,
    balance_type VARCHAR(20) DEFAULT 'current' CHECK (balance_type IN ('current', 'available', 'pending')),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Card information (PCI DSS compliant)
CREATE TABLE payment_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES connected_wallets(id) ON DELETE CASCADE,
    card_token VARCHAR(255) NOT NULL, -- tokenized card number
    last_four CHAR(4) NOT NULL,
    card_brand VARCHAR(20),
    expiry_month INTEGER,
    expiry_year INTEGER,
    cardholder_name VARCHAR(100),
    billing_address JSONB,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.4 Transaction & Ledger Schema (24 hours)
**Responsible**: Senior Database Developer + Blnk Integration Specialist
**Duration**: 3 days

**Transaction Recording Tables**:
```sql
-- Transaction records
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    wallet_id UUID REFERENCES connected_wallets(id),
    blnk_transaction_id UUID, -- reference to Blnk ledger
    external_transaction_id VARCHAR(255), -- external system reference
    amount DECIMAL(18,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('spend', 'receive', 'transfer', 'fee', 'refund')),
    category VARCHAR(50),
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    compliance_status VARCHAR(20) DEFAULT 'approved' CHECK (compliance_status IN ('approved', 'flagged', 'blocked', 'under_review')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for transaction queries
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_amount ON transactions(amount);

-- Transaction history partitioning for performance
CREATE TABLE transactions_archive (
    LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Monthly partitions for transaction history
CREATE TABLE transactions_2025_01 PARTITION OF transactions_archive
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### 2.5 Risk & Compliance Schema (12 hours)
**Responsible**: Mid-Level Database Developer
**Duration**: 1.5 days

**Risk Management Tables**:
```sql
-- Risk profiles and scoring
CREATE TABLE user_risk_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score INTEGER DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors JSONB DEFAULT '{}',
    spending_limits JSONB DEFAULT '{"daily": 5000, "weekly": 15000, "monthly": 50000}',
    geographic_restrictions JSONB DEFAULT '{}',
    merchant_restrictions JSONB DEFAULT '{}',
    last_assessment_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Compliance and AML records
CREATE TABLE compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    transaction_id UUID REFERENCES transactions(id),
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('aml', 'kyc', 'sanctions', 'pep', 'fraud')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'flagged', 'manual_review')),
    score INTEGER,
    details JSONB,
    external_reference VARCHAR(255),
    checked_at TIMESTAMP DEFAULT NOW()
);

-- Audit trail for all changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.6 Event Sourcing & Analytics Schema (16 hours)
**Responsible**: Senior Database Developer
**Duration**: 2 days

**Event Store Implementation**:
```sql
-- Event sourcing for audit and replay capability
CREATE TABLE event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    event_metadata JSONB DEFAULT '{}',
    version INTEGER NOT NULL,
    sequence_number BIGSERIAL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(aggregate_id, version)
);

-- Indexes for event sourcing queries
CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_id, version);
CREATE INDEX idx_event_store_type ON event_store(aggregate_type, event_type);
CREATE INDEX idx_event_store_sequence ON event_store(sequence_number);

-- Snapshots for performance optimization
CREATE TABLE event_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL UNIQUE,
    aggregate_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics and reporting tables
CREATE TABLE daily_user_stats (
    date DATE NOT NULL,
    user_id UUID REFERENCES users(id),
    total_transactions INTEGER DEFAULT 0,
    total_amount DECIMAL(18,8) DEFAULT 0,
    average_transaction DECIMAL(18,8) DEFAULT 0,
    unique_merchants INTEGER DEFAULT 0,
    risk_incidents INTEGER DEFAULT 0,
    PRIMARY KEY (date, user_id)
);
```

### Resource Requirements

#### Human Resources
- **Senior Database Developer** (1 FTE): 48 hours
- **Mid-Level Database Developer** (1 FTE): 32 hours
- **Data Architect** (0.3 FTE): 8 hours (schema review)
- **Security Specialist** (0.2 FTE): 4 hours (security review)

#### Infrastructure Requirements
- **Primary Database**: PostgreSQL 14+ (4 vCPU, 16GB RAM)
- **Read Replicas**: 2 instances for query distribution
- **Backup Storage**: S3 with 30-day retention
- **Monitoring**: PostgreSQL metrics and performance monitoring

### Testing & Validation Requirements

#### Data Integrity Testing (12 hours)
- Foreign key constraint validation
- Data type and check constraint testing
- Unique constraint verification
- Index performance validation

#### Performance Testing (8 hours)
- Query performance benchmarking
- Index effectiveness testing
- Connection pooling validation
- Replication lag monitoring

#### Security Testing (4 hours)
- Row-level security testing
- Encryption at rest validation
- Access control verification
- Audit trail completeness

### Risk Mitigation Strategies

**1. Data Loss Prevention (Risk: 9/10)**
- **Mitigation**: Automated backups every 15 minutes
- **Backup Plan**: Point-in-time recovery capability
- **Monitoring**: Backup success/failure alerts

**2. Performance Degradation (Risk: 6/10)**
- **Mitigation**: Read replicas and query optimization
- **Backup Plan**: Emergency database scaling procedures
- **Monitoring**: Query performance and slow query alerts

**3. Schema Evolution Complexity (Risk: 7/10)**
- **Mitigation**: Liquibase migration management
- **Backup Plan**: Database rollback procedures
- **Monitoring**: Migration success tracking

### Acceptance Criteria & Quality Gates

#### Functional Requirements
- [ ] All core entities properly modeled with relationships
- [ ] ACID compliance for all financial transactions
- [ ] Event sourcing enabled for audit requirements
- [ ] Multi-tenancy support with row-level security
- [ ] Comprehensive audit logging

#### Performance Requirements
- [ ] Query response time <100ms for balance queries
- [ ] Support for 1,000 concurrent database connections
- [ ] Read replica lag <1 second
- [ ] Backup completion time <30 minutes

#### Security Requirements
- [ ] All sensitive data encrypted at rest
- [ ] Row-level security policies implemented
- [ ] Audit trail for all data modifications
- [ ] PCI DSS compliance for card data

---

## Task 3: API Gateway with Security and Load Balancing

### Overview
- **Complexity Score**: 7.2/10
- **Estimated Effort**: 100 person-hours (2.5 weeks, 1 senior developer)
- **Risk Level**: Medium-High
- **Dependencies**: Authentication system, service definitions
- **Technology Stack**: Kong Gateway, Nginx, Node.js, Redis, JWT

### Detailed Implementation Subtasks

#### 3.1 Kong API Gateway Setup & Configuration (24 hours)
**Responsible**: Senior DevOps/Backend Developer
**Duration**: 3 days

**Subtasks**:
- Kong Gateway installation and clustering (8h)
- Database setup for Kong (PostgreSQL) (4h)
- Admin API and Kong Manager configuration (6h)
- SSL/TLS certificate management (6h)

**Kong Configuration**:
```yaml
# kong.yml - Declarative configuration
_format_version: "3.0"

services:
  - name: user-service
    url: http://user-service:3001
    plugins:
      - name: jwt
        config:
          key_claim_name: iss
      - name: rate-limiting
        config:
          minute: 100
          hour: 1000
    routes:
      - name: user-routes
        paths:
          - /api/v1/users
          - /api/v1/auth

  - name: wallet-service
    url: http://wallet-service:3002
    plugins:
      - name: jwt
      - name: rate-limiting
        config:
          minute: 200
          hour: 2000
    routes:
      - name: wallet-routes
        paths:
          - /api/v1/wallets
          - /api/v1/balances
```

#### 3.2 Authentication & Authorization Middleware (20 hours)
**Responsible**: Senior Backend Developer
**Duration**: 2.5 days

**JWT Authentication Plugin**:
```typescript
// Custom Kong plugin for enhanced JWT validation
export class JWTAuthPlugin {
  async execute(context: KongPluginContext) {
    const token = this.extractToken(context.request);
    
    if (!token) {
      return context.response.unauthorized('Missing authentication token');
    }
    
    try {
      const payload = await this.validateJWT(token);
      
      // Add user context to request
      context.request.headers['X-User-ID'] = payload.sub;
      context.request.headers['X-User-Role'] = payload.role;
      context.request.headers['X-KYC-Status'] = payload.kyc_status;
      
      // Check if MFA is required for this endpoint
      if (this.requiresMFA(context.request.path)) {
        await this.validateMFA(payload.sub, context.request);
      }
      
      return context.next();
    } catch (error) {
      return context.response.forbidden('Invalid or expired token');
    }
  }
  
  private requiresMFA(path: string): boolean {
    const mfaRequiredPaths = [
      '/api/v1/transfers',
      '/api/v1/wallets/connect',
      '/api/v1/users/profile/update'
    ];
    return mfaRequiredPaths.some(p => path.startsWith(p));
  }
}
```

#### 3.3 Rate Limiting & Throttling (16 hours)
**Responsible**: Senior Backend Developer
**Duration**: 2 days

**Advanced Rate Limiting Strategy**:
```typescript
interface RateLimitConfig {
  endpoint: string;
  limits: {
    per_minute: number;
    per_hour: number;
    per_day: number;
  };
  user_tier_multipliers: {
    basic: number;
    premium: number;
    enterprise: number;
  };
}

const rateLimitConfigs: RateLimitConfig[] = [
  {
    endpoint: '/api/v1/auth/login',
    limits: { per_minute: 5, per_hour: 20, per_day: 100 },
    user_tier_multipliers: { basic: 1, premium: 1, enterprise: 1 }
  },
  {
    endpoint: '/api/v1/wallets/balance',
    limits: { per_minute: 60, per_hour: 500, per_day: 2000 },
    user_tier_multipliers: { basic: 1, premium: 2, enterprise: 5 }
  },
  {
    endpoint: '/api/v1/transfers',
    limits: { per_minute: 10, per_hour: 100, per_day: 500 },
    user_tier_multipliers: { basic: 1, premium: 1.5, enterprise: 3 }
  }
];

// Redis-based distributed rate limiting
class DistributedRateLimiter {
  constructor(private redis: Redis) {}
  
  async checkLimit(
    key: string, 
    limit: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `rate_limit:${key}:${window}`;
    
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count)
    };
  }
}
```

#### 3.4 Load Balancing & Health Checks (16 hours)
**Responsible**: DevOps Engineer
**Duration**: 2 days

**Upstream Service Configuration**:
```yaml
# Kong upstream configuration
upstreams:
  - name: user-service-upstream
    algorithm: round-robin
    healthchecks:
      active:
        http_path: /health
        healthy:
          interval: 5
          successes: 3
        unhealthy:
          interval: 5
          tcp_failures: 3
          http_failures: 3
    targets:
      - target: user-service-1:3001
        weight: 100
      - target: user-service-2:3001
        weight: 100
      - target: user-service-3:3001
        weight: 100

  - name: wallet-service-upstream
    algorithm: least-connections
    healthchecks:
      active:
        http_path: /health
        timeout: 3
    targets:
      - target: wallet-service-1:3002
      - target: wallet-service-2:3002
```

**Health Check Implementation**:
```typescript
// Service health check endpoint
app.get('/health', async (req, res) => {
  const healthChecks = await Promise.allSettled([
    this.checkDatabase(),
    this.checkRedis(),
    this.checkExternalAPIs(),
    this.checkMemoryUsage(),
    this.checkCPUUsage()
  ]);
  
  const healthy = healthChecks.every(
    check => check.status === 'fulfilled' && check.value.healthy
  );
  
  const status = healthy ? 200 : 503;
  const response = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: healthChecks.map((check, index) => ({
      name: ['database', 'redis', 'external_apis', 'memory', 'cpu'][index],
      status: check.status,
      details: check.status === 'fulfilled' ? check.value : check.reason
    }))
  };
  
  res.status(status).json(response);
});
```

#### 3.5 API Documentation & Monitoring (12 hours)
**Responsible**: Senior Backend Developer
**Duration**: 1.5 days

**OpenAPI Specification**:
```yaml
openapi: 3.0.3
info:
  title: DwayBank Smart Wallet API
  version: 1.0.0
  description: Unified financial management platform API
  
servers:
  - url: https://api.dwaybank.com/v1
    description: Production server
  - url: https://staging-api.dwaybank.com/v1
    description: Staging server

paths:
  /auth/login:
    post:
      summary: User authentication
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 12
                mfa_code:
                  type: string
                  pattern: '^[0-9]{6}$'
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: Invalid credentials
        '429':
          description: Rate limit exceeded
```

**API Monitoring Setup**:
```typescript
// Prometheus metrics for Kong
const prometheusMetrics = {
  http_requests_total: new promClient.Counter({
    name: 'kong_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['service', 'route', 'method', 'status']
  }),
  
  http_request_duration: new promClient.Histogram({
    name: 'kong_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['service', 'route', 'method'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  }),
  
  rate_limit_exceeded: new promClient.Counter({
    name: 'kong_rate_limit_exceeded_total',
    help: 'Total number of rate limit violations',
    labelNames: ['service', 'consumer']
  })
};
```

#### 3.6 Security Hardening & Compliance (12 hours)
**Responsible**: Security Engineer + Senior Developer
**Duration**: 1.5 days

**Security Configuration**:
```typescript
// Kong security plugins configuration
const securityPlugins = {
  // CORS configuration
  cors: {
    origins: ['https://dwaybank.com', 'https://app.dwaybank.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type', 'X-Request-ID'],
    credentials: true,
    max_age: 3600
  },
  
  // IP restriction for admin endpoints
  ip_restriction: {
    allow: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    deny: []
  },
  
  // Request size limiting
  request_size_limiting: {
    allowed_payload_size: 128 // KB
  },
  
  // Bot detection
  bot_detection: {
    whitelist: [],
    blacklist: ['curl', 'wget', 'python-requests']
  }
};

// Security headers middleware
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

### Resource Requirements

#### Human Resources
- **Senior DevOps/Backend Developer** (1 FTE): 60 hours
- **DevOps Engineer** (0.5 FTE): 20 hours
- **Security Engineer** (0.3 FTE): 12 hours
- **QA Engineer** (0.2 FTE): 8 hours

#### Infrastructure Requirements
- **Kong Gateway Cluster**: 3 nodes (2 vCPU, 4GB RAM each)
- **Kong Database**: PostgreSQL instance (2 vCPU, 8GB RAM)
- **Load Balancer**: AWS ALB or similar
- **SSL Certificates**: Wildcard certificate for *.dwaybank.com

### Testing & Validation Requirements

#### Load Testing (16 hours)
- Concurrent user simulation (1,000+ users)
- Rate limiting validation under load
- Failover testing for upstream services
- SSL/TLS termination performance testing

#### Security Testing (12 hours)
- OWASP API Security Top 10 testing
- JWT token manipulation attempts
- Rate limiting bypass testing
- DDoS protection validation

#### Integration Testing (8 hours)
- End-to-end API flow testing
- Service discovery and routing validation
- Health check and failover testing
- Monitoring and alerting validation

### Risk Mitigation Strategies

**1. Single Point of Failure (Risk: 8/10)**
- **Mitigation**: Kong clustering with 3+ nodes
- **Backup Plan**: Nginx fallback configuration
- **Monitoring**: Gateway health and availability alerts

**2. Performance Bottlenecks (Risk: 7/10)**
- **Mitigation**: Horizontal scaling and load balancing
- **Backup Plan**: Circuit breaker patterns
- **Monitoring**: Response time and throughput metrics

**3. Security Vulnerabilities (Risk: 9/10)**
- **Mitigation**: Regular security audits and updates
- **Backup Plan**: WAF integration and DDoS protection
- **Monitoring**: Security event logging and alerting

### Acceptance Criteria & Quality Gates

#### Functional Requirements
- [ ] All microservices accessible through single gateway
- [ ] JWT authentication enforced on protected endpoints
- [ ] Rate limiting prevents abuse and ensures fair usage
- [ ] Load balancing distributes traffic evenly
- [ ] Health checks ensure service availability

#### Performance Requirements
- [ ] Gateway response time <50ms overhead
- [ ] Support for 1,000 concurrent connections
- [ ] 99.9% uptime with automatic failover
- [ ] Rate limiting accuracy >99%

#### Security Requirements
- [ ] All traffic encrypted with TLS 1.3
- [ ] Security headers properly configured
- [ ] IP whitelisting for admin functions
- [ ] Comprehensive audit logging enabled

---

## Task 4: Blnk Ledger Integration for Transaction Recording

### Overview
- **Complexity Score**: 8.0/10
- **Estimated Effort**: 140 person-hours (3.5 weeks, 1 senior + 1 mid developer)
- **Risk Level**: High
- **Dependencies**: Database schema, API gateway, Go expertise requirement
- **Technology Stack**: Go, Blnk Ledger, PostgreSQL, gRPC, Docker

### Detailed Implementation Subtasks

#### 4.1 Blnk Ledger Setup & Configuration (32 hours)
**Responsible**: Senior Go Developer
**Duration**: 4 days

**Subtasks**:
- Blnk ledger server deployment and configuration (12h)
- PostgreSQL database setup for Blnk (8h)
- Multi-currency support configuration (8h)
- Docker containerization and orchestration (4h)

**Blnk Configuration**:
```yaml
# blnk-config.yml
server:
  port: 5001
  host: "0.0.0.0"
  
database:
  dns: "postgres://blnk_user:password@postgres:5432/blnk_ledger?sslmode=require"
  migration: true
  
ledger:
  precision: 8  # 8 decimal places for crypto compatibility
  currencies:
    - USD
    - EUR
    - GBP
    - BTC
    - ETH
    - USDC
    
webhook:
  url: "https://api.dwaybank.com/v1/webhooks/blnk"
  secret: "${WEBHOOK_SECRET}"
  
monitoring:
  enabled: true
  prometheus_port: 9090
```

**Docker Compose Configuration**:
```yaml
# docker-compose.blnk.yml
version: '3.8'
services:
  blnk-ledger:
    image: blnk/ledger:latest
    ports:
      - "5001:5001"
      - "9090:9090"
    environment:
      - DATABASE_URL=${BLNK_DATABASE_URL}
      - WEBHOOK_SECRET=${BLNK_WEBHOOK_SECRET}
    volumes:
      - ./blnk-config.yml:/config/blnk.yml
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=blnk_ledger
      - POSTGRES_USER=blnk_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - blnk_postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
      
volumes:
  blnk_postgres_data:
```

#### 4.2 Ledger Structure & Account Hierarchy (24 hours)
**Responsible**: Senior Go Developer
**Duration**: 3 days

**Account Hierarchy Design**:
```go
// Account structure for DwayBank
type AccountHierarchy struct {
    Organization  string `json:"organization"`  // "dwaybank"
    UserAccounts  []UserAccount `json:"user_accounts"`
    SystemAccounts []SystemAccount `json:"system_accounts"`
}

type UserAccount struct {
    UserID        string `json:"user_id"`
    MainLedger    string `json:"main_ledger"`    // User's main ledger
    WalletBalances []WalletBalance `json:"wallet_balances"`
}

type WalletBalance struct {
    WalletID      string `json:"wallet_id"`
    BalanceID     string `json:"balance_id"`
    Currency      string `json:"currency"`
    WalletType    string `json:"wallet_type"`   // apple_pay, google_pay, etc.
}

type SystemAccount struct {
    Name          string `json:"name"`
    Purpose       string `json:"purpose"`
    BalanceID     string `json:"balance_id"`
    Currency      string `json:"currency"`
}
```

**Ledger Initialization Script**:
```go
package main

import (
    "context"
    "fmt"
    "github.com/jerry-enebeli/blnk/api/model"
    blnk "github.com/jerry-enebeli/blnk/clients/go"
)

func initializeDwayBankLedgers(client *blnk.Client) error {
    ctx := context.Background()
    
    // Create organization ledger
    orgLedger := &model.CreateLedger{
        Name:        "DwayBank Main Ledger",
        MetaData: map[string]interface{}{
            "organization": "dwaybank",
            "type":        "main",
            "created_by":  "system",
        },
    }
    
    mainLedger, err := client.CreateLedger(ctx, orgLedger)
    if err != nil {
        return fmt.Errorf("failed to create main ledger: %w", err)
    }
    
    // Create system accounts
    systemAccounts := []model.CreateBalance{
        {
            LedgerID: mainLedger.LedgerId,
            Currency: "USD",
            MetaData: map[string]interface{}{
                "account_type": "fees",
                "description":  "Transaction fees collection",
            },
        },
        {
            LedgerID: mainLedger.LedgerId,
            Currency: "USD",
            MetaData: map[string]interface{}{
                "account_type": "reserves",
                "description":  "Operational reserves",
            },
        },
        {
            LedgerID: mainLedger.LedgerId,
            Currency: "USD",
            MetaData: map[string]interface{}{
                "account_type": "suspense",
                "description":  "Suspense account for pending transactions",
            },
        },
    }
    
    for _, account := range systemAccounts {
        _, err := client.CreateBalance(ctx, &account)
        if err != nil {
            return fmt.Errorf("failed to create system account: %w", err)
        }
    }
    
    return nil
}
```

#### 4.3 Transaction Recording Service (36 hours)
**Responsible**: Senior Go Developer + Mid-Level Developer
**Duration**: 4.5 days

**Transaction Service Implementation**:
```go
package transaction

import (
    "context"
    "fmt"
    "github.com/google/uuid"
    blnk "github.com/jerry-enebeli/blnk/clients/go"
    "github.com/jerry-enebeli/blnk/api/model"
    "time"
)

type TransactionService struct {
    blnkClient    *blnk.Client
    dbConnection  *sql.DB
    webhookSigner *WebhookSigner
}

type DwayBankTransaction struct {
    ID              string                 `json:"id"`
    UserID          string                 `json:"user_id"`
    WalletID        string                 `json:"wallet_id"`
    Amount          int64                  `json:"amount"`          // In cents/satoshis
    Currency        string                 `json:"currency"`
    TransactionType TransactionType        `json:"transaction_type"`
    Description     string                 `json:"description"`
    Metadata        map[string]interface{} `json:"metadata"`
    RiskScore       int                    `json:"risk_score"`
    Status          TransactionStatus      `json:"status"`
    CreatedAt       time.Time              `json:"created_at"`
}

type TransactionType string

const (
    TransactionTypeSpend    TransactionType = "spend"
    TransactionTypeReceive  TransactionType = "receive"
    TransactionTypeTransfer TransactionType = "transfer"
    TransactionTypeFee      TransactionType = "fee"
    TransactionTypeRefund   TransactionType = "refund"
)

func (ts *TransactionService) RecordTransaction(
    ctx context.Context, 
    txn *DwayBankTransaction,
) (*model.Transaction, error) {
    // Pre-transaction validation
    if err := ts.validateTransaction(txn); err != nil {
        return nil, fmt.Errorf("transaction validation failed: %w", err)
    }
    
    // Get user's balance for the wallet
    userBalance, err := ts.getUserWalletBalance(ctx, txn.UserID, txn.WalletID, txn.Currency)
    if err != nil {
        return nil, fmt.Errorf("failed to get user balance: %w", err)
    }
    
    // Create Blnk transaction based on type
    var blnkTxn *model.CreateTransaction
    
    switch txn.TransactionType {
    case TransactionTypeSpend:
        blnkTxn = ts.createSpendTransaction(userBalance.BalanceId, txn)
    case TransactionTypeReceive:
        blnkTxn = ts.createReceiveTransaction(userBalance.BalanceId, txn)
    case TransactionTypeTransfer:
        blnkTxn = ts.createTransferTransaction(userBalance.BalanceId, txn)
    case TransactionTypeFee:
        blnkTxn = ts.createFeeTransaction(userBalance.BalanceId, txn)
    default:
        return nil, fmt.Errorf("unsupported transaction type: %s", txn.TransactionType)
    }
    
    // Record transaction in Blnk
    result, err := ts.blnkClient.RecordTransaction(ctx, blnkTxn)
    if err != nil {
        return nil, fmt.Errorf("failed to record transaction in Blnk: %w", err)
    }
    
    // Update transaction status in main database
    if err := ts.updateTransactionStatus(ctx, txn.ID, result.TransactionId, "completed"); err != nil {
        // Log error but don't fail - Blnk transaction succeeded
        fmt.Printf("Warning: failed to update transaction status: %v", err)
    }
    
    return result, nil
}

func (ts *TransactionService) createSpendTransaction(
    balanceID string, 
    txn *DwayBankTransaction,
) *model.CreateTransaction {
    // Get system fee account
    feeBalanceID := ts.getSystemBalance("fees", txn.Currency)
    
    return &model.CreateTransaction{
        Reference:   txn.ID,
        Amount:      txn.Amount,
        Currency:    txn.Currency,
        Description: txn.Description,
        Source:      balanceID,
        Destination: feeBalanceID, // For spend, money goes to fee account
        MetaData: map[string]interface{}{
            "user_id":          txn.UserID,
            "wallet_id":        txn.WalletID,
            "transaction_type": string(txn.TransactionType),
            "risk_score":       txn.RiskScore,
            "original_metadata": txn.Metadata,
        },
    }
}

func (ts *TransactionService) createReceiveTransaction(
    balanceID string, 
    txn *DwayBankTransaction,
) *model.CreateTransaction {
    // Get system suspense account as source
    suspenseBalanceID := ts.getSystemBalance("suspense", txn.Currency)
    
    return &model.CreateTransaction{
        Reference:   txn.ID,
        Amount:      txn.Amount,
        Currency:    txn.Currency,
        Description: txn.Description,
        Source:      suspenseBalanceID,
        Destination: balanceID,
        MetaData: map[string]interface{}{
            "user_id":          txn.UserID,
            "wallet_id":        txn.WalletID,
            "transaction_type": string(txn.TransactionType),
            "risk_score":       txn.RiskScore,
            "original_metadata": txn.Metadata,
        },
    }
}
```

#### 4.4 Balance Monitoring & Webhooks (24 hours)
**Responsible**: Mid-Level Go Developer
**Duration**: 3 days

**Balance Monitoring Implementation**:
```go
package monitoring

import (
    "context"
    "fmt"
    blnk "github.com/jerry-enebeli/blnk/clients/go"
    "github.com/jerry-enebeli/blnk/api/model"
)

type BalanceMonitor struct {
    blnkClient   *blnk.Client
    alertService *AlertService
    limits       map[string]BalanceLimits
}

type BalanceLimits struct {
    MinBalance    int64 `json:"min_balance"`
    MaxBalance    int64 `json:"max_balance"`
    DailyLimit    int64 `json:"daily_limit"`
    WeeklyLimit   int64 `json:"weekly_limit"`
    MonthlyLimit  int64 `json:"monthly_limit"`
}

func (bm *BalanceMonitor) SetupUserBalanceMonitors(
    ctx context.Context,
    userID string,
    walletID string,
    currency string,
    limits BalanceLimits,
) error {
    balanceID := fmt.Sprintf("user_%s_wallet_%s_%s", userID, walletID, currency)
    
    // Create balance monitors in Blnk
    monitors := []model.CreateBalanceMonitor{
        {
            BalanceId: balanceID,
            Field:     "balance",
            Operator:  "lt", // less than
            Value:     limits.MinBalance,
            Description: fmt.Sprintf("Minimum balance alert for %s", currency),
        },
        {
            BalanceId: balanceID,
            Field:     "balance",
            Operator:  "gt", // greater than
            Value:     limits.MaxBalance,
            Description: fmt.Sprintf("Maximum balance alert for %s", currency),
        },
        {
            BalanceId: balanceID,
            Field:     "debit",
            Operator:  "gt",
            Value:     limits.DailyLimit,
            Description: fmt.Sprintf("Daily spending limit for %s", currency),
        },
    }
    
    for _, monitor := range monitors {
        _, err := bm.blnkClient.CreateBalanceMonitor(ctx, &monitor)
        if err != nil {
            return fmt.Errorf("failed to create balance monitor: %w", err)
        }
    }
    
    return nil
}

// Webhook handler for balance alerts
func (bm *BalanceMonitor) HandleBalanceAlert(
    ctx context.Context,
    webhook *BlnkWebhook,
) error {
    switch webhook.Event {
    case "balance.monitor.triggered":
        return bm.processBalanceAlert(ctx, webhook)
    case "transaction.recorded":
        return bm.processTransactionRecorded(ctx, webhook)
    default:
        return fmt.Errorf("unknown webhook event: %s", webhook.Event)
    }
}

type BlnkWebhook struct {
    Event     string                 `json:"event"`
    Data      map[string]interface{} `json:"data"`
    Timestamp time.Time              `json:"timestamp"`
    Signature string                 `json:"signature"`
}
```

#### 4.5 Multi-Currency Support & Exchange Rates (16 hours)
**Responsible**: Mid-Level Go Developer
**Duration**: 2 days

**Currency Management**:
```go
package currency

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "sync"
    "time"
)

type CurrencyService struct {
    exchangeRates map[string]map[string]float64
    mutex         sync.RWMutex
    lastUpdate    time.Time
    httpClient    *http.Client
}

type ExchangeRateProvider interface {
    GetRates(baseCurrency string) (map[string]float64, error)
}

// CoinGecko for crypto rates, exchangerates-api for fiat
type MultiSourceRateProvider struct {
    fiatProvider   ExchangeRateProvider
    cryptoProvider ExchangeRateProvider
}

func (cs *CurrencyService) ConvertAmount(
    amount int64,
    fromCurrency string,
    toCurrency string,
) (int64, error) {
    if fromCurrency == toCurrency {
        return amount, nil
    }
    
    cs.mutex.RLock()
    defer cs.mutex.RUnlock()
    
    // Check if we have the exchange rate
    rates, exists := cs.exchangeRates[fromCurrency]
    if !exists {
        return 0, fmt.Errorf("no exchange rates available for %s", fromCurrency)
    }
    
    rate, exists := rates[toCurrency]
    if !exists {
        return 0, fmt.Errorf("no exchange rate available from %s to %s", fromCurrency, toCurrency)
    }
    
    // Convert amount (handling precision)
    convertedAmount := float64(amount) * rate
    return int64(convertedAmount), nil
}

func (cs *CurrencyService) GetSupportedCurrencies() []string {
    return []string{
        // Fiat currencies
        "USD", "EUR", "GBP", "JPY", "CAD", "AUD",
        // Cryptocurrencies
        "BTC", "ETH", "USDC", "USDT", "BNB", "ADA",
    }
}

// Periodic exchange rate updates
func (cs *CurrencyService) StartRateUpdater(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            if err := cs.updateExchangeRates(); err != nil {
                fmt.Printf("Failed to update exchange rates: %v\n", err)
            }
        case <-ctx.Done():
            return
        }
    }
}
```

#### 4.6 Error Handling & Transaction Rollback (8 hours)
**Responsible**: Senior Go Developer
**Duration**: 1 day

**Error Handling & Compensation**:
```go
package compensation

import (
    "context"
    "fmt"
    "time"
)

type TransactionCompensator struct {
    blnkClient    *blnk.Client
    dbConnection  *sql.DB
    retryAttempts int
    retryDelay    time.Duration
}

func (tc *TransactionCompensator) CompensateFailedTransaction(
    ctx context.Context,
    transactionID string,
    reason string,
) error {
    // Get original transaction details
    originalTxn, err := tc.getTransactionDetails(ctx, transactionID)
    if err != nil {
        return fmt.Errorf("failed to get transaction details: %w", err)
    }
    
    // Create compensation transaction
    compensationTxn := &model.CreateTransaction{
        Reference:   fmt.Sprintf("COMP_%s", transactionID),
        Amount:      originalTxn.Amount,
        Currency:    originalTxn.Currency,
        Description: fmt.Sprintf("Compensation for failed transaction: %s", reason),
        Source:      originalTxn.Destination, // Reverse the flow
        Destination: originalTxn.Source,
        MetaData: map[string]interface{}{
            "compensation":           true,
            "original_transaction":   transactionID,
            "compensation_reason":    reason,
            "compensation_timestamp": time.Now(),
        },
    }
    
    // Record compensation transaction with retry
    var result *model.Transaction
    for attempt := 1; attempt <= tc.retryAttempts; attempt++ {
        result, err = tc.blnkClient.RecordTransaction(ctx, compensationTxn)
        if err == nil {
            break
        }
        
        if attempt < tc.retryAttempts {
            time.Sleep(tc.retryDelay * time.Duration(attempt))
        }
    }
    
    if err != nil {
        return fmt.Errorf("failed to record compensation transaction after %d attempts: %w", 
            tc.retryAttempts, err)
    }
    
    // Update transaction status
    return tc.updateTransactionStatus(ctx, transactionID, "compensated", reason)
}

// Circuit breaker for Blnk service
type BlnkCircuitBreaker struct {
    maxFailures   int
    resetTimeout  time.Duration
    failures      int
    lastFailTime  time.Time
    state         CircuitState
    mutex         sync.RWMutex
}

type CircuitState int

const (
    CircuitClosed CircuitState = iota
    CircuitOpen
    CircuitHalfOpen
)

func (cb *BlnkCircuitBreaker) Call(operation func() error) error {
    cb.mutex.RLock()
    state := cb.state
    cb.mutex.RUnlock()
    
    if state == CircuitOpen {
        if time.Since(cb.lastFailTime) > cb.resetTimeout {
            cb.setState(CircuitHalfOpen)
        } else {
            return fmt.Errorf("circuit breaker is open")
        }
    }
    
    err := operation()
    
    cb.mutex.Lock()
    defer cb.mutex.Unlock()
    
    if err != nil {
        cb.failures++
        cb.lastFailTime = time.Now()
        
        if cb.failures >= cb.maxFailures {
            cb.state = CircuitOpen
        }
        return err
    }
    
    // Success - reset circuit
    cb.failures = 0
    cb.state = CircuitClosed
    return nil
}
```

### Resource Requirements

#### Human Resources
- **Senior Go Developer** (1 FTE): 80 hours
- **Mid-Level Go Developer** (1 FTE): 60 hours
- **Database Specialist** (0.3 FTE): 12 hours
- **DevOps Engineer** (0.4 FTE): 16 hours

#### Infrastructure Requirements
- **Blnk Ledger Server**: 4 vCPU, 8GB RAM, SSD storage
- **PostgreSQL for Blnk**: 4 vCPU, 16GB RAM, high IOPS storage
- **Redis for Caching**: 2 vCPU, 4GB RAM
- **Monitoring Stack**: Prometheus + Grafana

#### External Dependencies
- **Exchange Rate APIs**: CoinGecko (crypto), ExchangeRates-API (fiat)
- **Webhook Services**: For real-time balance notifications
- **Time Series Database**: InfluxDB for transaction metrics

### Testing & Validation Requirements

#### Unit Testing (20 hours)
- Transaction recording logic tests
- Balance calculation validation tests
- Currency conversion accuracy tests
- Error handling and compensation tests
- **Target Coverage**: 95% for financial logic

#### Integration Testing (16 hours)
- End-to-end transaction flow testing
- Blnk ledger integration validation
- Multi-currency transaction testing
- Webhook delivery and processing tests

#### Load Testing (12 hours)
- High-volume transaction processing (1000+ TPS)
- Concurrent balance updates testing
- Database performance under load
- Memory leak and resource usage testing

#### Financial Accuracy Testing (8 hours)
- Double-entry bookkeeping validation
- Balance reconciliation testing
- Precision handling for crypto amounts
- Exchange rate calculation accuracy

### Risk Mitigation Strategies

**1. Financial Data Accuracy (Risk: 10/10)**
- **Mitigation**: Comprehensive double-entry validation and reconciliation
- **Backup Plan**: Manual balance correction procedures
- **Monitoring**: Real-time balance discrepancy alerts

**2. Blnk Service Dependency (Risk: 8/10)**
- **Mitigation**: Circuit breaker pattern and retry mechanisms
- **Backup Plan**: Fallback to direct database recording
- **Monitoring**: Service health checks and response time alerts

**3. Multi-Currency Complexity (Risk: 7/10)**
- **Mitigation**: Robust exchange rate management and validation
- **Backup Plan**: Fixed rate fallback for critical operations
- **Monitoring**: Exchange rate deviation alerts

**4. Go Expertise Requirement (Risk: 6/10)**
- **Mitigation**: Comprehensive documentation and code reviews
- **Backup Plan**: External Go consultant on retainer
- **Monitoring**: Code quality metrics and technical debt tracking

### Acceptance Criteria & Quality Gates

#### Functional Requirements
- [ ] All user transactions recorded in Blnk ledger
- [ ] Double-entry bookkeeping maintained at all times
- [ ] Multi-currency support for 10+ currencies
- [ ] Real-time balance updates and monitoring
- [ ] Comprehensive audit trail for all transactions

#### Performance Requirements
- [ ] Transaction recording latency <100ms (95th percentile)
- [ ] Support for 500+ TPS sustained throughput
- [ ] Balance query response time <50ms
- [ ] 99.9% transaction recording success rate

#### Financial Accuracy Requirements
- [ ] Zero balance discrepancies in reconciliation
- [ ] Atomic transaction processing (all or nothing)
- [ ] Precision maintained for crypto amounts (8 decimal places)
- [ ] Exchange rate accuracy within 0.1% of market rates

#### Security Requirements
- [ ] All financial data encrypted at rest and in transit
- [ ] Comprehensive audit logging for compliance
- [ ] Role-based access control for ledger operations
- [ ] Secure webhook signature validation

---

## Summary & Next Steps

### Foundation Layer Implementation Overview

The Foundation Layer represents the critical infrastructure backbone for DwayBank Smart Wallet, with four interconnected tasks that must be executed with precision and careful coordination.

### Resource Summary
- **Total Effort**: 500 person-hours across 4 tasks
- **Timeline**: 8-10 weeks with parallel execution
- **Team Size**: 6-8 developers + specialists
- **Infrastructure Cost**: ~$2,500/month during development

### Risk Management Priority
1. **Task 4 (Blnk Integration)**: Highest risk due to Go expertise and financial accuracy requirements
2. **Task 1 (Authentication)**: High risk due to security and compliance complexity
3. **Task 3 (API Gateway)**: Medium-high risk due to performance and security requirements
4. **Task 2 (Database Schema)**: Medium risk with clear mitigation strategies

### Implementation Sequence Recommendation
1. **Week 1-2**: Parallel start of Tasks 1, 2, and 3 foundation work
2. **Week 3-4**: Begin Task 4 once database schema is stable
3. **Week 5-6**: Integration testing and performance optimization
4. **Week 7-8**: End-to-end validation and security hardening

### Quality Gates Checkpoints
- **Week 2**: Architecture review and security validation
- **Week 4**: Integration testing and performance benchmarking
- **Week 6**: Load testing and failure scenario validation
- **Week 8**: Production readiness and compliance verification

This comprehensive task breakdown provides the detailed roadmap needed to execute the Foundation Layer successfully, with clear accountability, risk mitigation, and quality assurance built into every component.