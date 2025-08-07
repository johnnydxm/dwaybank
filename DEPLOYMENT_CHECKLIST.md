# DwayBank Smart Wallet MVP - Production Deployment Checklist

## Overview
This checklist ensures a successful production deployment of the DwayBank Smart Wallet MVP. Follow each section in order and verify completion before proceeding.

**Deployment Target**: Smart Wallet MVP with Apple Pay, Google Pay, and MetaMask integration  
**Timeline**: MVP launch ready  
**Scope**: Core wallet functionality, not 4-platform expansion

---

## Phase 1: Pre-Deployment Setup

### 1.1 Infrastructure Preparation ✅
- [ ] **Production Environment Variables**
  - [ ] Copy `.env.production.template` to `.env.production`
  - [ ] Configure all required environment variables (see section 5.1)
  - [ ] Verify wallet API credentials (Apple Pay, Google Pay, MetaMask)
  - [ ] Set up Plaid credentials for bank account connections
  - [ ] Configure monitoring keys (Sentry, New Relic)

- [ ] **Database Setup**
  - [ ] Provision production PostgreSQL database
  - [ ] Configure SSL certificates and secure connections
  - [ ] Run existing migrations (001-008) 
  - [ ] Execute new wallet migrations:
    ```bash
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/migrations/009_create_wallets_table.sql
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/migrations/010_create_payment_methods.sql
    ```
  - [ ] Verify all tables created successfully
  - [ ] Set up database backups and point-in-time recovery

- [ ] **Redis Setup**
  - [ ] Provision production Redis instance
  - [ ] Configure Redis password and SSL
  - [ ] Test Redis connectivity from application

### 1.2 Security Configuration ✅
- [ ] **SSL/TLS Certificates**
  - [ ] Obtain SSL certificates for api.dwaybank.com
  - [ ] Obtain SSL certificates for app.dwaybank.com
  - [ ] Configure certificate auto-renewal

- [ ] **Wallet API Security**
  - [ ] Apple Pay merchant certificate installation
  - [ ] Google Pay merchant verification
  - [ ] MetaMask RPC endpoint security configuration
  - [ ] Plaid webhook verification setup

- [ ] **Application Security**
  - [ ] Generate strong JWT secrets (minimum 32 characters)
  - [ ] Configure session secrets
  - [ ] Set up encryption keys for sensitive wallet data
  - [ ] Enable rate limiting (100 requests per 15 minutes)

### 1.3 Monitoring & Observability Setup ✅
- [ ] **Prometheus Configuration**
  - [ ] Deploy Prometheus with wallet-specific metrics
  - [ ] Import alert rules from `monitoring/wallet-alerts.yml`
  - [ ] Configure alert manager for notifications

- [ ] **Grafana Dashboards**
  - [ ] Import wallet dashboard from `monitoring/wallet-dashboard.json`
  - [ ] Configure Grafana admin credentials
  - [ ] Set up alert notifications (Slack, email)

- [ ] **Log Aggregation**
  - [ ] Configure ELK stack for centralized logging
  - [ ] Set up log retention policies (30 days minimum)
  - [ ] Configure log shipping from all services

---

## Phase 2: Application Deployment

### 2.1 Container Building ✅
- [ ] **Backend Container**
  ```bash
  # Build production backend
  docker build -f docker/backend/Dockerfile --target production -t dwaybank/backend:1.0.0 .
  
  # Test container locally
  docker run --env-file .env.production -p 3000:3000 dwaybank/backend:1.0.0
  ```

- [ ] **Frontend Container**
  ```bash
  # Build production frontend
  docker build -f docker/frontend/Dockerfile --target production -t dwaybank/frontend:1.0.0 .
  
  # Test container locally
  docker run -p 80:80 dwaybank/frontend:1.0.0
  ```

- [ ] **Registry Push**
  ```bash
  # Push to container registry
  docker tag dwaybank/backend:1.0.0 ghcr.io/dwaybank/smart-wallet-backend:1.0.0
  docker tag dwaybank/frontend:1.0.0 ghcr.io/dwaybank/smart-wallet-frontend:1.0.0
  docker push ghcr.io/dwaybank/smart-wallet-backend:1.0.0
  docker push ghcr.io/dwaybank/smart-wallet-frontend:1.0.0
  ```

