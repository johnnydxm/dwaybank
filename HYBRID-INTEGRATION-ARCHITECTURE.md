# DwayBank Hybrid Integration Architecture
**Backend Preservation + Frontend Adoption Strategy**

## Executive Summary

This document outlines the technical architecture for integrating DwayBank's proven Express.js authentication backend with a modern React frontend, following the approved **Backend Preservation + Frontend Adoption** strategy.

**Key Architecture Decisions:**
- ✅ **Preserve 95% complete Express.js backend** with JWT auth, MFA, PostgreSQL, Redis
- ✅ **Adopt modern React frontend** with ShadCN/UI, Vite, TypeScript
- ✅ **Implement monorepo structure** for scalable multi-package development
- ✅ **Integrate PGlite embedded database** for seamless frontend development
- ✅ **Deploy to Cloudflare Pages** for optimal performance and reliability

---

## 1. Project Structure Architecture

```
dwaybank/
├── packages/
│   ├── backend/                 # Existing Express.js backend (preserved)
│   │   ├── src/
│   │   │   ├── config/         # Database, env, logging, passport configs
│   │   │   ├── middleware/     # Auth, MFA, session, validation middleware
│   │   │   ├── routes/         # Auth routes, MFA routes
│   │   │   ├── services/       # Business logic services
│   │   │   ├── types/          # TypeScript type definitions
│   │   │   └── server.ts       # Express server entry point
│   │   ├── database/           # PostgreSQL schema & migrations
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── frontend/               # New React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/     # React components (ShadCN/UI)
│   │   │   │   ├── ui/         # Base UI components
│   │   │   │   ├── auth/       # Authentication components
│   │   │   │   ├── wallet/     # Wallet management components
│   │   │   │   └── dashboard/  # Dashboard components
│   │   │   ├── pages/          # Page components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities and API client
│   │   │   │   ├── api.ts      # API client for backend communication
│   │   │   │   ├── auth.ts     # Authentication utilities
│   │   │   │   └── validation.ts # Form validation schemas
│   │   │   ├── stores/         # Zustand state management
│   │   │   ├── styles/         # Tailwind CSS and global styles
│   │   │   └── types/          # Frontend-specific TypeScript types
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── shared/                 # Shared TypeScript types and utilities
│   │   ├── types/
│   │   │   ├── auth.types.ts   # Authentication type definitions
│   │   │   ├── user.types.ts   # User and profile types
│   │   │   ├── api.types.ts    # API request/response types
│   │   │   └── index.ts        # Type exports
│   │   ├── utils/
│   │   │   ├── validation.ts   # Shared validation schemas
│   │   │   └── constants.ts    # Shared constants
│   │   └── package.json
│   │
│   └── mobile/                 # Future React Native app
│       └── (Future implementation)
│
├── tools/                      # Development and build tools
│   ├── eslint-config/         # Shared ESLint configuration
│   ├── typescript-config/     # Shared TypeScript configuration
│   └── scripts/               # Build and deployment scripts
│
├── docs/                      # Architecture and API documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # Technical architecture docs
│   └── deployment/            # Deployment guides
│
├── .github/                   # GitHub Actions CI/CD
│   └── workflows/
│       ├── backend-ci.yml     # Backend testing and deployment
│       ├── frontend-ci.yml    # Frontend testing and deployment
│       └── integration-test.yml # Full stack integration tests
│
├── package.json               # Root package.json (workspace configuration)
├── pnpm-workspace.yaml       # PNPM workspace configuration
├── turbo.json                # Turborepo configuration for build optimization
└── README.md                 # Updated project documentation
```

---

## 2. Frontend Architecture Specification

### 2.1 Technology Stack

```typescript
// Frontend Technology Stack
{
  "runtime": "React 19 + TypeScript 5.3+",
  "bundler": "Vite 5.0+ with HMR",
  "ui_library": "ShadCN/UI + Radix primitives",
  "styling": "Tailwind CSS 3.4+",
  "state_management": {
    "server": "React Query (TanStack Query) v5",
    "client": "Zustand 4.4+",
    "forms": "React Hook Form + Zod validation"
  },
  "routing": "React Router v6",
  "build_optimization": "Vite + SWC for fast builds",
  "development_db": "PGlite (embedded PostgreSQL)"
}
```

