# Application Service

The Application Processing Service handles the complete lifecycle of scheme applications including submission, workflow management, approval routing, and status tracking.

## Features

- Application submission with multi-step forms
- Draft saving and resumption
- State machine-based workflow management
- Approval routing with workload balancing
- SLA tracking and automatic escalation
- Timeline view with status updates
- Comment and clarification system
- Document resubmission handling

## API Endpoints

### Application Management
- `POST /applications` - Submit new application
- `GET /applications/{id}` - Get application details
- `PUT /applications/{id}` - Update application
- `DELETE /applications/{id}` - Delete draft application
- `POST /applications/{id}/submit` - Submit draft application

### Workflow Management
- `GET /applications/{id}/status` - Get application status
- `POST /applications/{id}/approve` - Approve application
- `POST /applications/{id}/reject` - Reject application
- `POST /applications/{id}/clarify` - Request clarification

### Draft Management
- `POST /applications/drafts` - Save application draft
- `GET /applications/drafts/{userId}` - Get user drafts
- `PUT /applications/drafts/{id}` - Update draft

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string for caching
- `JWT_SECRET` - JWT token secret
- `PORT` - Service port (default: 3003)