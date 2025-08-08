# CLAUDE.md - DwayBank Infrastructure Rules

## 🏗️ **MANDATORY INFRASTRUCTURE PRINCIPLES**

### **NEVER BYPASS CONTAINER INFRASTRUCTURE**
**Rule**: Docker/container infrastructure is MANDATORY for all services - no exceptions

**Enforcement**:
- If Docker build fails → Fix Docker issue, never fall back to direct npm/node execution  
- If missing package-lock.json → Generate it properly within Docker context
- If environment issues → Fix configuration, never skip containerization
- If performance issues → Optimize containers, never bypass orchestration

**Violation Consequences**: Security degradation, production drift, compliance failures

---

## 🤖 **AGENT ORCHESTRATION MATRIX**

### **AUTO-ACTIVATION RULES**
| Scenario | Primary Agent | Secondary Agent | Auto-Trigger Keywords |
|----------|---------------|-----------------|----------------------|
| Docker Issues | `dwaybank-devops` | `dwaybank-security` | docker, container, compose, infrastructure |
| Infrastructure Problems | `dwaybank-devops` | `dwaybank-architect` | deployment, CI/CD, pipeline, build |
| Security Concerns | `dwaybank-security` | `dwaybank-devops` | auth, authentication, authorization, security |
| System Design | `dwaybank-architect` | `dwaybank-performance` | architecture, design, scalability, system |
| Performance Issues | `dwaybank-performance` | `dwaybank-architect` | slow, performance, optimization, bottleneck |

### **MANDATORY AGENT CONSULTATION**
**Before Any Infrastructure Decision**:
1. Auto-activate `dwaybank-devops` agent for deployment analysis
2. Consult `dwaybank-security` agent for security implications  
3. Get `dwaybank-architect` approval for system architecture changes
4. Use `dwaybank-qa` for quality gate validation

---

## 🚦 **8-STEP QUALITY GATES FRAMEWORK**

### **MANDATORY VALIDATION CYCLE**
**Every deployment MUST pass all 8 gates**:

1. **Container Build Gate**: Docker build success, Dockerfile validation
2. **Security Context Gate**: Non-root users, security policies, isolation  
3. **Service Health Gate**: All services healthy, dependencies resolved
4. **Network Security Gate**: Proper isolation, SSL/TLS, firewall rules
5. **Data Persistence Gate**: Volumes configured, backup operational
6. **Performance Gate**: Benchmarks met, resource limits enforced
7. **Monitoring Gate**: Metrics collection, logging, alerting active  
8. **Compliance Gate**: PCI DSS, SOX, GLBA requirements validated

**Failure Response**: Any gate failure BLOCKS deployment with specific remediation

---

## 🛡️ **SECURITY-FIRST ENFORCEMENT**

### **CONTAINER SECURITY MANDATORY**
- **User Context**: Never run as root, use dedicated user (dwaybank:1001)
- **File System**: Read-only root filesystem, specific mount points only
- **Network**: Isolated Docker networks, no host network mode
- **Resources**: CPU/memory limits enforced, no unlimited containers
- **Secrets**: Environment variables only, no hardcoded credentials

### **AUTHENTICATION/AUTHORIZATION FLOW**
```
Frontend (Container) → Nginx (SSL) → Backend (Container) → Database (Container)
     ↓                    ↓                    ↓                    ↓
  JWT Tokens         SSL Termination    bcrypt Hashing      Connection Pool
```

**Rule**: Every service MUST be containerized with proper security context

---

## 📊 **SERVICE INTERCONNECTION REQUIREMENTS**

### **MANDATORY DOCKER COMPOSE STACK**
```yaml
Required Services:
- nginx (reverse proxy, SSL termination)
- frontend (Next.js in container)  
- backend (Node.js API in container)
- postgres (database with connection pooling)
- redis (session management, caching)
- prometheus (metrics collection)
- grafana (monitoring dashboard)
```

### **NETWORK TOPOLOGY**
- **External**: Internet → Nginx (80/443)
- **Internal**: Services communicate via Docker network (172.20.0.0/16)
- **Database**: Internal network only, no external exposure
- **Monitoring**: Dedicated network segment for observability

