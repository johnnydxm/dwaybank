# 🚀 DevOps Setup & Configuration Guide

Complete setup guide for DwayBank CI/CD pipeline and infrastructure.

## 📋 Quick Start Checklist

### ✅ Phase 1: Repository Setup (COMPLETED)
- [x] All source code committed and pushed to GitHub
- [x] Comprehensive CI/CD pipeline implemented
- [x] Security scanning and quality gates configured
- [x] Docker containerization optimized
- [x] Issue and PR templates created

### 🔧 Phase 2: Configuration Required

#### 1. GitHub Repository Settings

**Branch Protection Rules** (Manual Setup Required):
```
Repository Settings > Branches > Add Rule

Branch name pattern: master
✅ Require pull request reviews before merging
  - Required approving reviews: 1
  - Dismiss stale reviews when new commits are pushed
  - Require review from code owners
✅ Require status checks to pass before merging
  - Require branches to be up to date before merging
  - Required status checks:
    - Code Quality & Formatting
    - Security Vulnerability Scan  
    - Unit Tests & Coverage
    - Docker Build & Security Scan
    - Integration Tests
✅ Require conversation resolution before merging
✅ Include administrators
```

**Repository Secrets Setup**:
Navigate to: `Settings > Secrets and variables > Actions`

Required secrets (see `.github/SECRETS_SETUP.md`):
```bash
# Core Application
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
SESSION_SECRET=<32-char-random-string>
DB_PASSWORD=<strong-db-password>
REDIS_PASSWORD=<redis-password>

# Docker Registry
DOCKER_USERNAME=<your-docker-username>
DOCKER_PASSWORD=<your-docker-password>

# Security Scanning
SNYK_TOKEN=<snyk-api-token>
CODECOV_TOKEN=<codecov-token>

# Notifications (Optional)
SLACK_WEBHOOK=<slack-webhook-url>
```

#### 2. External Service Integration

**Snyk Security Scanning**:
1. Sign up at https://snyk.io
2. Generate API token
3. Add `SNYK_TOKEN` to GitHub secrets

**CodeCov Coverage Reports**:
1. Sign up at https://codecov.io
2. Connect your repository
3. Add `CODECOV_TOKEN` to GitHub secrets

**Docker Hub Registry**:
1. Create Docker Hub account
2. Create repository: `dwaybank/smart-wallet`
3. Add credentials to GitHub secrets

#### 3. Environment Configuration

**Development Environment**:
```bash
# Copy and configure
cp .env.example .env.development

# Required variables:
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_NAME=dwaybank_dev
# ... see .env.example for full list
```

**Staging Environment** (Server Setup):
```bash
# Database
CREATE DATABASE dwaybank_staging;
CREATE USER staging_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE dwaybank_staging TO staging_user;

# Redis
# Configure Redis instance for staging

# Environment variables (server)
NODE_ENV=staging
DB_HOST=staging-db-host
# ... other staging config
```

**Production Environment** (Server Setup):
```bash
# Database with high availability
CREATE DATABASE dwaybank_production;
CREATE USER prod_user WITH PASSWORD 'very_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dwaybank_production TO prod_user;

# Redis cluster for production
# Configure Redis cluster/sentinel

# Environment variables (server)
NODE_ENV=production
DB_HOST=prod-db-host
# ... other production config
```

## 🏗️ Infrastructure Setup

### Container Orchestration

**Docker Compose (Development)**:
```bash
# Start full development stack
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop stack
docker-compose down
```

**Production Deployment Options**:

**Option 1: Docker Swarm**:
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml dwaybank

# Scale services
docker service scale dwaybank_app=3
```

**Option 2: Kubernetes**:
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dwaybank-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dwaybank-api
  template:
    metadata:
      labels:
        app: dwaybank-api
    spec:
      containers:
      - name: api
        image: dwaybank/smart-wallet:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        # ... other env variables from secrets
```

**Option 3: Cloud Deployment**:

**AWS ECS**:
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name dwaybank-prod

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service --cluster dwaybank-prod --service-name dwaybank-api --task-definition dwaybank:1 --desired-count 2
```

**Google Cloud Run**:
```bash
# Deploy to Cloud Run
gcloud run deploy dwaybank-api \
  --image gcr.io/PROJECT-ID/dwaybank:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Database Setup

**PostgreSQL Configuration**:
```sql
-- Production database setup
CREATE DATABASE dwaybank_production 
WITH ENCODING 'UTF8' 
LC_COLLATE='en_US.UTF-8' 
LC_CTYPE='en_US.UTF-8' 
TEMPLATE template0;

-- Create application user
CREATE ROLE dwaybank_user WITH LOGIN PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE dwaybank_production TO dwaybank_user;

-- Performance tuning (adjust based on your server)
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
SELECT pg_reload_conf();
```