### 2.2 Production Deployment ✅
- [ ] **Deploy with Docker Compose**
  ```bash
  # Copy production environment
  cp .env.production.template .env
  # Edit .env with actual production values
  
  # Deploy all services
  docker-compose -f docker-compose.production.yml up -d
  
  # Verify all services are running
  docker-compose -f docker-compose.production.yml ps
  ```

- [ ] **Health Checks**
  - [ ] Backend health endpoint: `curl https://api.dwaybank.com/api/health`
  - [ ] Frontend serving: `curl https://app.dwaybank.com/health`
  - [ ] Database connectivity: Check logs for successful connections
  - [ ] Redis connectivity: Check session storage working

---

## Phase 3: Wallet Integration Testing

### 3.1 Apple Pay Integration ✅
- [ ] **Certificate Validation**
  - [ ] Verify Apple Pay merchant certificate is properly installed
  - [ ] Test certificate chain validation
  - [ ] Confirm merchant ID configuration

- [ ] **Functionality Testing**
  - [ ] Test Apple Pay button display on supported devices
  - [ ] Verify payment sheet appears with correct merchant info
  - [ ] Test successful payment flow end-to-end
  - [ ] Verify transaction records in database
  - [ ] Test error handling for declined payments

### 3.2 Google Pay Integration ✅
- [ ] **Google Pay Console Setup**
  - [ ] Verify merchant account is approved
  - [ ] Confirm production environment configuration
  - [ ] Test merchant verification

- [ ] **Functionality Testing**
  - [ ] Test Google Pay button on Android devices
  - [ ] Verify payment data format and validation
  - [ ] Test successful payment processing
  - [ ] Verify transaction storage and user notification
  - [ ] Test error scenarios and user feedback

### 3.3 MetaMask Integration ✅
- [ ] **Web3 Configuration**
  - [ ] Verify Infura project ID and secret
  - [ ] Test Ethereum mainnet connectivity
  - [ ] Confirm gas estimation accuracy

- [ ] **Functionality Testing**
  - [ ] Test MetaMask connection flow
  - [ ] Verify wallet address detection and validation
  - [ ] Test transaction signing and submission
  - [ ] Verify blockchain transaction confirmation
  - [ ] Test disconnect and reconnect scenarios

### 3.4 Bank Account Integration (Plaid) ✅
- [ ] **Plaid Configuration**
  - [ ] Verify production Plaid credentials
  - [ ] Test bank institution coverage
  - [ ] Confirm webhook endpoint accessibility

- [ ] **Functionality Testing**
  - [ ] Test bank account linking flow
  - [ ] Verify account balance retrieval
  - [ ] Test transaction history sync
  - [ ] Verify data encryption and storage
  - [ ] Test account disconnection flow

---

## Phase 4: Security Validation

### 4.1 Authentication & Authorization ✅
- [ ] **JWT Security**
  - [ ] Verify JWT tokens are properly signed
  - [ ] Test token expiration and refresh
  - [ ] Confirm secure token storage in client

- [ ] **MFA Testing**
  - [ ] Test TOTP setup and validation
  - [ ] Verify backup codes generation
  - [ ] Test MFA requirement enforcement

- [ ] **Session Security**
  - [ ] Verify secure session cookies
  - [ ] Test session timeout functionality
  - [ ] Confirm session invalidation on logout

### 4.2 Data Protection ✅
- [ ] **Encryption Verification**
  - [ ] Verify sensitive wallet data is encrypted at rest
  - [ ] Test API keys and tokens are properly encrypted
  - [ ] Confirm payment data follows PCI requirements

- [ ] **API Security**
  - [ ] Test rate limiting enforcement (100 req/15min)
  - [ ] Verify CORS configuration
  - [ ] Test input validation and sanitization
  - [ ] Confirm secure headers (HSTS, CSP, etc.)

### 4.3 Vulnerability Assessment ✅
- [ ] **Security Scanning**
  - [ ] Run OWASP ZAP security scan
  - [ ] Execute Snyk vulnerability scan on dependencies
  - [ ] Perform penetration testing on critical endpoints

