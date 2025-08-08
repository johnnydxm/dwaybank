# DwayBank Smart Wallet

**Unified Financial Management Platform with AI-Powered Risk Controls**

## Overview

DwayBank Smart Wallet is a comprehensive financial management platform that aggregates traditional payment methods with cryptocurrency wallets, providing AI-powered risk controls and regulatory compliance monitoring. The platform offers a unified interface for managing diverse financial assets while maintaining strict security and compliance standards.

## Key Features

### ✅ Completed Features (Phase 0)

- **Authentication System**: OAuth 2.0 + OpenID Connect with multi-factor authentication
- **Security Hardening**: OWASP compliance with comprehensive audit logging
- **Database Infrastructure**: PostgreSQL with Redis for session management
- **API Foundation**: Express.js backend with TypeScript and comprehensive testing
- **Frontend Framework**: React 19 with Next.js, Tailwind CSS, and Radix UI
- **Containerization**: Docker setup with multiple environment configurations
- **Monitoring**: Grafana/Prometheus monitoring with custom dashboards
- **Testing Suite**: 80%+ coverage with Jest, Playwright, and Vitest

### 🔄 Current Development (Phase 1)

- **Wallet Aggregation System**: Integration of multiple payment methods
- **Risk Management Engine**: AI-powered risk assessment and controls
- **Compliance Monitoring**: Real-time regulatory compliance tracking
- **Mobile App Backend**: Support for mobile application development

### 📋 Planned Features

- **Smart Controls**: Automated financial decision-making
- **Analytics Dashboard**: Comprehensive financial insights
- **Third-party Integrations**: Banking and crypto exchange APIs
- **Advanced Security**: Biometric authentication and fraud detection

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with security middleware
- **Database**: PostgreSQL 15 with connection pooling
- **Cache**: Redis 7 for sessions and caching
- **Authentication**: JWT with refresh token rotation
- **Security**: Helmet, CORS, rate limiting, encryption

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite and Next.js 15
- **Styling**: Tailwind CSS 4 with Radix UI components
- **State Management**: React Hook Form with Zod validation
- **Testing**: Vitest and Playwright for E2E testing

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development
- **Monitoring**: Grafana/Prometheus with custom dashboards
- **CI/CD**: GitHub Actions with comprehensive testing
- **Deployment**: Terraform for infrastructure as code

## Architecture

### Monorepo Structure
```
dwaybank/
├── packages/
│   ├── backend/          # Express.js API with TypeScript
│   ├── frontend/         # React + Vite application
│   └── frontend-nextjs/  # Next.js application
├── database/             # PostgreSQL migrations and schema
├── docker/              # Docker configurations
├── infrastructure/      # Terraform configurations
└── monitoring/         # Grafana/Prometheus setup
```

### Security Architecture
- **Multi-Factor Authentication**: TOTP, SMS, Email, Biometric
- **Session Management**: Redis-based with TTL and rotation
- **Audit Logging**: Comprehensive security event tracking
- **Rate Limiting**: IP-based and endpoint-specific limits
- **Input Validation**: Joi schemas and Zod validation

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| API Response Time | <200ms | ✅ Configured |
| Database Queries | <50ms | ✅ Optimized |
| Authentication | <100ms | ⏳ In Development |
| Memory Usage | <512MB | ✅ Monitored |
| Concurrent Users | 1000+ | ⏳ Load Testing TBD |

## Development Workflow

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Quick Start
```bash
# Clone and setup
git clone https://github.com/johnnydxm/dwaybank.git
cd dwaybank
npm install

# Start with Docker
npm run docker:run

# Or manual setup
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run test suite
- `npm run docker:run` - Start Docker services
- `npm run lint` - Lint TypeScript files

## Contributing

### Code Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced with pre-commit hooks
- **Testing**: Required for all new features
- **Security**: OWASP compliance required

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with tests
3. Ensure all tests pass and coverage meets requirements
4. Submit pull request with detailed description
5. Code review and approval required
6. Merge to `main` with squash commit

## License

MIT License - See [LICENSE](../LICENSE) file for details.

---

**DwayBank Smart Wallet** - Unifying your financial world with intelligent controls and compliance built-in. 