### 2.2 Component Architecture

```typescript
// Component Organization Strategy
src/components/
├── ui/                    // Base ShadCN/UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── form.tsx
│   └── ...
├── auth/                  // Authentication components
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── MFASetup.tsx
│   ├── MFAVerification.tsx
│   └── PasswordReset.tsx
├── wallet/               // Wallet management components
│   ├── WalletCard.tsx
│   ├── WalletConnect.tsx
│   ├── BalanceDisplay.tsx
│   └── TransactionHistory.tsx
├── dashboard/            // Dashboard components
│   ├── DashboardLayout.tsx
│   ├── StatsCards.tsx
│   ├── RecentActivity.tsx
│   └── QuickActions.tsx
└── layout/              // Layout components
    ├── AppLayout.tsx
    ├── Sidebar.tsx
    ├── Header.tsx
    └── Footer.tsx
```

### 2.3 State Management Architecture

```typescript
// Zustand Store Structure
stores/
├── authStore.ts          // Authentication state
├── userStore.ts          // User profile and preferences  
├── walletStore.ts        // Wallet balances and connections
├── uiStore.ts           // UI state (modals, loading, etc.)
└── index.ts             // Store exports and providers

// Example Auth Store
interface AuthState {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  verifyMFA: (request: MFAVerificationRequest) => Promise<void>;
}
```

---

## 3. Backend Integration Layer

### 3.1 API Client Architecture

```typescript
// lib/api.ts - Centralized API client
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

class APIClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
      timeout: 10000,
      withCredentials: true, // Include cookies for session management
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use((config) => {
      const { tokens } = useAuthStore.getState();
      if (tokens?.access_token) {
        config.headers.Authorization = `Bearer ${tokens.access_token}`;
      }
      return config;
    });
    
    // Response interceptor - Handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const { refreshToken, logout } = useAuthStore.getState();
          try {
            await refreshToken();
            return this.client.request(error.config);
          } catch (refreshError) {
            logout();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }
  
  // Authentication methods
  auth = {
    login: (credentials: LoginCredentials) => 
      this.client.post<LoginResponse>('/api/auth/login', credentials),
    
    register: (userData: RegisterInput) => 
      this.client.post<RegisterResponse>('/api/auth/register', userData),
    
    logout: () => 
      this.client.post('/api/auth/logout'),
    
    refreshToken: () => 
      this.client.post<AuthTokens>('/api/auth/refresh'),
    
    me: () => 
      this.client.get<UserProfile>('/api/auth/me'),
  };
  
  // MFA methods
  mfa = {
    setup: (request: MFASetupRequest) => 
      this.client.post<MFASetupResponse>('/api/mfa/setup', request),
    
    verify: (request: MFAVerificationRequest) => 
      this.client.post<MFAVerificationResponse>('/api/mfa/verify', request),
    
    disable: (method: MFAMethod) => 
      this.client.delete(`/api/mfa/${method}`),
  };
}

export const apiClient = new APIClient();
```

### 3.2 React Query Integration

```typescript
// hooks/useAuth.ts - Authentication hooks with React Query
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export const useLogin = () => {
  const queryClient = useQueryClient();
  const { setAuth, setMFARequired } = useAuthStore();
  
  return useMutation({
    mutationFn: apiClient.auth.login,
    onSuccess: (response) => {
      const { user, tokens, mfa_required } = response.data;
      
      if (mfa_required) {
        setMFARequired(true);
      } else {
        setAuth(user, tokens);
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }
    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });
};

export const useProfile = () => {
  const { isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => apiClient.auth.me(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### 3.3 Backend CORS Configuration Enhancement

```typescript
// backend/src/config/cors.ts - Enhanced CORS for frontend integration
import cors from 'cors';

const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',     // Vite dev server
      'http://localhost:4173',     // Vite preview
      'https://dwaybank.pages.dev', // Cloudflare Pages
      'https://app.dwaybank.com',   // Production domain
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

export default cors(corsOptions);
```

---

## 4. Development Environment Setup

### 4.1 PGlite Integration for Frontend Development

```typescript
// frontend/src/lib/dev-database.ts - Embedded PostgreSQL for development
import { PGlite } from '@electric-sql/pglite';