- [ ] **Code Security Review**
  - [ ] Review wallet integration code for security issues
  - [ ] Verify no hardcoded secrets or credentials
  - [ ] Confirm secure error handling (no info leakage)

---

## Phase 5: Performance & Load Testing

### 5.1 Performance Benchmarks ✅
- [ ] **API Performance**
  - [ ] Wallet API endpoints respond < 2 seconds (95th percentile)
  - [ ] Payment processing completes < 10 seconds
  - [ ] Wallet sync operations complete < 30 seconds

- [ ] **Database Performance**
  - [ ] Wallet queries execute < 500ms
  - [ ] Transaction history loads < 1 second
  - [ ] Balance calculations complete < 200ms

### 5.2 Load Testing ✅
- [ ] **Concurrent User Testing**
  - [ ] Test 100 concurrent wallet connections
  - [ ] Test 50 concurrent payment transactions
  - [ ] Test 200 concurrent API requests

- [ ] **Wallet Sync Load Testing**
  - [ ] Test multiple wallet sync operations
  - [ ] Verify system stability under high sync load
  - [ ] Test error recovery and retry mechanisms

---

## Phase 6: Monitoring & Alerting Validation

### 6.1 Alert Testing ✅
- [ ] **Critical Alerts**
  - [ ] Test wallet sync failure alerts
  - [ ] Test payment processing failure alerts
  - [ ] Test high fraud score alerts
  - [ ] Test API error rate alerts

- [ ] **Warning Alerts**
  - [ ] Test high latency alerts
  - [ ] Test resource usage alerts
  - [ ] Test balance reconciliation alerts

### 6.2 Dashboard Verification ✅
- [ ] **Grafana Dashboards**
  - [ ] Verify wallet connection metrics display correctly
  - [ ] Test transaction volume charts
  - [ ] Confirm API performance graphs
  - [ ] Verify security metrics tracking

- [ ] **Log Analysis**
  - [ ] Confirm structured logging format
  - [ ] Test log search and filtering
  - [ ] Verify error log aggregation

---

## Phase 7: Business Logic Validation

### 7.1 User Journey Testing ✅
- [ ] **Complete User Flows**
  - [ ] New user registration → wallet connection → first transaction
  - [ ] Existing user → add second wallet → test multi-wallet
  - [ ] User → payment attempt → success/failure handling
  - [ ] User → transaction history → balance verification

### 7.2 Edge Cases ✅
- [ ] **Error Scenarios**
  - [ ] Test wallet API timeouts and retries
  - [ ] Test payment failures and user notification
  - [ ] Test network connectivity issues
  - [ ] Test invalid wallet credentials handling

### 7.3 Data Consistency ✅
- [ ] **Balance Reconciliation**
  - [ ] Verify wallet balances match external sources
  - [ ] Test transaction deduplication
  - [ ] Confirm balance updates after transactions
  - [ ] Verify transaction categorization accuracy

---

## Phase 8: Backup & Recovery Testing

### 8.1 Backup Verification ✅
- [ ] **Database Backups**
  - [ ] Verify automated daily backups are working
  - [ ] Test backup integrity and restoration
  - [ ] Confirm backup encryption and storage

- [ ] **Configuration Backups**
  - [ ] Backup environment configurations
  - [ ] Backup SSL certificates and keys
  - [ ] Document recovery procedures

### 8.2 Disaster Recovery ✅
- [ ] **Recovery Testing**
  - [ ] Test database recovery from backup
  - [ ] Test application recovery procedures
  - [ ] Verify RTO (Recovery Time Objective) < 1 hour
  - [ ] Verify RPO (Recovery Point Objective) < 15 minutes

---

## Phase 9: Documentation & Runbooks

### 9.1 Operational Documentation ✅
- [ ] **Runbooks Created**
  - [ ] Wallet sync failure troubleshooting
  - [ ] Payment processing issues
  - [ ] Database performance problems
  - [ ] Security incident response

- [ ] **API Documentation**
  - [ ] Update API documentation with wallet endpoints
  - [ ] Document authentication requirements
  - [ ] Provide integration examples

