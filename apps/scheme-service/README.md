# Scheme Service

The Scheme Service is responsible for managing employee welfare schemes in the LTET Employee Trust Portal. It provides comprehensive functionality for scheme configuration, eligibility rule management, and scheme discovery.

## Features

### Core Functionality
- **Scheme CRUD Operations**: Create, read, update, and delete schemes
- **Eligibility Rules Engine**: Dynamic rule-based eligibility evaluation
- **Visual Rule Builder**: API for building eligibility rules through UI
- **Scheme Publishing**: Version-controlled scheme publishing workflow
- **Scheme Discovery**: Advanced filtering and search capabilities

### Key Components
- **Scheme Management**: Full lifecycle management of welfare schemes
- **Eligibility Engine**: Evaluates user eligibility based on configurable rules
- **Rule Builder**: Visual interface for creating complex eligibility criteria
- **Versioning System**: Track changes and maintain scheme history
- **Statistics**: Analytics and reporting for scheme utilization

## API Endpoints

### Scheme Management
- `POST /api/schemes` - Create new scheme
- `GET /api/schemes` - List schemes with filtering
- `GET /api/schemes/eligible` - Get user-eligible schemes
- `GET /api/schemes/:id` - Get scheme details
- `PUT /api/schemes/:id` - Update scheme
- `DELETE /api/schemes/:id` - Delete scheme
- `POST /api/schemes/:id/publish` - Publish scheme

### Rule Builder
- `GET /api/schemes/rules/builder` - Get rule builder configuration
- `GET /api/schemes/rules/types` - Get available rule types
- `PUT /api/schemes/:id/rules` - Update eligibility rules

### Analytics
- `GET /api/schemes/statistics` - Get scheme statistics
- `GET /api/schemes/:id/eligibility` - Check user eligibility
- `GET /api/schemes/:id/versions` - Get scheme versions

## Data Models

### Scheme Entity
```typescript
interface Scheme {
  schemeId: string;
  name: string;
  category: 'medical' | 'education' | 'skill_building';
  description: string;
  eligibilityRules: EligibilityRules;
  documentRequirements: DocumentRequirement[];
  approvalWorkflow: ApprovalWorkflow;
  budgetInfo: BudgetInfo;
  status: 'active' | 'inactive' | 'draft';
  validFrom: Date;
  validTo: Date;
}
```

### Eligibility Rules
- **Service Years**: Minimum years of service required
- **Salary Range**: Salary-based eligibility criteria
- **IC Restrictions**: Independent Company limitations
- **Dependent Age**: Age-based dependent requirements

## Environment Variables

```bash
SCHEME_SERVICE_PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ltet_user
DB_PASSWORD=ltet_password
DB_NAME=ltet_portal
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

## Development

### Running the Service
```bash
# Development mode
npm run dev:scheme-service

# Production build
npm run build:scheme-service
npm start
```

### Testing
```bash
# Run all tests
npm run test:scheme-service

# Run with coverage
npm run test:scheme-service -- --coverage
```

## Architecture

The service follows a layered architecture:

1. **Controllers**: Handle HTTP requests and responses
2. **Services**: Business logic and orchestration
3. **Repositories**: Data access layer
4. **Models**: Data structures and interfaces

### Key Services
- **SchemeService**: Main business logic for scheme management
- **EligibilityRulesService**: Rule evaluation and builder functionality

### Database Schema
The service uses PostgreSQL with the following main tables:
- `schemes.schemes`: Main scheme data
- `schemes.scheme_versions`: Version history
- Related tables for applications and documents

## Integration Points

- **User Service**: User data for eligibility evaluation
- **Application Service**: Scheme data for application processing
- **Document Service**: Document requirements validation
- **Notification Service**: Scheme-related notifications

## Security

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention
- CORS configuration

## Monitoring

- Health check endpoint: `/health`
- Structured logging with Winston
- Database connection monitoring
- Error tracking and reporting