# DwayBank Technical Architecture

## System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    DwayBank Smart Wallet                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                             │
│  • Authentication UI • Dashboard • Wallet Management       │
├─────────────────────────────────────────────────────────────┤
│  Backend API (Hono.js + TypeScript)                        │
│  • Auth Services • MFA • KYC/AML • Risk Management        │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  • PostgreSQL (Primary) • Redis (Sessions/Cache)          │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure
```
dwaybank-monorepo/
├── packages/
│   ├── backend/           # Hono.js API server
│   └── frontend/          # React application
├── src/                   # Legacy Express.js code (to be migrated)
├── database/              # SQL migrations and schemas
├── docs/                  # Technical documentation
├── docker-compose.yml     # Container orchestration
└── .agent-os/            # Agent OS integration
    ├── product/          # Product documentation
    └── specs/            # Feature specifications
```

## Backend Architecture (Hono.js)
```
packages/backend/src/
├── config/              # Configuration management
│   ├── database.ts      # PostgreSQL & Redis setup
│   ├── environment.ts   # Environment validation
│   ├── logger.ts        # Winston logging
│   └── auth.ts          # Authentication strategies
├── middleware/          # Hono middleware
│   ├── auth.middleware.ts
│   ├── mfa.middleware.ts
│   ├── security.middleware.ts
│   └── validation.middleware.ts
├── routes/              # API endpoints
│   ├── auth.routes.ts
│   ├── mfa.routes.ts
│   └── index.ts
├── services/            # Business logic
│   ├── auth.service.ts
│   ├── jwt.service.ts
│   ├── mfa.service.ts
│   ├── security.service.ts
│   └── user.service.ts
├── types/               # TypeScript definitions
├── test/                # Test suites
└── app.ts               # Hono application entry point
```

## Hono.js Architecture Benefits
- **Performance**: Faster than Express.js with better TypeScript support
- **Type Safety**: Built-in TypeScript support with excellent type inference
- **Modern APIs**: Native support for modern web standards
- **Middleware**: Clean middleware system with better composition
- **Edge Runtime**: Compatible with edge runtimes (Cloudflare Workers, etc.)
- **Small Bundle**: Lightweight with minimal dependencies

## Migration Strategy (Express.js → Hono.js)
1. **Gradual Migration**: Keep existing Express.js code in `src/` while building new Hono.js backend in `packages/backend/`
2. **Route-by-Route**: Migrate routes incrementally starting with authentication
3. **Middleware Adaptation**: Convert Express middleware to Hono middleware
4. **Testing Parity**: Ensure all tests pass for migrated routes
5. **Performance Validation**: Verify performance improvements

## Database Schema
- **users**: User accounts and profiles
- **sessions**: Session management with Redis TTL
- **mfa_tokens**: Multi-factor authentication tokens
- **kyc_data**: KYC/AML compliance data
- **audit_logs**: Security and transaction audit trail

## Security Architecture
- **Authentication**: JWT with RS256 signing + refresh token rotation
- **Session Management**: Redis with configurable TTL
- **Rate Limiting**: Hono-compatible rate limiting middleware
- **Input Validation**: Zod schema validation (Hono-native)
- **Security Headers**: Custom security middleware for Hono
- **Audit Trail**: Comprehensive logging with PostgreSQL triggers

## Performance Targets (Hono.js)
- **API Response**: <150ms average (improved from Express.js)
- **Database Queries**: <50ms average
- **Authentication**: <80ms average (improved from Express.js)
- **Memory Usage**: <400MB per service (reduced from Express.js)
- **Concurrent Users**: 1500+ supported (increased capacity)

## Deployment Architecture
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis for sessions and application cache
- **Monitoring**: Winston logging with daily rotation
- **Health Checks**: Automated service health monitoring
- **Edge Deployment**: Optional Cloudflare Workers deployment