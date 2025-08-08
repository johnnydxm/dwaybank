# Canadian Bank Integration Technical Specification

## Overview

This document provides detailed technical specifications for integrating DwayBank Smart Wallet with Canada's four major banks: CIBC, RBC, TD Bank, and BMO. The integration follows PCI DSS Level 1 compliance requirements and implements a unified banking adapter pattern.

---

## Integration Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DwayBank      │    │   Banking       │    │   Bank APIs     │
│   Frontend      │◄──►│   Gateway       │◄──►│   (CIBC/RBC/    │
│                 │    │   Service       │    │    TD/BMO)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────►│   Database      │◄─────────────┘
                        │   (PostgreSQL)  │
                        └─────────────────┘
```

### Banking Adapter Pattern

```typescript
interface BankAdapter {
  authenticate(credentials: BankCredentials): Promise<AuthResult>;
  getAccounts(token: string): Promise<Account[]>;
  getTransactions(accountId: string, options: QueryOptions): Promise<Transaction[]>;
  getBalance(accountId: string): Promise<Balance>;
  initiateTransfer(transfer: TransferRequest): Promise<TransferResult>;
}
```

---

## Bank-Specific Integration Details

### 1. CIBC Integration

#### API Specifications
- **Base URL**: `https://api.cibc.com/v1`
- **Authentication**: OAuth 2.0 + OpenID Connect
- **Rate Limits**: 100 requests/minute per client
- **Data Format**: JSON
- **Encryption**: TLS 1.3

#### Authentication Flow
```typescript
interface CIBCAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: 'accounts transactions payments';
  responseType: 'code';
  grantType: 'authorization_code';
}
```

#### Endpoints
```typescript
const CIBC_ENDPOINTS = {
  auth: '/oauth/authorize',
  token: '/oauth/token',
  accounts: '/accounts',
  transactions: '/accounts/{accountId}/transactions',
  balance: '/accounts/{accountId}/balance',
  payments: '/payments'
};
```

#### Account Types Mapping
```typescript
const CIBCAccountTypes = {
  'CHQ': 'CHECKING',
  'SAV': 'SAVINGS',
  'CC': 'CREDIT_CARD',
  'LOC': 'LINE_OF_CREDIT',
  'MTG': 'MORTGAGE',
  'INV': 'INVESTMENT'
};
```

#### Transaction Categorization
```typescript
interface CIBCTransactionMapping {
  merchantCategory: string;
  internalCategory: CategoryEnum;
  subCategory?: string;
  confidence: number;
}
```

### 2. RBC Integration

#### API Specifications
- **Base URL**: `https://api.rbc.com/v2`
- **Authentication**: OAuth 2.0 + mTLS
- **Rate Limits**: 150 requests/minute per client
- **Data Format**: JSON
- **Encryption**: TLS 1.3 + Certificate Pinning

#### Authentication Flow
```typescript
interface RBCAuthConfig {
  clientId: string;
  clientCertificate: string;
  privateKey: string;
  scope: 'accounts:read transactions:read payments:write';
  grantType: 'client_credentials';
}
```

#### Endpoints
```typescript
const RBC_ENDPOINTS = {
  token: '/oauth2/token',
  accounts: '/banking/accounts',
  transactions: '/banking/accounts/{accountId}/transactions',
  balance: '/banking/accounts/{accountId}/balance',
  payments: '/payments/transfers'
};
```

#### Unique Features
- Real-time transaction notifications via webhooks
- Enhanced fraud detection integration
- Investment account support with detailed holdings

### 3. TD Bank Integration

#### API Specifications
- **Base URL**: `https://api.td.com/v1`
- **Authentication**: OAuth 2.0 + JWT
- **Rate Limits**: 200 requests/minute per client
- **Data Format**: JSON + XML support
- **Encryption**: TLS 1.3

#### Authentication Flow
```typescript
interface TDAuthConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  scope: 'account-info transaction-history payment-initiation';
  tokenEndpoint: '/oauth/v2/token';
}
```

#### Endpoints
```typescript
const TD_ENDPOINTS = {
  auth: '/oauth/v2/authorize',
  token: '/oauth/v2/token',
  accounts: '/accounts',
  transactions: '/accounts/{accountId}/transactions',
  balance: '/accounts/{accountId}/current-balance',
  transfers: '/transfers'
};
```

#### Special Handling
- TD requires separate consent for each account type
- Transaction history has 18-month limitation
- Enhanced security with step-up authentication for transfers