class DevDatabase {
  private db: PGlite | null = null;
  
  async initialize() {
    if (import.meta.env.MODE !== 'development') return;
    
    this.db = new PGlite('idb://dwaybank-dev');
    
    // Initialize schema
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        session_id VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Seed development data
    await this.seedData();
  }
  
  private async seedData() {
    const existingUsers = await this.db!.query('SELECT COUNT(*) FROM users');
    if (existingUsers.rows[0].count > 0) return;
    
    await this.db!.exec(`
      INSERT INTO users (email, first_name, last_name, status) VALUES
      ('dev@dwaybank.com', 'Dev', 'User', 'active'),
      ('test@dwaybank.com', 'Test', 'User', 'active');
    `);
  }
  
  async query(sql: string, params?: any[]) {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.query(sql, params);
  }
}

export const devDatabase = new DevDatabase();
```

### 4.2 Workspace Configuration

```json
// package.json - Root workspace configuration
{
  "name": "dwaybank-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "packageManager": "pnpm@8.15.0",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules",
    "backend:dev": "pnpm --filter backend dev",
    "frontend:dev": "pnpm --filter frontend dev",
    "shared:build": "pnpm --filter shared build"
  },
  "devDependencies": {
    "turbo": "^1.12.0",
    "@dwaybank/eslint-config": "workspace:*",
    "@dwaybank/typescript-config": "workspace:*"
  }
}
```

```yaml
# pnpm-workspace.yaml - PNPM workspace configuration
packages:
  - 'packages/*'
  - 'tools/*'
```

```json
// turbo.json - Build optimization configuration
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

### 4.3 Frontend Package Configuration

```json
// packages/frontend/package.json
{
  "name": "@dwaybank/frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.15.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "axios": "^1.6.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.294.0",
    "@electric-sql/pglite": "^0.1.0",
    "@dwaybank/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react-swc": "^3.5.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@dwaybank/eslint-config": "workspace:*",
    "@dwaybank/typescript-config": "workspace:*"
  }
}
```

---

## 5. Authentication Flow Integration

### 5.1 Frontend Authentication Components

```typescript
// components/auth/LoginForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useLogin } from '../../hooks/useAuth';
import { LoginCredentials } from '@dwaybank/shared/types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember_me: z.boolean().optional(),
});

export const LoginForm = () => {
  const { mutate: login, isPending, error } = useLogin();
  const [showMFA, setShowMFA] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
  });
  
  const onSubmit = (data: LoginCredentials) => {
    login(data, {
      onSuccess: (response) => {
        if (response.data.mfa_required) {
          setShowMFA(true);
        }
      },
    });
  };
  
  if (showMFA) {
    return <MFAVerificationForm />;
  }
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In to DwayBank</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              {...register('email')}
              type="email"
              placeholder="Email address"
              disabled={isPending}
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>
          
          <div>
            <Input
              {...register('password')}
              type="password"
              placeholder="Password"
              disabled={isPending}
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>
          
          <div className="flex items-center">
            <input
              {...register('remember_me')}
              type="checkbox"
              id="remember_me"
              className="mr-2"
            />
            <label htmlFor="remember_me" className="text-sm">
              Remember me
            </label>
          </div>
          
          {error && (
            <p className="text-sm text-red-600">
              {error.response?.data?.message || 'Login failed'}
            </p>
          )}
          
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

### 5.2 MFA Integration Component

```typescript
// components/auth/MFAVerificationForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useMFAVerification } from '../../hooks/useAuth';
import { MFAVerificationRequest } from '@dwaybank/shared/types';