### 9.2 User Documentation ✅
- [ ] **User Guides**
  - [ ] Wallet connection instructions
  - [ ] Payment setup guides
  - [ ] Security best practices
  - [ ] Troubleshooting FAQ

---

## Phase 10: Go-Live Checklist

### 10.1 Final Pre-Launch ✅
- [ ] **Team Readiness**
  - [ ] Development team on standby for first 24 hours
  - [ ] Support team trained on wallet features
  - [ ] Escalation procedures documented

- [ ] **Communication Plan**
  - [ ] User announcement prepared
  - [ ] Status page updated
  - [ ] Social media posts scheduled

### 10.2 Launch Execution ✅
- [ ] **DNS and Traffic**
  - [ ] Update DNS records to point to production
  - [ ] Verify SSL certificates active
  - [ ] Test end-to-end user flow from public internet

- [ ] **Monitoring**
  - [ ] Enable all production alerts
  - [ ] Start monitoring dashboards
  - [ ] Begin log collection and analysis

### 10.3 Post-Launch Monitoring ✅
- [ ] **First 24 Hours**
  - [ ] Monitor error rates and performance
  - [ ] Track user adoption metrics
  - [ ] Monitor wallet connection success rates
  - [ ] Watch for fraud or security alerts

- [ ] **First Week**
  - [ ] Daily performance reviews
  - [ ] User feedback collection
  - [ ] Issue tracking and resolution
  - [ ] Capacity planning adjustments

---

## Critical Environment Variables

### Required Production Configuration

```bash
# Core Application
NODE_ENV=production
API_BASE_URL=https://api.dwaybank.com
CORS_ORIGIN=https://app.dwaybank.com

# Database (Required)
DB_HOST=your-production-postgres-host
DB_NAME=dwaybank_prod
DB_USER=dwaybank_prod_user
DB_PASSWORD=[SECURE_PASSWORD]

# Redis (Required)
REDIS_HOST=your-production-redis-host
REDIS_PASSWORD=[SECURE_PASSWORD]

# Security (Required)
JWT_SECRET=[32_CHAR_SECRET]
JWT_REFRESH_SECRET=[32_CHAR_SECRET]
ENCRYPTION_KEY=[32_CHAR_KEY]
SESSION_SECRET=[32_CHAR_SECRET]

# Wallet APIs (Required)
APPLE_PAY_MERCHANT_ID=merchant.com.dwaybank.wallet
GOOGLE_PAY_MERCHANT_ID=[YOUR_MERCHANT_ID]
INFURA_PROJECT_ID=[YOUR_INFURA_PROJECT_ID]
PLAID_CLIENT_ID=[YOUR_PLAID_CLIENT_ID]
PLAID_SECRET=[YOUR_PLAID_SECRET]

# Monitoring (Recommended)
SENTRY_DSN=[YOUR_SENTRY_DSN]
NEW_RELIC_LICENSE_KEY=[YOUR_KEY]
```

---

## Success Criteria

### Technical Metrics
- [ ] 99.9% uptime for core wallet services
- [ ] < 2 second API response times (95th percentile)
- [ ] < 0.1% payment failure rate
- [ ] Zero security incidents in first week

### Business Metrics
- [ ] Successful wallet connections within first 24 hours
- [ ] Completed payment transactions
- [ ] User retention rate > 80% after first use
- [ ] Support ticket volume < 5% of total users

---

## Emergency Contacts

**Development Team Lead**: [Contact Info]  
**DevOps Engineer**: [Contact Info]  
**Security Team**: [Contact Info]  
**Database Administrator**: [Contact Info]

## Rollback Plan

If critical issues are discovered post-launch:

1. **Immediate**: Redirect traffic to maintenance page
2. **5 minutes**: Rollback database migrations if needed
3. **10 minutes**: Deploy previous stable container versions
4. **15 minutes**: Verify rollback successful, resume service
5. **Post-incident**: Conduct retrospective and update procedures

---

**Deployment Sign-off**:

- [ ] Development Team Lead: _________________ Date: _______
- [ ] DevOps Engineer: _________________ Date: _______  
- [ ] Security Team: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______

**DEPLOYMENT APPROVED**: _________________ Date: _______