### 4. BMO Integration

#### API Specifications
- **Base URL**: `https://api.bmo.com/v1`
- **Authentication**: OAuth 2.0 + PKCE
- **Rate Limits**: 120 requests/minute per client
- **Data Format**: JSON
- **Encryption**: TLS 1.3 + JWE

#### Authentication Flow
```typescript
interface BMOAuthConfig {
  clientId: string;
  codeVerifier: string;
  codeChallengeMethod: 'S256';
  scope: 'openid accounts transactions payments';
  audience: 'bmo-api';
}
```

#### Endpoints
```typescript
const BMO_ENDPOINTS = {
  auth: '/oauth2/authorize',
  token: '/oauth2/token',
  accounts: '/open-banking/v1/accounts',
  transactions: '/open-banking/v1/accounts/{accountId}/transactions',
  balance: '/open-banking/v1/accounts/{accountId}/balances',
  payments: '/open-banking/v1/payments'
};
```

#### Unique Features
- PKCE implementation for enhanced security
- Comprehensive merchant data with location information
- Support for recurring payment management

---

## Database Schema Extensions

### Bank Connections Table
```sql
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  bank_code VARCHAR(10) NOT NULL, -- 'CIBC', 'RBC', 'TD', 'BMO'
  connection_status VARCHAR(20) DEFAULT 'PENDING',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connection_metadata JSONB,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_user_bank UNIQUE(user_id, bank_code)
);
```

### Bank Accounts Table
```sql
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id),
  bank_account_id VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  account_subtype VARCHAR(50),
  account_name VARCHAR(255),
  currency_code CHAR(3) DEFAULT 'CAD',
  current_balance DECIMAL(15,2),
  available_balance DECIMAL(15,2),
  credit_limit DECIMAL(15,2),
  account_metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_bank_account UNIQUE(connection_id, bank_account_id)
);
```

### Bank Transactions Table
```sql
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  bank_transaction_id VARCHAR(100) NOT NULL,
  transaction_date DATE NOT NULL,
  posted_date DATE,
  amount DECIMAL(15,2) NOT NULL,
  currency_code CHAR(3) DEFAULT 'CAD',
  description TEXT,
  merchant_name VARCHAR(255),
  merchant_category VARCHAR(100),
  internal_category VARCHAR(50),
  subcategory VARCHAR(50),
  transaction_type VARCHAR(20), -- 'DEBIT', 'CREDIT'
  status VARCHAR(20) DEFAULT 'POSTED',
  location JSONB,
  transaction_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_bank_transaction UNIQUE(account_id, bank_transaction_id)
);
```

### Bank Cards Table
```sql
CREATE TABLE bank_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  bank_card_id VARCHAR(100) NOT NULL,
  card_type VARCHAR(20), -- 'DEBIT', 'CREDIT'
  card_network VARCHAR(20), -- 'VISA', 'MASTERCARD', 'AMEX'
  last_four_digits CHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  card_holder_name VARCHAR(255),
  credit_limit DECIMAL(15,2),
  available_credit DECIMAL(15,2),
  rewards_program VARCHAR(100),
  card_status VARCHAR(20) DEFAULT 'ACTIVE',
  card_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_bank_card UNIQUE(account_id, bank_card_id)
);
```

### Transfer History Table
```sql
CREATE TABLE transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  from_account_id UUID REFERENCES bank_accounts(id),
  to_account_id UUID REFERENCES bank_accounts(id),
  transfer_type VARCHAR(20), -- 'INTERNAL', 'EXTERNAL', 'P2P'
  amount DECIMAL(15,2) NOT NULL,
  currency_code CHAR(3) DEFAULT 'CAD',
  description TEXT,
  transfer_status VARCHAR(20) DEFAULT 'PENDING',
  bank_reference_id VARCHAR(100),
  scheduled_date DATE,
  completed_date TIMESTAMP,
  fee_amount DECIMAL(10,2),
  error_code VARCHAR(50),
  error_message TEXT,
  transfer_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Bill Payments Table
```sql
CREATE TABLE bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payee_name VARCHAR(255) NOT NULL,
  payee_account_number VARCHAR(100),
  amount DECIMAL(15,2) NOT NULL,
  currency_code CHAR(3) DEFAULT 'CAD',
  payment_date DATE NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'PENDING',
  bank_reference_id VARCHAR(100),
  confirmation_number VARCHAR(100),
  fee_amount DECIMAL(10,2),
  payment_method VARCHAR(20), -- 'ACH', 'WIRE', 'CHECK'
  recurring_schedule JSONB,
  payment_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Security Implementation