---

## ⚡ **PERFORMANCE & SCALABILITY STANDARDS**

### **CONTAINER RESOURCE LIMITS**
```yaml
Backend API:
  cpu_limit: 1000m
  memory_limit: 512Mi
  replicas: 2

Frontend:
  cpu_limit: 500m  
  memory_limit: 256Mi
  replicas: 1

Database:
  cpu_limit: 2000m
  memory_limit: 1Gi
  connection_pool: 20
```

### **PERFORMANCE BENCHMARKS**
- API Response: <200ms average
- Database Queries: <100ms average
- Container Start: <30s from build
- Health Check: <5s response time

---

## 🔄 **CI/CD PIPELINE INTEGRATION**

### **AUTOMATED DEPLOYMENT FLOW**
1. **Code Commit** → GitHub webhook triggers pipeline
2. **Build Stage** → Docker images built and tested
3. **Security Scan** → Container vulnerability scanning
4. **Quality Gates** → All 8 validation steps executed
5. **Staging Deploy** → Full environment deployment test
6. **Production Deploy** → Blue/green deployment with rollback capability

### **DEPLOYMENT SCRIPTS**
- `deploy-secure-environment.sh` → Mandatory deployment script
- `validate-security.sh` → Security compliance validation  
- `test-authentication.sh` → Authentication system testing
- `health-check.sh` → Service health validation

---

## 📝 **TOKEN OPTIMIZATION RULES**

### **EFFICIENT AGENT USAGE**
- Use `--delegate` flag for parallel infrastructure tasks
- Use `--wave-mode` for complex multi-service deployments
- Use `--uc` (ultra-compressed) for large infrastructure outputs
- Batch multiple Docker operations in single agent calls

### **CONTEXT PRESERVATION**
- Document infrastructure decisions in permanent files
- Use TodoWrite for tracking multi-step infrastructure tasks
- Create audit trails for all deployment decisions
- Maintain architecture decision records (ADRs)

---

## 🎯 **COMPLIANCE & AUDIT REQUIREMENTS**

### **FINANCIAL SYSTEM STANDARDS**
- **PCI DSS Level 1**: Container security, network isolation, encryption
- **SOX Compliance**: Change management, audit trails, quality gates
- **GLBA**: Data protection, access controls, monitoring

### **AUDIT TRAIL REQUIREMENTS**
- All infrastructure changes logged and timestamped
- Agent decisions documented with reasoning
- Quality gate results stored for compliance review
- Performance metrics collected for operational analysis

---

## 🚨 **EMERGENCY PROCEDURES**

### **INFRASTRUCTURE FAILURE RESPONSE**
1. **Immediate**: Health check all containerized services
2. **Assessment**: Use dwaybank-devops agent for failure analysis
3. **Remediation**: Fix within container context, never bypass
4. **Validation**: All quality gates must pass before service restoration
5. **Documentation**: Root cause analysis and prevention measures

### **ROLLBACK PROCEDURES**
- **Blue/Green Deployment**: Instant rollback to previous container version
- **Database Migration**: Automated rollback scripts available
- **Configuration Changes**: Git-based configuration versioning
- **Monitoring**: Automated alerts for service degradation

---

## ✅ **SUCCESS METRICS**

### **INFRASTRUCTURE HEALTH INDICATORS**
- **Container Health**: 100% of services containerized
- **Security Posture**: All security contexts properly configured
- **Performance**: All benchmarks met consistently  
- **Monitoring**: Full observability stack operational
- **Quality**: Zero quality gate bypasses
- **Compliance**: All regulatory requirements satisfied

### **AGENT EFFICIENCY METRICS**
- **Response Time**: Infrastructure agents respond <30s
- **Task Completion**: >95% success rate for infrastructure tasks
- **Token Efficiency**: <50% token usage through proper agent orchestration
- **Quality**: Zero infrastructure bypass incidents

---

**REMEMBER**: DwayBank's Docker infrastructure is world-class and MUST be utilized. Never bypass containers for convenience - always fix the underlying issue and maintain our security, scalability, and compliance standards.