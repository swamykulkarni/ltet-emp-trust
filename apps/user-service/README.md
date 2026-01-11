# User Service

The User Service is a core microservice in the LTET Employee Trust Portal that handles user authentication, profile management, and account security features.

## Features

### Authentication
- JWT-based authentication with refresh tokens
- Password policy enforcement
- Role-based access control (RBAC)
- Session management

### Account Security
- Account lockout after failed login attempts
- OTP-based account unlock via email/SMS
- Password change functionality
- Multi-factor authentication support

### Profile Management
- User profile CRUD operations
- HRMS integration for data synchronization
- Dependent management
- Bank account details with IFSC verification

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/verify-token` - Verify JWT token

### User Management
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/profile/sync-hrms` - Sync profile from HRMS
- `POST /api/users/dependents` - Add dependent
- `DELETE /api/users/dependents/:name` - Remove dependent
- `PUT /api/users/bank-details` - Update bank details
- `GET /api/users/verify-ifsc/:ifscCode` - Verify IFSC code

### Account Lockout
- `POST /api/lockout/request-unlock-otp` - Request unlock OTP
- `POST /api/lockout/unlock` - Unlock account with OTP
- `DELETE /api/lockout/:userId/clear` - Clear lockout (Admin)
- `GET /api/lockout/stats` - Get lockout statistics (Admin)

## Environment Variables

```env
USER_SERVICE_PORT=3001
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=ltet_portal

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# HRMS Integration
HRMS_BASE_URL=http://localhost:8080/hrms
HRMS_API_KEY=your-hrms-api-key
```

## Database Schema

The service uses PostgreSQL with the following main tables:
- `users` - User profiles and authentication data
- `user_dependents` - User dependent information

## Dependencies

- Express.js - Web framework
- PostgreSQL - Primary database
- Redis - Caching and session storage
- JWT - Authentication tokens
- bcryptjs - Password hashing
- Joi - Input validation

## Development

```bash
# Install dependencies
npm install

# Run tests
npm run test:user-service

# Start development server
npm run dev:user-service

# Build for production
npm run build:user-service
```

## Security Features

- Password complexity requirements
- Account lockout after 3 failed attempts
- JWT token expiration and refresh
- IFSC code verification for bank details
- Audit logging for all user actions
- Role-based access control

## Testing

The service includes comprehensive test coverage:
- Unit tests for all services
- Integration tests for API endpoints
- Property-based tests for critical functionality
- Mock implementations for external dependencies