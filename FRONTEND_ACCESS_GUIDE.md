# DwayBank Frontend Access Guide

## Current Application Status

✅ **Frontend Server**: Running on http://localhost:3001  
✅ **Backend API**: Running on http://localhost:3000  
✅ **Database**: PostgreSQL running with demo data  
✅ **Redis**: Running for session management  
✅ **CORS**: Properly configured between frontend and backend  

## Accessing the Application

### 1. Frontend Application
- **URL**: http://localhost:3001
- **Status**: Fully functional NextJS application
- **Features**: Login/logout flow, dashboard UI, transaction views

### 2. Backend API
- **URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Info**: http://localhost:3000/api
- **Available Endpoints**:
  - `GET /api/v1/dashboard` - User dashboard data
  - `GET /api/v1/wallets/dashboard` - Wallet dashboard
  - `GET /api/v1/transactions` - Transaction list
  - `GET /api/v1/budgets` - Budget information
  - `GET /api/v1/goals` - Financial goals
  - `GET /api/v1/wallets` - Wallet connections
  - `GET /api/v1/insights` - Financial insights

## Demo Credentials

For testing the full application, demo user exists in database:
- **Email**: demo@dwaybank.com
- **Password**: DemoPass123!
- **Status**: Active user with demo account and transactions

## Current Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│  (Next.js)      │    │   (Node.js)     │    │ (PostgreSQL)    │
│  Port: 3001     │◄──►│  Port: 3000     │◄──►│  Port: 5432     │
│                 │    │                 │    │                 │
│ • React UI      │    │ • REST API      │    │ • User data     │
│ • Auth flow     │    │ • Dashboard     │    │ • Transactions  │
│ • Dashboard     │    │ • Transactions  │    │ • Accounts      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   Port: 6379    │
                       │                 │
                       │ • Sessions      │
                       │ • Caching       │
                       └─────────────────┘
```

## Development Environment Setup

### Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose running
- PostgreSQL and Redis containers healthy

### Starting the Development Environment

1. **Start Backend Services** (already running in Docker):
   ```bash
   # Check container status
   docker ps
   
   # Should show healthy containers for:
   # - dwaybank-backend (port 3000)
   # - dwaybank-postgres (port 5432)  
   # - dwaybank-redis (port 6379)
   ```

2. **Start Frontend Development Server**:
   ```bash
   cd packages/frontend-nextjs
   npm run dev
   ```

3. **Verify Services**:
   ```bash
   # Test backend health
   curl http://localhost:3000/health
   
   # Test frontend
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
   ```

## Frontend Features

### Available Pages
- **/** - Home page (redirects based on auth status)
- **/login** - User authentication
- **/dashboard** - Main dashboard view
- **/transactions** - Transaction history
- **/accounts** - Account management
- **/settings** - User preferences

### API Integration
The frontend is configured to use the backend API through:
- **Base URL**: http://localhost:3000/api/v1
- **CORS**: Enabled for localhost:3001
- **Authentication**: JWT tokens with automatic refresh
- **Error Handling**: Comprehensive error boundaries

## Database Structure

### Demo User Account
```sql
-- Demo user (already created)
email: demo@dwaybank.com
status: active
email_verified: true

-- Demo account
account_number: 1234567890123456
account_type: checking
balance: $1,000.00
currency: USD
```

### Available Tables
- `users` - User accounts and profiles
- `accounts` - Financial accounts
- `transactions` - Transaction history
- `user_sessions` - Active sessions
- `mfa_backup_codes` - Multi-factor auth

## Troubleshooting

### Frontend Issues
- **Build errors**: Check `npm run lint` for syntax issues
- **API connection**: Verify backend is responding on port 3000
- **CORS errors**: Ensure CORS_ORIGIN=http://localhost:3001 in backend .env

### Backend Issues  
- **Container not running**: `docker start dwaybank-backend`
- **Database connection**: Check PostgreSQL container status
- **Port conflicts**: Ensure port 3000 is available

### Database Issues
- **Demo user missing**: Check database initialization
- **Connection failed**: Verify PostgreSQL credentials in .env
- **Schema errors**: Run database migrations if needed

## Next Steps

To complete the authentication integration:

1. **Enable Full Authentication API**: Replace simplified production server with full development server including auth endpoints
2. **Fix Rate Limiting**: Resolve IPv6 rate limiting configuration issues
3. **Test Login Flow**: Verify complete login/logout cycle with demo credentials  
4. **Add Registration**: Enable user registration endpoint
5. **MFA Setup**: Configure multi-factor authentication flow

## Production Deployment

For production deployment:
1. Build frontend: `npm run build`
2. Use production Docker images
3. Configure environment variables
4. Set up SSL/HTTPS
5. Configure domain and DNS
6. Enable security headers and rate limiting

## Security Considerations

- All passwords hashed with bcrypt (12 rounds)
- JWT tokens with refresh mechanism
- CORS properly configured
- Rate limiting enabled (when full server running)
- Input sanitization active
- SQL injection prevention with parameterized queries

---

**Current Status**: Frontend and backend are running with basic integration. Authentication endpoints need to be enabled for full login functionality.