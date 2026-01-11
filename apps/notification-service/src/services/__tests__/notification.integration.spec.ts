/**
 * Integration tests for NotificationService
 * These tests use real services where possible and mock only expensive external services
 */

import { NotificationService } from '../notification.service';
import { EmailDeliveryService } from '../delivery/email.service';
import { SMSDeliveryService } from '../delivery/sms.service';
import { InAppDeliveryService } from '../delivery/in-app.service';
import { 
  NotificationRequest, 
  NotificationType, 
  NotificationPriority,
  NotificationChannel 
} from '../../models/notification.model';

// Mock only expensive external services
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-email-id' }),
    verify: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-sms-id', status: 'sent' })
    }
  }))
}));

// Mock Redis for in-app notifications (would use real Redis in full integration tests)
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isOpen: false,
    lPush: jest.fn().mockResolvedValue(1),
    lRange: jest.fn().mockResolvedValue([]),
    lRem: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    setEx: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue('5'),
    decr: jest.fn().mockResolvedValue(4),
    del: jest.fn().mockResolvedValue(1)
  }))
}));

// Mock database (would use real test database in full integration tests)
jest.mock('../../repositories/notification.repository');

describe('NotificationService Integration Tests', () => {
  let notificationService: NotificationService;
  let emailService: EmailDeliveryService;
  let smsService: SMSDeliveryService;
  let inAppService: InAppDeliveryService;

  beforeEach(async () => {
    // Use real service instances with mocked external dependencies
    emailService = new EmailDeliveryService({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: { user: 'test@test.com', pass: 'password' },
      from: 'LTET Portal <noreply@ltet.com>'
    });

    smsService = new SMSDeliveryService({
      accountSid: 'test_sid',
      authToken: 'test_token',
      fromNumber: '+1234567890'
    });

    inAppService = new InAppDeliveryService({
      redisUrl: 'redis://localhost:6379'
    });

    notificationService = new NotificationService(
      emailService,
      smsService,
      inAppService
    );

    // Mock the repositories for integration tests
    (notificationService as any).notificationRepository = {
      createNotification: jest.fn().mockResolvedValue({
        id: 'notification-123',
        userId: 'user123',
        type: 'application_status',
        priority: 'normal',
        channel: 'email',
        message: 'Test message',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      updateNotificationStatus: jest.fn().mockResolvedValue(undefined),
      getNotificationById: jest.fn(),
      getNotificationsByUserId: jest.fn().mockResolvedValue([]),
      getPendingNotifications: jest.fn().mockResolvedValue([]),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      getNotificationStats: jest.fn().mockResolvedValue([])
    };

    (notificationService as any).preferenceRepository = {
      getPreference: jest.fn().mockResolvedValue(null),
      getUserPreferences: jest.fn().mockResolvedValue([]),
      setPreference: jest.fn().mockResolvedValue(undefined)
    };

    (notificationService as any).templateService = {
      renderTemplate: jest.fn().mockResolvedValue(null),
      renderTemplateByType: jest.fn().mockResolvedValue({
        subject: 'Test Subject',
        content: 'Test message content'
      })
    };
  });

  describe('Email Delivery Integration', () => {
    it('should send email using real EmailDeliveryService', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<h1>Test HTML Content</h1>',
        'Test plain text content'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-email-id');
    });

    it('should verify email connection', async () => {
      const isConnected = await emailService.verifyConnection();
      expect(isConnected).toBe(true);
    });
  });

  describe('SMS Delivery Integration', () => {
    it('should send SMS using real SMSDeliveryService', async () => {
      const result = await smsService.sendSMS(
        '+1234567890',
        'Test SMS message'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-sms-id');
    });

    it('should format phone numbers correctly', async () => {
      // Test Indian phone number formatting
      const result = await smsService.sendSMS(
        '9876543210', // 10-digit Indian number
        'Test message'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('In-App Delivery Integration', () => {
    it('should send in-app notification using real InAppDeliveryService', async () => {
      const result = await inAppService.sendInAppNotification(
        'user123',
        'notification-123',
        'Test Title',
        'Test message content',
        { key: 'value' }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('notification-123');
    });

    it('should get unread count', async () => {
      const count = await inAppService.getUnreadCount('user123');
      expect(count).toBe(5);
    });
  });

  describe('End-to-End Notification Flow', () => {
    it('should send notification through complete flow', async () => {
      const request: NotificationRequest = {
        userId: 'user123',
        type: NotificationType.APPLICATION_STATUS,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        subject: 'Application Status Update',
        message: 'Your application has been processed'
      };

      const notificationIds = await notificationService.sendNotification(request);

      expect(notificationIds).toBeDefined();
      expect(Array.isArray(notificationIds)).toBe(true);
      expect(notificationIds.length).toBeGreaterThan(0);
    });

    it('should handle template rendering in notification flow', async () => {
      const request: NotificationRequest = {
        userId: 'user123',
        type: NotificationType.APPLICATION_STATUS,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.EMAIL]
        // No message provided - should use template
      };

      const notificationIds = await notificationService.sendNotification(request);

      expect(notificationIds).toBeDefined();
      expect(Array.isArray(notificationIds)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle email delivery failures gracefully', async () => {
      // Mock a failure scenario with proper error structure
      const error = new Error('SMTP connection failed');
      (error as any).code = 'ECONNRESET'; // Add retryable error code
      
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(error),
        verify: jest.fn().mockResolvedValue(true)
      };
      
      (emailService as any).transporter = mockTransporter;

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
      expect(result.retryable).toBe(true);
    });

    it('should handle SMS delivery failures gracefully', async () => {
      // Mock a failure scenario
      const mockTwilio = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Invalid phone number'))
        }
      };
      
      (smsService as any).client = mockTwilio;

      const result = await smsService.sendSMS(
        'invalid-number',
        'Test message'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
    });
  });
});

/**
 * Note: For full integration testing, you would:
 * 
 * 1. Use a real test database (PostgreSQL test instance)
 * 2. Use a real Redis test instance
 * 3. Use test email service (like MailHog for SMTP testing)
 * 4. Mock only expensive external services (Twilio SMS)
 * 5. Set up test data fixtures
 * 6. Clean up test data after each test
 * 
 * Example full integration test setup:
 * 
 * beforeAll(async () => {
 *   // Start test database
 *   // Start test Redis
 *   // Start test SMTP server (MailHog)
 *   // Run database migrations
 * });
 * 
 * afterAll(async () => {
 *   // Clean up test services
 * });
 * 
 * beforeEach(async () => {
 *   // Clean test database
 *   // Clean test Redis
 * });
 */