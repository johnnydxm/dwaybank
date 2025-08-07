# Technology Stack

## Backend Stack

### Runtime & Framework
- **Node.js**: 18+ (LTS version)
- **TypeScript**: 5.3.3 with strict mode
- **Express.js**: 4.18.2 with security middleware
- **Nodemon**: 3.0.2 for development hot reload

### Database & Caching
- **PostgreSQL**: 15+ with connection pooling
- **Redis**: 7+ for session management and caching
- **pg-pool**: 3.6.1 for database connection pooling
- **connect-redis**: 7.1.0 for session storage

### Authentication & Security
- **JWT**: 9.0.2 with RS256 signing
- **bcryptjs**: 2.4.3 for password hashing
- **passport**: 0.7.0 with JWT and local strategies
- **speakeasy**: 2.0.0 for TOTP MFA
- **qrcode**: 1.5.3 for MFA QR codes
- **helmet**: 7.1.0 for security headers
- **express-rate-limit**: 7.1.5 for rate limiting
- **cors**: 2.8.5 for cross-origin requests

### Validation & Schema
- **Joi**: 17.13.3 for request validation
- **Zod**: 3.22.4 for TypeScript schema validation
- **validator**: 13.11.0 for data validation

### Utilities & Libraries
- **uuid**: 9.0.1 for unique identifiers
- **crypto-js**: 4.2.0 for encryption utilities
- **multer**: 1.4.5-lts.1 for file uploads
- **nodemailer**: 6.9.7 for email services
- **compression**: 1.7.4 for response compression

### Logging & Monitoring
- **winston**: 3.11.0 for structured logging
- **winston-daily-rotate-file**: 5.0.0 for log rotation
- **express-winston**: 4.2.0 for request logging

## Frontend Stack

### Core Framework
- **React**: 19.1.0 with TypeScript
- **React DOM**: 19.1.0
- **TypeScript**: 5.8.3 with strict mode

### Build Tools
- **Vite**: 7.0.4 for fast development and building
- **Next.js**: 15.4.5 for the Next.js frontend
- **PostCSS**: 8.5.6 for CSS processing
- **Autoprefixer**: 10.4.21 for CSS compatibility

### Styling & UI
- **Tailwind CSS**: 4.1.11 with PostCSS
- **Radix UI**: Comprehensive component library
  - @radix-ui/react-avatar: 1.1.10
  - @radix-ui/react-dialog: 1.1.14
  - @radix-ui/react-dropdown-menu: 2.1.15
  - @radix-ui/react-label: 2.1.7
  - @radix-ui/react-separator: 1.1.7
  - @radix-ui/react-slot: 1.2.3
  - @radix-ui/react-switch: 1.2.5
  - @radix-ui/react-toast: 1.2.7
  - @radix-ui/react-tooltip: 1.2.7
- **class-variance-authority**: 0.7.1 for component variants
- **clsx**: 2.1.1 for conditional classes
- **tailwind-merge**: 3.3.1 for class merging

### State Management & Forms
- **React Hook Form**: 7.49.2 for form management
- **@hookform/resolvers**: 3.3.2 for form validation
- **Zod**: 3.22.4 for schema validation

### HTTP Client
- **Axios**: 1.11.0 for API requests

### Utilities
- **date-fns**: 3.0.6 for date manipulation
- **lucide-react**: 0.534.0 for icons
- **next-themes**: 0.4.6 for theme management

## Testing Stack

### Backend Testing
- **Jest**: 29.7.0 for unit and integration testing
- **ts-jest**: 29.1.1 for TypeScript testing
- **supertest**: 6.3.3 for API testing
- **@types/jest**: 29.5.8 for TypeScript definitions

### Frontend Testing
- **Vitest**: 2.1.8 for unit testing
- **@vitest/ui**: 2.1.8 for test UI
- **@vitest/coverage-v8**: 2.1.8 for coverage
- **@testing-library/react**: 16.3.0 for component testing
- **@testing-library/jest-dom**: 6.6.4 for DOM testing
- **@testing-library/user-event**: 14.6.1 for user interactions

### E2E Testing
- **Playwright**: 1.54.2 for end-to-end testing
- **jsdom**: 26.1.0 for DOM simulation

## Development Tools

### Code Quality
- **ESLint**: 8.54.0 for code linting
- **@typescript-eslint/eslint-plugin**: 6.13.1
- **@typescript-eslint/parser**: 6.13.1
- **eslint-plugin-react-hooks**: 5.2.0
- **eslint-plugin-react-refresh**: 0.4.20

### TypeScript
- **TypeScript**: 5.3.3 with strict configuration
- **@types/node**: 20.10.4 for Node.js types
- **@types/react**: 19.1.8 for React types
- **@types/react-dom**: 19.1.6 for React DOM types

## Infrastructure Stack

### Containerization
- **Docker**: Multi-stage builds for production
- **Docker Compose**: Multiple environment configurations
  - Development: docker-compose.yml
  - Production: docker-compose.production.yml
  - Security: docker-compose.security.yml
  - Simple: docker-compose.simple.yml

### Monitoring & Observability
- **Grafana**: Custom dashboards for metrics
- **Prometheus**: Time-series database for metrics
- **Logstash**: Log aggregation and processing
- **Custom Alerts**: wallet-alerts.yml for monitoring

### Infrastructure as Code
- **Terraform**: Infrastructure provisioning
  - Environments: production, staging
  - Modules: networking, compute, storage
  - Variables: environment-specific configurations

### CI/CD
- **GitHub Actions**: Automated testing and deployment
- **Docker Registry**: Container image storage
- **Environment Management**: Multiple deployment environments

## Security Stack

### Authentication & Authorization
- **OAuth 2.0**: OpenID Connect implementation
- **JWT**: RS256 signing with refresh tokens
- **Multi-Factor Authentication**: TOTP, SMS, Email, Biometric
- **Session Management**: Redis-based with TTL

### Security Headers & Middleware
- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: IP and endpoint-based limits
- **Input Validation**: Joi and Zod schemas

### Encryption & Hashing
- **bcryptjs**: Password hashing
- **crypto-js**: Data encryption utilities
- **JWT**: Token encryption

### Audit & Compliance
- **Comprehensive Logging**: Winston with daily rotation
- **Audit Trails**: PostgreSQL triggers for data changes
- **Security Events**: Real-time security monitoring
- **Compliance Reporting**: Automated compliance checks

## Performance Stack

### Caching
- **Redis**: Session storage and application caching
- **Connection Pooling**: PostgreSQL connection optimization
- **CDN Ready**: Static asset optimization

### Optimization
- **Compression**: Response compression middleware
- **Bundle Optimization**: Vite and Next.js optimizations
- **Image Optimization**: Next.js image optimization
- **Code Splitting**: Dynamic imports for performance

### Monitoring
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Comprehensive error logging
- **Health Checks**: Service health monitoring
- **Load Testing**: Performance validation

## Version Compatibility

### Node.js Ecosystem
- **Node.js**: 18+ (LTS)
- **npm**: 9+ for package management
- **TypeScript**: 5.3.3 with strict mode

### Database Versions
- **PostgreSQL**: 15+ (recommended: 15.4+)
- **Redis**: 7+ (recommended: 7.2+)

### Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **Mobile**: iOS 14+, Android 10+
- **Progressive Enhancement**: Graceful degradation for older browsers

---

**Note**: This tech stack is actively maintained and updated. All versions are pinned for stability and security. Regular updates are performed through automated dependency management and security scanning. 