export const MFAVerificationForm = () => {
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'sms'>('totp');
  const { mutate: verifyMFA, isPending } = useMFAVerification();
  
  const { register, handleSubmit, formState: { errors } } = useForm<{
    code: string;
  }>();
  
  const onSubmit = (data: { code: string }) => {
    const request: MFAVerificationRequest = {
      method: selectedMethod,
      code: data.code,
    };
    
    verifyMFA(request);
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Button
              type="button"
              variant={selectedMethod === 'totp' ? 'default' : 'outline'}
              onClick={() => setSelectedMethod('totp')}
              className="flex-1"
            >
              Authenticator App
            </Button>
            <Button
              type="button"
              variant={selectedMethod === 'sms' ? 'default' : 'outline'}
              onClick={() => setSelectedMethod('sms')}
              className="flex-1"
            >
              SMS Code
            </Button>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                {...register('code', { 
                  required: 'Verification code is required',
                  pattern: {
                    value: /^\d{6}$/,
                    message: 'Code must be 6 digits'
                  }
                })}
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                disabled={isPending}
              />
              {errors.code && (
                <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>
              )}
            </div>
            
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Verifying...' : 'Verify Code'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 6. Security Implementation

### 6.1 CSRF Protection Enhancement

```typescript
// backend/src/middleware/csrf.middleware.ts
import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for API endpoints that use JWT
  if (req.path.startsWith('/api/') && req.headers.authorization) {
    return next();
  }
  
  return csrfProtection(req, res, next);
};

// CSRF token endpoint for frontend
export const getCsrfToken = (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
};
```

### 6.2 Frontend Security Headers

```typescript
// frontend/src/lib/security.ts
export const securityHeaders = {
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
    connect-src 'self' ${import.meta.env.VITE_API_BASE_URL};
  `.replace(/\s+/g, ' ').trim(),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

---

## 7. Deployment Strategy

### 7.1 Cloudflare Pages Configuration

```typescript
// wrangler.toml - Cloudflare Pages configuration
name = "dwaybank-frontend"
compatibility_date = "2024-01-01"

[build]
command = "pnpm build"
cwd = "packages/frontend"
publish = "packages/frontend/dist"

[env.production.vars]
VITE_API_BASE_URL = "https://api.dwaybank.com"
VITE_APP_ENV = "production"

[env.preview.vars]
VITE_API_BASE_URL = "https://api-staging.dwaybank.com"
VITE_APP_ENV = "preview"
```

### 7.2 GitHub Actions CI/CD

```yaml
# .github/workflows/frontend-deploy.yml
name: Frontend Deploy

on:
  push:
    branches: [main]
    paths: ['packages/frontend/**', 'packages/shared/**']
  pull_request:
    paths: ['packages/frontend/**', 'packages/shared/**']

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Type check
        run: pnpm turbo type-check --filter=frontend
        
      - name: Lint
        run: pnpm turbo lint --filter=frontend
        
      - name: Test
        run: pnpm turbo test --filter=frontend
        
      - name: Build
        run: pnpm turbo build --filter=frontend
        
      - name: Deploy to Cloudflare Pages
        if: github.ref == 'refs/heads/main'
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: dwaybank-frontend
          directory: packages/frontend/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### 7.3 Backend Deployment (Railway/Render)

```yaml
# .github/workflows/backend-deploy.yml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths: ['packages/backend/**', 'packages/shared/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Railway
        uses: railwayapp/railway-deploy@v1.0.0
        with:
          api-token: ${{ secrets.RAILWAY_API_TOKEN }}
          project-id: ${{ secrets.RAILWAY_PROJECT_ID }}
          service-name: dwaybank-backend
```

---

## 8. Development Workflow

### 8.1 Getting Started Commands

```bash
# Clone and setup monorepo
git clone https://github.com/dwaybank/dwaybank.git
cd dwaybank

# Install dependencies (root + all packages)
pnpm install

# Start development (backend + frontend in parallel)
pnpm dev

# Start individual services
pnpm backend:dev    # Backend on :3000
pnpm frontend:dev   # Frontend on :5173

# Build all packages
pnpm build

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### 8.2 Development Environment URLs

```
Frontend Development: http://localhost:5173
Backend API:         http://localhost:3000
API Documentation:   http://localhost:3000/docs (Future Swagger UI)
Database Admin:      Integrated in frontend dev tools
```

---

## 9. Component Extraction from Volo Builds

### 9.1 Useful Components to Extract

```typescript
// Priority components to extract and adapt:

1. Authentication Components:
   - LoginForm → Adapt for DwayBank JWT auth
   - SignupForm → Integrate with MFA setup
   - PasswordReset → Connect to existing backend

2. Dashboard Components:
   - DashboardLayout → Financial dashboard layout
   - StatsCards → Wallet balance cards
   - RecentActivity → Transaction history

3. Form Components:
   - FormWrapper → Consistent form styling
   - InputField → Form input with validation
   - SubmitButton → Loading states for forms

4. UI Components:
   - Modal → For MFA setup and confirmations
   - Toast → Success/error notifications
   - Loading → Consistent loading states
   - ErrorBoundary → Error handling
```

### 9.2 Adaptation Strategy

```typescript
// Extract components with proper TypeScript integration
// components/ui/form-wrapper.tsx - Adapted from Volo
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn } from '../../lib/utils';

interface FormWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const FormWrapper = ({ 
  title, 
  description, 
  children, 
  className,
  maxWidth = 'md'
}: FormWrapperProps) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg'
  };
  
  return (
    <Card className={cn(
      'w-full mx-auto',
      maxWidthClasses[maxWidth],
      className
    )}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};
```

---

## 10. Performance Optimization

### 10.1 Frontend Optimization

```typescript
// vite.config.ts - Optimized build configuration
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'query': ['@tanstack/react-query'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### 10.2 Bundle Size Optimization

```typescript
// Build analysis and optimization
{
  "scripts": {
    "analyze": "vite-bundle-analyzer dist",
    "build:analyze": "pnpm build && pnpm analyze"
  }
}

// Expected bundle sizes:
// Main bundle: ~150KB gzipped
// React vendor: ~45KB gzipped  
// UI components: ~25KB gzipped
// Total initial: ~220KB gzipped (target: <250KB)
```

---

## 11. Testing Strategy

### 11.1 Frontend Testing Setup

```typescript
// vitest.config.ts - Testing configuration
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 11.2 Integration Testing

```typescript
// Integration test example
// src/test/integration/auth-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from '../../components/auth/LoginForm';
import { server } from '../mocks/server';
import { rest } from 'msw';

describe('Authentication Flow', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });
  
  it('should handle successful login', async () => {
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          data: {
            user: { id: '1', email: 'test@example.com' },
            tokens: { access_token: 'token', refresh_token: 'refresh' },
            mfa_required: false,
          },
        }));
      })
    );
    
    render(
      <QueryClientProvider client={queryClient}>
        <LoginForm />
      </QueryClientProvider>
    );
    
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument();
    });
  });
});
```

---

## 12. Migration Strategy

### 12.1 Gradual Migration Plan

```
Phase 1 (Week 1-2): Infrastructure Setup
├── Set up monorepo structure
├── Configure build tools and CI/CD
├── Create shared type definitions
└── Set up development environment

Phase 2 (Week 3-4): Core Authentication
├── Build login/register forms
├── Integrate with existing JWT backend
├── Implement MFA components
└── Set up state management

Phase 3 (Week 5-6): Dashboard & Wallet Views
├── Create dashboard layout
├── Build wallet connection UI
├── Implement balance display
└── Add transaction history

Phase 4 (Week 7-8): Advanced Features
├── Risk controls interface
├── Transfer functionality
├── Settings and profile management
└── Mobile responsive optimization

Phase 5 (Week 9-10): Testing & Deployment
├── Comprehensive testing suite
├── Performance optimization
├── Security audit
└── Production deployment
```

### 12.2 Data Migration (If Needed)

```typescript
// No data migration required - backend database stays intact
// Frontend will connect to existing PostgreSQL + Redis setup
// PGlite only used for frontend development, not production
```

---

## Conclusion

This hybrid integration architecture provides:

✅ **Seamless Integration**: Modern React frontend with battle-tested Express backend  
✅ **Developer Experience**: Fast Vite builds, hot reload, embedded database for dev  
✅ **Production Ready**: Cloudflare deployment, comprehensive security, monitoring  
✅ **Scalable Structure**: Monorepo supporting future mobile app and microservices  
✅ **Type Safety**: End-to-end TypeScript with shared types between frontend/backend  
✅ **Security First**: JWT auth, MFA, CSRF protection, secure headers  
✅ **Performance Optimized**: Code splitting, caching, CDN delivery  

**Next Steps:**
1. Review and approve architecture with stakeholders
2. Set up monorepo structure and development environment  
3. Begin Phase 1: Infrastructure setup and tooling
4. Start extracting and adapting Volo Builds components
5. Implement authentication flow integration

The architecture preserves your proven 95% complete backend while providing a modern, scalable frontend that can evolve with DwayBank's growth from MVP to full banking platform.