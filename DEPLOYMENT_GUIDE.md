# DwayBank Production Deployment Guide

## 🚀 Production-Ready CI/CD Pipeline & Infrastructure

This guide provides comprehensive instructions for deploying DwayBank Smart Wallet to production with enterprise-grade security, monitoring, and compliance.

### 🎯 Success Criteria Achieved

✅ **Automated deployment pipeline from git push to production**  
✅ **Quality gates prevent broken code from reaching production**  
✅ **Comprehensive monitoring and alerting in place**  
✅ **Zero-downtime deployment capability**  
✅ **PCI DSS compliant infrastructure deployment**

---

## 📋 Infrastructure Overview

### Architecture Components

- **Frontend**: React application served by Nginx with security headers
- **Backend**: Node.js/Express API with comprehensive middleware
- **Database**: PostgreSQL with automated backups and encryption
- **Cache**: Redis with authentication and encryption
- **Load Balancer**: AWS ALB with SSL termination
- **Container Orchestration**: ECS with auto-scaling
- **Monitoring**: Prometheus, Grafana, ELK stack
- **Security**: Multiple layers of scanning and compliance validation

### Deployment Strategy

- **Blue-Green Deployment**: Zero-downtime deployments with automatic rollback
- **Multi-Environment**: Development → Staging → Production pipeline
- **Infrastructure as Code**: Terraform for reproducible infrastructure
- **Monitoring**: Comprehensive observability with financial-grade alerting

---

## 🛠️ Prerequisites

### Required Tools

```bash
# AWS CLI
aws --version  # >= 2.0

# Docker
docker --version  # >= 20.0

# Node.js
node --version  # >= 18.0

# Terraform
terraform --version  # >= 1.6.0
```

### AWS Setup

1. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter your AWS credentials
   ```

2. **Create S3 bucket for Terraform state**:
   ```bash
   aws s3 mb s3://dwaybank-terraform-state
   aws s3api put-bucket-versioning \
     --bucket dwaybank-terraform-state \
     --versioning-configuration Status=Enabled
   ```

3. **Create DynamoDB table for Terraform locks**:
   ```bash
   aws dynamodb create-table \
     --table-name dwaybank-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
   ```

### GitHub Secrets Configuration

Configure the following secrets in your GitHub repository:

#### AWS Configuration
```
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/DwayBankDeploymentRole
AWS_STAGING_ROLE_ARN=arn:aws:iam::ACCOUNT:role/DwayBankStagingRole
AWS_PROD_ROLE_ARN=arn:aws:iam::ACCOUNT:role/DwayBankProdRole
```

#### Database Secrets
```
DB_PASSWORD=your-secure-database-password
DB_USER=dwaybank_admin
REDIS_PASSWORD=your-secure-redis-password
```

#### Application Secrets
```
JWT_SECRET=your-32-character-jwt-secret-key
SESSION_SECRET=your-32-character-session-secret
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Monitoring & Alerting
```
SLACK_WEBHOOK=https://hooks.slack.com/your-webhook
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key
```

#### Security Scanning
```
SNYK_TOKEN=your-snyk-token
CODECOV_TOKEN=your-codecov-token
```

---

## 🏗️ Infrastructure Deployment

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Plan Infrastructure

```bash
# For staging
terraform plan -var="environment=staging" -var-file="environments/staging.tfvars"

# For production
terraform plan -var="environment=production" -var-file="environments/production.tfvars"
```

### 3. Deploy Infrastructure

```bash
# Deploy staging
terraform apply -var="environment=staging" -var-file="environments/staging.tfvars"

# Deploy production
terraform apply -var="environment=production" -var-file="environments/production.tfvars"
```

### 4. Verify Infrastructure

```bash
# Check ECS cluster
aws ecs describe-clusters --clusters dwaybank-production

# Check ALB
aws elbv2 describe-load-balancers --names dwaybank-production-alb

# Check RDS
aws rds describe-db-instances --db-instance-identifier dwaybank-production
```

---

## 🚀 Application Deployment

### Automated Deployment (Recommended)

#### Via GitHub Actions

1. **Push to develop branch** → Triggers staging deployment
2. **Push to master branch** → Triggers production deployment

The CI/CD pipeline automatically:
- Runs quality gates (linting, testing, security scans)
- Builds and pushes Docker images
- Deploys to ECS with blue-green strategy
- Performs health checks and monitoring setup

#### Manual Deployment

```bash
# Build and push images
docker build -f docker/backend/Dockerfile -t dwaybank-backend:v1.0.0 .
docker build -f docker/frontend/Dockerfile -t dwaybank-frontend:v1.0.0 .

# Tag for ECR
docker tag dwaybank-backend:v1.0.0 YOUR_ECR/dwaybank-backend:v1.0.0
docker tag dwaybank-frontend:v1.0.0 YOUR_ECR/dwaybank-frontend:v1.0.0

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR
docker push YOUR_ECR/dwaybank-backend:v1.0.0
docker push YOUR_ECR/dwaybank-frontend:v1.0.0

# Deploy using blue-green script
export APP_IMAGE=YOUR_ECR/dwaybank-backend:v1.0.0
export APP_VERSION=v1.0.0
export ENVIRONMENT=production
./scripts/deploy.sh deploy
```