### PCI DSS Level 1 Compliance

#### Data Encryption
```typescript
class BankDataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  
  static encrypt(data: string, key: Buffer): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('bank-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }
}
```

#### Token Management
```typescript
class BankTokenManager {
  async storeTokens(tokens: BankTokens): Promise<void> {
    const encryptedAccessToken = await this.encrypt(tokens.accessToken);
    const encryptedRefreshToken = await this.encrypt(tokens.refreshToken);
    
    await this.repository.save({
      ...tokens,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken
    });
  }
  
  async refreshToken(bankCode: string, userId: string): Promise<BankTokens> {
    // Implement token refresh logic with retry and fallback
  }
}
```

#### Audit Logging
```typescript
interface BankAuditLog {
  userId: string;
  bankCode: string;
  action: string;
  endpoint: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  responseStatus: number;
  timestamp: Date;
  sensitiveDataAccessed?: boolean;
}

class BankAuditLogger {
  async logBankOperation(log: BankAuditLog): Promise<void> {
    // Implement secure audit logging
  }
}
```

### Rate Limiting & Circuit Breakers

```typescript
class BankRateLimiter {
  private limits = {
    CIBC: { requests: 100, window: 60000 }, // 100/min
    RBC: { requests: 150, window: 60000 },  // 150/min
    TD: { requests: 200, window: 60000 },   // 200/min
    BMO: { requests: 120, window: 60000 }   // 120/min
  };
  
  async checkRateLimit(bankCode: string, userId: string): Promise<boolean> {
    // Implement rate limiting logic
  }
}

class BankCircuitBreaker {
  private breakers = new Map<string, CircuitBreaker>();
  
  async executeWithBreaker<T>(
    bankCode: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getBreaker(bankCode);
    return breaker.execute(operation);
  }
}
```

---

## Error Handling & Resilience

### Error Classification System

```typescript
enum BankErrorType {
  AUTHENTICATION_ERROR = 'AUTH_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BANK_MAINTENANCE = 'MAINTENANCE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  COMPLIANCE_ERROR = 'COMPLIANCE_ERROR'
}

class BankErrorHandler {
  handleError(error: BankError): BankErrorResponse {
    switch (error.type) {
      case BankErrorType.RATE_LIMIT_EXCEEDED:
        return this.handleRateLimitError(error);
      case BankErrorType.AUTHENTICATION_ERROR:
        return this.handleAuthError(error);
      // ... other error types
    }
  }
}
```

### Retry Strategies

```typescript
class BankRetryStrategy {
  private retryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  };
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    bankCode: string
  ): Promise<T> {
    let attempt = 0;
    let delay = this.retryConfig.baseDelay;
    
    while (attempt < this.retryConfig.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (!this.shouldRetry(error) || attempt === this.retryConfig.maxAttempts - 1) {
          throw error;
        }
        
        await this.delay(delay);
        delay = Math.min(delay * this.retryConfig.backoffFactor, this.retryConfig.maxDelay);
        attempt++;
      }
    }
  }
}
```

---

## Data Synchronization Strategy

### Real-time Synchronization

```typescript
class BankDataSynchronizer {
  async syncAllBanks(userId: string): Promise<SyncResult> {
    const connections = await this.getBankConnections(userId);
    const syncPromises = connections.map(connection => 
      this.syncBankData(connection)
    );
    
    return Promise.allSettled(syncPromises);
  }
  
  private async syncBankData(connection: BankConnection): Promise<void> {
    // Parallel sync of accounts, transactions, and balances
    const [accounts, transactions] = await Promise.all([
      this.syncAccounts(connection),
      this.syncTransactions(connection)
    ]);
    
    await this.updateBalances(accounts);
  }
}
```

### Conflict Resolution

```typescript
class DataConflictResolver {
  resolveTransactionConflict(
    localTransaction: Transaction,
    bankTransaction: Transaction
  ): Transaction {
    // Implement conflict resolution logic
    // Bank data takes precedence for financial data
    // Local data takes precedence for categorization
  }
}
```

---

## Testing Strategy

### Integration Testing Framework