**Redis Configuration**:
```bash
# Redis production config
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
requirepass your_redis_password
```

## 🔍 Monitoring & Observability

### Application Monitoring

**Health Checks**:
- Application: `GET /health`
- Database: `GET /health/db` 
- Redis: `GET /health/redis`
- Detailed: `GET /health/detailed`

**Logging Configuration**:
```javascript
// Production logging levels
{
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
}
```

**Metrics Collection**:
- **Application Metrics**: Response times, error rates, throughput
- **System Metrics**: CPU, memory, disk, network usage
- **Business Metrics**: User registrations, authentication attempts, API usage

### Alerting Setup

**Critical Alerts**:
- Application downtime (>1 minute)
- Database connection failures
- High error rates (>5%)
- Security incidents
- Performance degradation (>2s response time)

**Warning Alerts**:
- High CPU/memory usage (>80%)
- Disk space low (<20%)
- Unusual traffic spikes
- Failed deployments

## 📊 Performance Optimization

### Database Optimization
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);
CREATE INDEX CONCURRENTLY idx_sessions_expires_at ON sessions(expires_at);

-- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Application Caching
```javascript
// Redis caching strategy
const cacheConfig = {
  user_sessions: { ttl: 3600 }, // 1 hour
  user_profiles: { ttl: 1800 }, // 30 minutes
  app_config: { ttl: 7200 }     // 2 hours
};
```

### Load Balancing
```nginx
# Nginx configuration
upstream dwaybank_api {
    server app1:3000 weight=3;
    server app2:3000 weight=3;
    server app3:3000 weight=2;
}

server {
    listen 80;
    server_name api.dwaybank.com;
    
    location / {
        proxy_pass http://dwaybank_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🔒 Security Hardening

### SSL/TLS Configuration
```bash
# Let's Encrypt SSL
certbot --nginx -d api.dwaybank.com

# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
```

### Firewall Rules
```bash
# UFW rules (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3000/tcp  # Block direct app access
ufw enable
```

### Security Headers
```javascript
// Helmet.js configuration (already in code)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));
```

## 🚀 Deployment Procedures

### Automated Deployment (CI/CD)
1. **Code Push**: Developer pushes to `develop` branch
2. **Quality Gates**: Automated testing and security scans
3. **Staging Deploy**: Automatic deployment to staging
4. **Manual Testing**: QA team validates staging
5. **Production Deploy**: Merge to `master` triggers production deployment
6. **Monitoring**: Post-deployment health checks and monitoring

### Manual Deployment (Emergency)
```bash
# Emergency hotfix deployment
git checkout master
git pull origin master

# Build and deploy
docker build -t dwaybank/smart-wallet:hotfix .
docker push dwaybank/smart-wallet:hotfix

# Update production (example with docker-compose)
docker-compose pull
docker-compose up -d --no-deps app

# Verify deployment
curl -f https://api.dwaybank.com/health
```

### Rollback Procedures
```bash
# Quick rollback to previous version
docker-compose down
docker tag dwaybank/smart-wallet:previous dwaybank/smart-wallet:latest
docker-compose up -d

# Or using Kubernetes
kubectl rollout undo deployment/dwaybank-api
kubectl rollout status deployment/dwaybank-api
```

## 📈 Scaling Strategies

### Horizontal Scaling
- Load balancer with multiple app instances
- Database read replicas
- Redis cluster for session storage
- CDN for static assets

### Vertical Scaling
- Increase CPU/memory for existing instances
- Database performance tuning
- Connection pool optimization
- Cache size optimization

## 🎯 Next Steps

### Immediate Actions Required:
1. **Set up branch protection rules** (manual GitHub settings)
2. **Configure secrets** (using `.github/SECRETS_SETUP.md`)
3. **Set up external services** (Snyk, CodeCov, Docker Hub)
4. **Configure staging environment**
5. **Test CI/CD pipeline** with a test PR

### Medium-term Goals:
1. **Production environment setup**
2. **Monitoring and alerting configuration**
3. **Performance optimization**
4. **Security hardening**
5. **Disaster recovery procedures**

### Long-term Objectives:
1. **Multi-region deployment**
2. **Advanced monitoring with APM tools**
3. **Automated scaling policies**
4. **Compliance certifications**
5. **Advanced security measures**

---

## 📞 Support & Contacts

- **DevOps Team**: devops@dwaybank.com
- **Security Team**: security@dwaybank.com
- **GitHub Repository**: https://github.com/johnnydxm/dwaybank
- **Documentation**: See `/docs` directory
- **Emergency Procedures**: See `.github/SECURITY.md`

**Last Updated**: December 2024  
**Version**: 1.0.0