---

## 📊 Monitoring & Observability

### Access Monitoring Dashboards

1. **Grafana**: `http://your-alb-dns:3001`
   - Username: admin
   - Password: (set in environment variables)

2. **Prometheus**: `http://your-alb-dns:9090`

3. **Kibana**: `http://your-alb-dns:5601`

### Key Metrics to Monitor

#### Application Metrics
- Request rate and response times
- Error rates and status codes
- Transaction success/failure rates
- Authentication and security events

#### Infrastructure Metrics
- CPU and memory utilization
- Database connections and performance
- Redis cache hit rates
- Load balancer health checks

#### Business Metrics
- Transaction volume and values
- User registration and authentication rates
- Payment processing success rates
- Compliance and audit events

### Alerting Configuration

Critical alerts are configured for:
- Application downtime (1 minute threshold)
- High error rates (>5% for 2 minutes)
- Database connection issues
- Security incidents
- PCI DSS compliance violations

---

## 🔒 Security & Compliance

### PCI DSS Compliance

The infrastructure implements PCI DSS v4.0 requirements:

1. **Network Security**: WAF, security groups, network segmentation
2. **Data Protection**: Encryption at rest and in transit
3. **Access Control**: IAM roles, MFA, principle of least privilege
4. **Monitoring**: Comprehensive logging and audit trails
5. **Security Testing**: Automated vulnerability scanning

### Security Scanning

Automated security scans run on:
- **Daily basis**: Dependency and vulnerability scans
- **Every commit**: Code security analysis
- **Container builds**: Image vulnerability scanning
- **Infrastructure changes**: Terraform security validation

### Compliance Validation

```bash
# Run compliance tests
npm run test:compliance --workspace=@dwaybank/backend

# Generate compliance report
./scripts/compliance-report.sh
```

---

## 🔄 Blue-Green Deployment

### How It Works

1. **Current State**: Traffic flows to "blue" environment
2. **Deploy**: Update "green" environment with new version
3. **Test**: Health checks validate green environment
4. **Switch**: Route traffic from blue to green
5. **Monitor**: Watch for issues and auto-rollback if needed

### Manual Blue-Green Operations

```bash
# Check current environment
./scripts/deploy.sh status

# Deploy to inactive environment
./scripts/deploy.sh deploy

# Manual rollback if needed
./scripts/deploy.sh rollback
```

### Deployment Verification

```bash
# Check service health
curl https://your-app-domain/api/health

# Verify database connectivity
curl https://your-app-domain/api/health/database

# Check metrics endpoint
curl https://your-app-domain/api/metrics
```

---

## 💾 Backup & Recovery

### Automated Backups

Backups run automatically:
- **Database**: Daily at 2:00 AM UTC
- **Application data**: Daily with database backup
- **Configuration**: Versioned in Git
- **Infrastructure**: Terraform state in S3

### Manual Backup

```bash
# Run immediate backup
./scripts/backup.sh

# Test backup and restore procedures
./scripts/backup.sh test

# Setup automated backup schedule
./scripts/backup.sh setup-cron
```

### Disaster Recovery

1. **RTO** (Recovery Time Objective): < 1 hour
2. **RPO** (Recovery Point Objective): < 15 minutes
3. **Multi-AZ deployment** for high availability
4. **Cross-region backups** for disaster recovery

---

## 🧪 Testing the Deployment

### Health Checks

```bash
# Application health
curl -f https://your-app-domain/api/health

# Database connectivity
curl -f https://your-app-domain/api/health/database

# Cache connectivity
curl -f https://your-app-domain/api/health/cache

# Security headers
curl -I https://your-app-domain/
```

### Load Testing

```bash
# Install k6 for load testing
npm install -g k6

# Run load tests
k6 run scripts/load-test.js
```

### Security Testing

```bash
# Run security scans
npm run test:security --workspace=@dwaybank/backend

# PCI DSS compliance check
npm run test:pci-compliance --workspace=@dwaybank/backend
```

---

## 🚨 Troubleshooting

### Common Issues

#### Deployment Failures
1. Check GitHub Actions logs
2. Verify AWS permissions
3. Check ECS service events
4. Review application logs

#### Database Connection Issues
1. Verify security group rules
2. Check database credentials
3. Test network connectivity
4. Review RDS logs

#### Performance Issues
1. Check Grafana dashboards
2. Review application metrics
3. Analyze database performance
4. Check Redis cache hit rates

### Log Locations

```bash
# Application logs
docker logs $(docker ps -q --filter name=dwaybank-backend)

# ECS service logs
aws logs get-log-events --log-group-name /ecs/dwaybank-backend

# Database logs
aws rds describe-db-log-files --db-instance-identifier dwaybank-production
```

