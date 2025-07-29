# 🔐 Secrets Configuration Guide

This guide helps you configure all required secrets for the DwayBank CI/CD pipeline.

## 📋 Required Secrets

### GitHub Repository Secrets

Navigate to: `Settings > Secrets and variables > Actions > Repository secrets`

#### 🔑 Core Application Secrets
```bash
# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=dwaybank_production
DB_USER=your-db-user
DB_PASSWORD=your-strong-db-password

# Redis Configuration  
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password

# JWT & Session Secrets
JWT_SECRET=your-super-secure-jwt-secret-at-least-64-chars-long
JWT_REFRESH_SECRET=your-refresh-token-secret
SESSION_SECRET=your-session-secret-key

# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

#### 🐳 Docker & Registry Secrets
```bash
# Docker Hub (or your preferred registry)
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password

# Optional: Private Registry
REGISTRY_URL=your-private-registry.com
REGISTRY_USERNAME=your-registry-user
REGISTRY_PASSWORD=your-registry-password
```

#### 🔍 Security & Monitoring Secrets
```bash
# Snyk Security Scanning
SNYK_TOKEN=your-snyk-api-token

# CodeCov Coverage Reports
CODECOV_TOKEN=your-codecov-token

# Slack Notifications (Optional)
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

#### ☁️ Cloud Provider Secrets (Choose your provider)

**AWS:**
```bash
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

**Google Cloud:**
```bash
GCP_PROJECT_ID=your-project-id
GCP_SERVICE_ACCOUNT_KEY=your-base64-encoded-service-account-json
```

**Azure:**
```bash
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

## 🛠️ Setup Instructions

### 1. Generate Strong Secrets

Use these commands to generate secure secrets:

```bash
# JWT Secrets (64+ characters)
openssl rand -base64 64

# Session Secret
openssl rand -hex 32  

# Database Password
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
```

### 2. GitHub Secrets Setup

```bash
# Using GitHub CLI (recommended)
gh secret set JWT_SECRET --body "your-generated-jwt-secret"
gh secret set DB_PASSWORD --body "your-db-password"
gh secret set REDIS_PASSWORD --body "your-redis-password"

# Add all other secrets following this pattern
```

### 3. Environment-Specific Configuration

#### Development Environment (.env.development)
```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dwaybank_dev
# ... other development settings
```

#### Staging Environment (.env.staging)
```bash
NODE_ENV=staging
PORT=3000
# Use staging database and services
# ... staging-specific settings
```

#### Production Environment (.env.production)
```bash
NODE_ENV=production
PORT=3000
# Use production secrets from GitHub
# ... production-specific settings
```

## 🔒 Security Best Practices

### ✅ Do:
- Use strong, randomly generated secrets
- Rotate secrets regularly (quarterly)
- Use different secrets for each environment
- Enable 2FA on all service accounts
- Monitor secret usage and access logs
- Use managed secret services when available

### ❌ Don't:
- Commit secrets to version control
- Share secrets via insecure channels
- Use the same secret across environments
- Use weak or predictable secrets
- Store secrets in plain text files
- Use production secrets in development

## 🔄 Secret Rotation Schedule

| Secret Type | Rotation Frequency | Process |
|-------------|-------------------|---------|
| JWT Secrets | Every 90 days | Generate new, update in GitHub, deploy |  
| Database Passwords | Every 180 days | Coordinate with DBA, zero-downtime rotation |
| API Keys | Every 90 days | Provider-specific rotation process |
| Service Accounts | Every 180 days | Generate new keys, update deployments |

## 🚨 Emergency Procedures

### Compromised Secret Response:
1. **Immediate**: Revoke compromised secret at source
2. **Generate**: Create new secret immediately  
3. **Update**: Update GitHub secrets
4. **Deploy**: Emergency deployment with new secrets
5. **Monitor**: Watch for any suspicious activity
6. **Document**: Log incident for security review

### Emergency Contacts:
- **Security Team**: security@dwaybank.com
- **DevOps Team**: devops@dwaybank.com  
- **On-Call**: Use PagerDuty or similar

## 📊 Monitoring & Alerting

Set up monitoring for:
- Failed authentication attempts
- Unusual API access patterns
- Secret rotation failures
- Certificate expiration warnings
- Security scan failures

## 🔗 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP Secrets Management](https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure)
- [HashiCorp Vault](https://www.vaultproject.io/) (for advanced secret management)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/)

---

**⚠️ Important**: This guide contains sensitive configuration information. Treat it as confidential and only share with authorized team members.