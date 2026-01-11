import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { NotificationService } from './services/notification.service';
import { TemplateService } from './services/template.service';
import { EmailDeliveryService } from './services/delivery/email.service';
import { SMSDeliveryService } from './services/delivery/sms.service';
import { InAppDeliveryService } from './services/delivery/in-app.service';
import { NotificationController } from './controllers/notification.controller';
import { PreferenceController } from './controllers/preference.controller';
import { TemplateController } from './controllers/template.controller';
import { createNotificationRoutes } from './routes/notification.routes';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'notification-service'
    });
  });

  // Initialize services
  const emailService = new EmailDeliveryService({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'password'
    },
    from: process.env.SMTP_FROM || 'LTET Portal <noreply@ltet.com>'
  });

  const smsService = new SMSDeliveryService({
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'test_sid',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '+1234567890'
  });

  const inAppService = new InAppDeliveryService({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  const notificationService = new NotificationService(emailService, smsService, inAppService);
  const templateService = new TemplateService();

  // Initialize controllers
  const notificationController = new NotificationController(notificationService);
  const preferenceController = new PreferenceController(notificationService);
  const templateController = new TemplateController(templateService);

  // Routes
  app.use('/api/notifications', createNotificationRoutes(
    notificationController,
    preferenceController,
    templateController
  ));

  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  // 404 handler
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  return app;
}

// Background job to process notifications
export async function startBackgroundJobs(): Promise<void> {
  const emailService = new EmailDeliveryService({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'password'
    },
    from: process.env.SMTP_FROM || 'LTET Portal <noreply@ltet.com>'
  });

  const smsService = new SMSDeliveryService({
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'test_sid',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'test_token',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '+1234567890'
  });

  const inAppService = new InAppDeliveryService({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  const notificationService = new NotificationService(emailService, smsService, inAppService);
  const templateService = new TemplateService();

  // Initialize default templates
  try {
    await templateService.initializeDefaultTemplates();
    console.log('Default templates initialized');
  } catch (error) {
    console.error('Failed to initialize default templates:', error);
  }

  // Process pending notifications every 30 seconds
  setInterval(async () => {
    try {
      await notificationService.processNotifications();
    } catch (error) {
      console.error('Failed to process notifications:', error);
    }
  }, 30000);

  // Retry failed notifications every 5 minutes
  setInterval(async () => {
    try {
      await notificationService.retryFailedNotifications();
    } catch (error) {
      console.error('Failed to retry notifications:', error);
    }
  }, 300000);

  console.log('Background jobs started');
}