### Emergency Procedures

#### Immediate Rollback
```bash
./scripts/deploy.sh rollback
```

#### Scale Down (Emergency)
```bash
aws ecs update-service \
  --cluster dwaybank-production \
  --service dwaybank-backend \
  --desired-count 0
```

#### Database Emergency Access
```bash
# Connect to production database (emergency only)
aws rds describe-db-instances --db-instance-identifier dwaybank-production
# Use connection details with psql
```

---

## 📈 Scaling Considerations

### Auto-Scaling Configuration

- **ECS Service**: Scales based on CPU/memory utilization
- **Database**: Read replicas for read scaling
- **Cache**: ElastiCache cluster mode for scaling
- **Load Balancer**: Automatically scales with traffic

### Manual Scaling

```bash
# Scale ECS service
aws ecs update-service \
  --cluster dwaybank-production \
  --service dwaybank-backend \
  --desired-count 5

# Scale RDS (requires downtime)
aws rds modify-db-instance \
  --db-instance-identifier dwaybank-production \
  --db-instance-class db.r5.xlarge \
  --apply-immediately
```

---

## 🎯 Performance Optimization

### Key Performance Targets

- **API Response Time**: < 200ms (95th percentile)
- **Page Load Time**: < 3s on 3G networks
- **Database Query Time**: < 100ms average
- **Cache Hit Rate**: > 95%
- **Uptime**: 99.95% (< 4.4 hours/year downtime)

### Monitoring Performance

1. **Real User Monitoring**: New Relic/Sentry integration
2. **Synthetic Monitoring**: Automated health checks
3. **Database Performance**: RDS Performance Insights
4. **Application Metrics**: Custom Prometheus metrics

---

## 🔧 Maintenance Procedures

### Regular Maintenance

#### Weekly
- Review security scan results
- Check backup integrity
- Update dependencies with security patches
- Review performance metrics

#### Monthly
- Rotate database passwords
- Update SSL certificates (if needed)
- Review and optimize costs
- Conduct disaster recovery tests

#### Quarterly
- Security penetration testing
- PCI DSS compliance audit
- Performance baseline review
- Infrastructure capacity planning

### Update Procedures

#### Application Updates
1. Update code in development
2. Run full test suite
3. Deploy to staging
4. Validate in staging
5. Deploy to production via CI/CD

#### Infrastructure Updates
1. Update Terraform configurations
2. Plan changes in staging
3. Apply to staging and validate
4. Apply to production during maintenance window

#### Security Updates
1. Immediate deployment for critical security patches
2. Use blue-green deployment for zero downtime
3. Validate security after deployment
4. Update security documentation

---

## 📞 Support & Escalation

### Support Contacts

- **DevOps Team**: devops@dwaybank.com
- **Security Team**: security@dwaybank.com
- **On-Call**: +1-XXX-XXX-XXXX

### Escalation Matrix

1. **Level 1**: Development team handles routine issues
2. **Level 2**: DevOps team for infrastructure issues
3. **Level 3**: Security team for security incidents
4. **Level 4**: External vendors for critical issues

### Incident Response

1. **Detection**: Automated alerts or manual reporting
2. **Assessment**: Determine severity and impact
3. **Response**: Implement immediate fixes
4. **Communication**: Update stakeholders
5. **Resolution**: Fix root cause
6. **Post-mortem**: Document lessons learned

---

## 📋 Compliance Checklist

### Pre-Production Checklist

- [ ] All security scans passed
- [ ] PCI DSS compliance validated
- [ ] Backup and recovery tested
- [ ] Monitoring and alerting configured
- [ ] Load testing completed
- [ ] Security headers implemented
- [ ] SSL certificates installed
- [ ] Database encryption enabled
- [ ] Access controls configured
- [ ] Audit logging enabled

### Post-Deployment Checklist

- [ ] Application health checks passing
- [ ] Database connectivity verified
- [ ] Cache functionality tested
- [ ] Monitoring dashboards updated
- [ ] Alerting rules triggered correctly
- [ ] Blue-green deployment tested
- [ ] Backup procedures validated
- [ ] Performance metrics baseline established
- [ ] Security scans re-run
- [ ] Documentation updated

---

## 🎉 Deployment Success!

Your DwayBank Smart Wallet is now deployed with:

✅ **Enterprise-grade infrastructure** on AWS  
✅ **Automated CI/CD pipeline** with quality gates  
✅ **Zero-downtime blue-green deployments**  
✅ **Comprehensive monitoring and alerting**  
✅ **PCI DSS compliant security**  
✅ **Automated backups and disaster recovery**  
✅ **Financial-grade observability**  

**Next Steps:**
1. Monitor the deployment through Grafana dashboards
2. Set up user acceptance testing
3. Plan go-live communication
4. Schedule regular maintenance windows
5. Conduct post-deployment security review

For questions or issues, contact the DevOps team or refer to the troubleshooting section above.

---

*Last updated: $(date)*  
*Deployment Guide Version: 1.0*