```typescript
class BankIntegrationTest {
  async testBankConnection(bankCode: string): Promise<TestResult> {
    const testSuite = [
      () => this.testAuthentication(bankCode),
      () => this.testAccountRetrieval(bankCode),
      () => this.testTransactionSync(bankCode),
      () => this.testBalanceAccuracy(bankCode),
      () => this.testErrorHandling(bankCode)
    ];
    
    return this.runTestSuite(testSuite);
  }
}
```

### Mock Bank API

```typescript
class MockBankAPI {
  private scenarios = {
    success: () => this.generateSuccessResponse(),
    rateLimited: () => this.generateRateLimitResponse(),
    serverError: () => this.generateServerErrorResponse(),
    networkTimeout: () => this.simulateNetworkTimeout()
  };
  
  async simulateBankAPI(bankCode: string, scenario: string): Promise<Response> {
    return this.scenarios[scenario]();
  }
}
```

---

## Performance Optimization

### Caching Strategy

```typescript
class BankDataCache {
  private cache = new Map<string, CacheEntry>();
  private cacheTTL = {
    balance: 300,      // 5 minutes
    accounts: 3600,    // 1 hour
    transactions: 1800, // 30 minutes
    profile: 7200      // 2 hours
  };
  
  async getCachedData<T>(key: string, dataType: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry, dataType)) {
      return null;
    }
    return entry.data;
  }
}
```

### Connection Pooling

```typescript
class BankConnectionPool {
  private pools = new Map<string, ConnectionPool>();
  
  getConnection(bankCode: string): Promise<BankConnection> {
    const pool = this.pools.get(bankCode);
    return pool.getConnection();
  }
}
```

---

## Monitoring & Alerting

### Performance Metrics

```typescript
class BankIntegrationMetrics {
  private metrics = {
    apiResponseTime: new Map<string, number[]>(),
    successRate: new Map<string, number>(),
    errorRate: new Map<string, number>(),
    syncLatency: new Map<string, number[]>()
  };
  
  recordAPIResponse(bankCode: string, responseTime: number): void {
    // Record metrics for monitoring
  }
  
  getHealthStatus(bankCode: string): HealthStatus {
    // Calculate health status based on metrics
  }
}
```

### Alerting System

```typescript
class BankAlertSystem {
  private alertRules = {
    highErrorRate: { threshold: 0.05, window: 300 }, // 5% in 5 min
    slowResponse: { threshold: 5000, window: 300 },  // >5s in 5 min
    syncFailure: { threshold: 3, window: 1800 }      // 3 failures in 30 min
  };
  
  checkAlertConditions(bankCode: string, metrics: Metrics): void {
    // Check alert conditions and trigger notifications
  }
}
```

---

## Deployment Configuration

### Environment Variables

```bash
# CIBC Configuration
CIBC_CLIENT_ID=your_cibc_client_id
CIBC_CLIENT_SECRET=your_cibc_client_secret
CIBC_BASE_URL=https://api.cibc.com/v1
CIBC_RATE_LIMIT=100

# RBC Configuration
RBC_CLIENT_ID=your_rbc_client_id
RBC_CLIENT_CERTIFICATE_PATH=/path/to/rbc/cert.pem
RBC_PRIVATE_KEY_PATH=/path/to/rbc/key.pem
RBC_BASE_URL=https://api.rbc.com/v2
RBC_RATE_LIMIT=150

# TD Configuration
TD_CLIENT_ID=your_td_client_id
TD_CLIENT_SECRET=your_td_client_secret
TD_API_KEY=your_td_api_key
TD_BASE_URL=https://api.td.com/v1
TD_RATE_LIMIT=200

# BMO Configuration
BMO_CLIENT_ID=your_bmo_client_id
BMO_CLIENT_SECRET=your_bmo_client_secret
BMO_BASE_URL=https://api.bmo.com/v1
BMO_RATE_LIMIT=120

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dwaybank
REDIS_URL=redis://localhost:6379

# Security Configuration
ENCRYPTION_KEY=your_32_byte_encryption_key
JWT_SECRET=your_jwt_secret
PCI_COMPLIANCE_MODE=true
```

### Docker Configuration

```dockerfile
# Banking Integration Service
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Security: Run as non-root user
RUN addgroup -g 1001 -S dwaybank && \
    adduser -S dwaybank -u 1001 -G dwaybank
USER dwaybank

EXPOSE 3001

CMD ["node", "src/banking-service/index.js"]
```

---

**Document Version**: 1.0  
**Last Updated**: January 7, 2025  
**Next Review**: January 21, 2025  
**Document Owner**: Backend Development Team