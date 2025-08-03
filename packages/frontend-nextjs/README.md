# DwayBank Next.js Frontend

Modern Next.js frontend application for DwayBank smart wallet platform.

## Migration Complete ✅

This is the new production-ready frontend that replaces the Vite-based frontend. It resolves all configuration issues and provides a better developer experience.

## Features

- **Next.js 15** with App Router for SSR and optimal performance
- **ShadcnUI** component library for consistent, accessible UI
- **TypeScript** for type safety
- **Tailwind CSS v4** for modern styling
- **Authentication** with JWT tokens and MFA support
- **Responsive Design** with mobile-first approach
- **Accessibility** compliant with WCAG guidelines

## Quick Start

### Development

```bash
# Start development server
npm run dev

# Start both backend and frontend
cd ../.. && npm run dev
```

The application will be available at:
- Frontend: http://localhost:3002
- Backend API: http://localhost:3004

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page
│   ├── login/            # Login page  
│   ├── register/         # Registration page
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Home page (redirects)
├── components/
│   ├── auth/             # Authentication components
│   ├── mobile/           # Mobile navigation
│   └── ui/               # ShadcnUI components
├── hooks/
│   └── useAuth.ts        # Authentication hook
├── lib/
│   ├── api.ts            # API client
│   └── utils.ts          # Utility functions
└── types/
    ├── auth.ts           # Authentication types
    └── financial.ts      # Financial data types
```

## Authentication Flow

1. **Public Routes**: Login, Register (redirect if authenticated)
2. **Protected Routes**: Dashboard, Settings (redirect if not authenticated)
3. **JWT Tokens**: Access token with automatic refresh
4. **MFA Support**: Two-factor authentication flow

## API Integration

The frontend connects to the backend API at `http://localhost:3004/api/v1`:

- **Authentication**: Login, register, MFA verification
- **User Management**: Profile, password changes
- **Financial Data**: Accounts, transactions, wallets
- **Security**: Session management, device tracking

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3004/api/v1
```

## Differences from Vite Frontend

### ✅ Resolved Issues

- **No Configuration Errors**: Next.js handles all build configuration
- **ShadcnUI Integration**: Professional component library instead of custom components
- **SSR Support**: Server-side rendering for better performance
- **Production Ready**: Zero configuration production builds
- **Better Developer Experience**: Hot reload, error overlay, debugging

### 🔄 Migration Benefits

- **Faster Development**: No configuration troubleshooting
- **Better Performance**: SSR, automatic optimization
- **Professional UI**: Consistent, accessible components
- **Type Safety**: Full TypeScript integration
- **Modern Stack**: Latest React patterns and Next.js features
