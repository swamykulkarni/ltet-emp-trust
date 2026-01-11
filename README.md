# LTET Employee Trust Portal

A comprehensive web-based platform designed to modernize the administration of 14 employee welfare schemes across Medical, Education, and Skill building categories for L&T Employee Trust.

## 🏗️ Architecture

The platform follows a microservices architecture with the following key components:

- **API Gateway**: Central entry point for all client requests
- **User Management Service**: Authentication, authorization, and profile management
- **Scheme Management Service**: Scheme configuration and eligibility management
- **Application Processing Service**: Application lifecycle and workflow management
- **Document Management Service**: File upload, validation, and OCR processing
- **Notification Service**: Multi-channel notifications (Email, SMS, In-app)
- **Web Application**: React/Next.js frontend application

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ltet-employee-trust-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp environments/.env.development .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   # Start database and cache services
   docker-compose up postgres redis -d
   
   # Run database migrations
   npm run db:migrate
   
   # Start all services in development mode
   npm run dev
   ```

5. **Access the application**
   - Web Application: http://localhost:4200
   - API Gateway: http://localhost:3000
   - API Documentation: http://localhost:3000/docs

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 📁 Project Structure

```
ltet-employee-trust-portal/
├── apps/                          # Application services
│   ├── api-gateway/              # API Gateway service
│   ├── user-service/             # User management service
│   ├── scheme-service/           # Scheme management service
│   ├── application-service/      # Application processing service
│   ├── document-service/         # Document management service
│   ├── notification-service/     # Notification service
│   └── web-app/                  # React/Next.js web application
├── libs/                         # Shared libraries
│   └── shared/
│       ├── types/                # TypeScript type definitions
│       ├── utils/                # Utility functions
│       ├── validation/           # Validation schemas
│       └── constants/            # Application constants
├── docker/                       # Docker configuration
├── environments/                 # Environment configurations
├── .github/workflows/            # CI/CD pipelines
└── docs/                         # Documentation
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev                       # Start all services in development mode
npm run dev:api-gateway          # Start API Gateway only
npm run dev:user-service         # Start User Service only
npm run dev:web-app              # Start Web App only

# Building
npm run build                    # Build all applications
npm run build:api-gateway        # Build API Gateway only

# Testing
npm run test                     # Run all tests
npm run test:unit                # Run unit tests only
npm run test:integration         # Run integration tests
npm run test:e2e                 # Run end-to-end tests
npm run test:pbt                 # Run property-based tests

# Code Quality
npm run lint                     # Lint all code
npm run lint:fix                 # Fix linting issues
npm run type-check               # TypeScript type checking

# Database
npm run db:migrate               # Run database migrations
npm run db:seed                  # Seed database with test data
npm run db:reset                 # Reset database

# Docker
npm run docker:build            # Build Docker images
npm run docker:up               # Start Docker services
npm run docker:down             # Stop Docker services
```

### Code Generation

```bash
# Generate new service
npx nx g @nx/node:application my-service

# Generate new library
npx nx g @nx/js:library my-lib

# Generate new React component
npx nx g @nx/react:component my-component --project=web-app
```

## 🧪 Testing

The project uses a comprehensive testing strategy:

### Unit Tests
- **Framework**: Jest
- **Coverage**: 85% minimum
- **Location**: `*.spec.ts` files alongside source code

### Property-Based Tests
- **Framework**: fast-check
- **Purpose**: Validate universal properties across all inputs
- **Configuration**: Minimum 100 iterations per property

### Integration Tests
- **Framework**: Jest + Supertest
- **Purpose**: Test service interactions and API endpoints
- **Location**: `tests/integration/`

### End-to-End Tests
- **Framework**: Playwright
- **Purpose**: Test complete user workflows
- **Location**: `tests/e2e/`

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- user.service.spec.ts

# Run property-based tests
npm run test:pbt
```

## 🔧 Configuration

### Environment Variables

The application uses environment-specific configuration files:

- `environments/.env.development` - Development environment
- `environments/.env.staging` - Staging environment  
- `environments/.env.production` - Production environment

Key configuration categories:

- **Database**: PostgreSQL connection and pool settings
- **Cache**: Redis configuration
- **Security**: JWT secrets, encryption keys
- **External Services**: HRMS, SAP, Payment Gateway APIs
- **File Storage**: AWS S3 or local storage configuration
- **Notifications**: Email and SMS service configuration

### Feature Flags

```bash
FEATURE_AI_RECOMMENDATIONS=true
FEATURE_AUTO_APPROVAL=false
FEATURE_OCR_VALIDATION=true
FEATURE_REAL_TIME_NOTIFICATIONS=true
```

## 🚀 Deployment

### Staging Deployment

Automatic deployment to staging occurs on pushes to `develop` branch:

```bash
git push origin develop
```

### Production Deployment

Automatic deployment to production occurs on pushes to `main` branch:

```bash
git push origin main
```

### Manual Deployment

```bash
# Build production images
npm run docker:build

# Deploy to AWS ECS
aws ecs update-service --cluster ltet-production --service ltet-service --force-new-deployment
```

## 📊 Monitoring

### Health Checks

- **Endpoint**: `/health`
- **Metrics**: `/metrics` (Prometheus format)
- **Status**: Service status and dependencies

### Logging

- **Format**: JSON (production), Combined (development)
- **Levels**: error, warn, info, debug
- **Retention**: 30 days (staging), 7 years (production)

### Performance Monitoring

- **APM**: Application Performance Monitoring enabled
- **Metrics**: Response times, error rates, throughput
- **Alerts**: Automated alerts for SLA breaches

## 🔒 Security

### Authentication & Authorization

- **JWT**: JSON Web Tokens for stateless authentication
- **RBAC**: Role-based access control
- **MFA**: Multi-factor authentication for elevated roles

### Data Protection

- **Encryption**: AES-256 at rest, TLS 1.2+ in transit
- **PII**: Personal data encryption and masking
- **Audit**: Comprehensive audit trails

### Security Headers

- **HTTPS**: Enforced in production
- **HSTS**: HTTP Strict Transport Security
- **CSP**: Content Security Policy
- **CORS**: Cross-Origin Resource Sharing controls

## 📚 API Documentation

Interactive API documentation is available at:

- **Development**: http://localhost:3000/docs
- **Staging**: https://api-staging.ltet.com/docs
- **Production**: https://api.ltet.com/docs

### Key API Endpoints

```
POST   /auth/login              # User authentication
GET    /users/profile           # Get user profile
GET    /schemes                 # List available schemes
POST   /applications            # Submit application
GET    /applications/:id        # Get application details
POST   /documents/upload        # Upload documents
GET    /notifications           # Get notifications
```

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm run test
   npm run lint
   ```

3. **Commit changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add/update tests for new features
4. Request review from team members
5. Address review feedback
6. Merge after approval

## 📞 Support

### Development Team

- **Tech Lead**: [Name] - [email]
- **Backend Team**: [Names] - [emails]
- **Frontend Team**: [Names] - [emails]
- **DevOps Team**: [Names] - [emails]

### Issue Reporting

- **Bug Reports**: Use GitHub Issues with bug template
- **Feature Requests**: Use GitHub Issues with feature template
- **Security Issues**: Email security@ltet.com

### Documentation

- **Technical Docs**: `/docs` directory
- **API Docs**: Available at `/docs` endpoint
- **User Guides**: Available in application help section

## 📄 License

This project is proprietary software owned by L&T Employee Trust. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Node.js**: 18+  
**TypeScript**: 5.0+