# LTET Notification Service

A comprehensive multi-channel notification system for the L&T Employee Trust (LTET) Digital Portal.

## Features

### Multi-Channel Delivery
- **Email**: HTML/text emails with template support
- **SMS**: Text messages via Twilio integration
- **In-App**: Real-time notifications stored in Redis
- **Push**: Mobile push notifications (future enhancement)

### User Preference Management
- Channel preferences per notification type
- Frequency settings (immediate, daily, weekly, disabled)
- Quiet hours configuration
- Bulk preference management

### Template System
- Handlebars-based templating
- Custom helpers for formatting (dates, currency, etc.)
- Template versioning and management
- Default templates for common scenarios

### Delivery Tracking
- Comprehensive delivery status tracking
- Retry mechanism for failed deliveries
- Audit trail for all notifications
- Real-time statistics and reporting

## API Endpoints

### Notifications
- `POST /api/notifications/send` - Send single notification
- `POST /api/notifications/send-bulk` - Send bulk notifications
- `GET /api/notifications/user/:userId` - Get user notifications
- `PUT /api/notifications/:notificationId/read` - Mark as read
- `GET /api/notifications/user/:userId/unread-count` - Get unread count

### Preferences
- `POST /api/notifications/preferences` - Set preference
- `GET /api/notifications/preferences/:userId` - Get user preferences
- `POST /api/notifications/preferences/bulk` - Set bulk preferences
- `POST /api/notifications/preferences/:userId/reset` - Reset to defaults

### Templates
- `POST /api/notifications/templates` - Create template
- `GET /api/notifications/templates` - Get all templates
- `GET /api/notifications/templates/:templateId` - Get template by ID
- `PUT /api/notifications/templates/:templateId` - Update template
- `POST /api/notifications/templates/:templateId/render` - Test template

### Admin
- `POST /api/notifications/process-pending` - Process pending notifications
- `POST /api/notifications/retry-failed` - Retry failed notifications
- `GET /api/notifications/stats` - Get notification statistics

## Environment Variables

```bash
# Server Configuration
PORT=3004

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltet_notifications
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=LTET Portal <noreply@ltet.com>

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

## Database Setup

1. Create the database:
```sql
CREATE DATABASE ltet_notifications;
```

2. Run the migration:
```bash
psql -h localhost -U postgres -d ltet_notifications -f src/database/migrations/001_create_notification_tables.sql
```

## Usage Examples

### Send Application Status Notification
```javascript
const response = await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    type: 'application_status',
    priority: 'normal',
    data: {
      userName: 'John Doe',
      applicationId: 'APP001',
      schemeName: 'Medical Reimbursement',
      status: 'approved',
      approvedAmount: 50000
    }
  })
});
```

### Set User Preferences
```javascript
const response = await fetch('/api/notifications/preferences', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    type: 'application_status',
    channels: ['email', 'in_app'],
    frequency: 'immediate',
    quietHours: {
      start: '22:00',
      end: '08:00'
    }
  })
});
```

### Create Custom Template
```javascript
const response = await fetch('/api/notifications/templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Custom Application Approved',
    type: 'application_status',
    channel: 'email',
    subject: 'Great News! Your {{schemeName}} Application is Approved',
    bodyTemplate: `
      <h2>Congratulations {{userName}}!</h2>
      <p>Your application for <strong>{{schemeName}}</strong> has been approved.</p>
      <p>Approved Amount: {{formatCurrency approvedAmount}}</p>
      <p>Payment will be processed within 3-5 business days.</p>
    `,
    variables: ['userName', 'schemeName', 'approvedAmount']
  })
});
```

## Background Jobs

The service runs background jobs for:
- Processing pending notifications (every 30 seconds)
- Retrying failed notifications (every 5 minutes)
- Cleaning up old notifications (daily)

## Monitoring

Health check endpoint: `GET /health`

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-09T10:30:00.000Z",
  "service": "notification-service"
}
```

## Integration with Other Services

The notification service integrates with:
- **User Service**: For user contact information
- **Application Service**: For application status updates
- **Scheme Service**: For deadline reminders
- **Payment Service**: For payment notifications

## Security Considerations

- All API endpoints should be protected with authentication
- Sensitive data (phone numbers, emails) should be encrypted
- Rate limiting should be implemented for bulk operations
- Audit logging is enabled for all notification activities

## Performance

- Supports concurrent processing of notifications
- Redis caching for in-app notifications
- Batch processing for bulk operations
- Configurable retry mechanisms
- Connection pooling for database operations