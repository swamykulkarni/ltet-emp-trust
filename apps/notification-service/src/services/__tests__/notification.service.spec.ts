import { NotificationService } from '../notification.service';
import { 
  NotificationRequest, 
  NotificationType, 
  NotificationPriority,
  NotificationChannel 
} from '../../models/notification.model';

// Mock all external dependencies
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn()
  }))
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn(() => ({
    messages: {
      create: jest.fn()
    }
  }))
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    isOpen: false,
    lPush: jest.fn(),
    lRange: jest.fn(),
    lRem: jest.fn(),
    expire: jest.fn(),
    setEx: jest.fn(),
    incr: jest.fn(),
    get: jest.fn(),
    decr: jest.fn(),
    del: jest.fn()
  }))
}));

// Mock the delivery services
jest.mock('../delivery/email.service');
jest.mock('../delivery/sms.service');
jest.mock('../delivery/in-app.service');

// Mock the repositories
jest.mock('../../repositories/notification.repository');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockEmailService: any;
  let mockSMSService: any;
  let mockInAppService: any;

  beforeEach(() => {
    // Create mock instances
    mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'email-123',
        externalId: 'email-123'
      })
    };

    mockSMSService = {
      sendSMS: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        externalId: 'sms-123'
      })
    };

    mockInAppService = {
      sendInAppNotification: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'inapp-123',
        externalId: 'inapp-123'
      }),
      getUnreadCount: jest.fn().mockResolvedValue(5),
      markAsRead: jest.fn().mockResolvedValue(true)
    };

    notificationService = new NotificationService(
      mockEmailService,
      mockSMSService,
      mockInAppService
    );

    // Mock the repositories
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
      getNotificationById: jest.fn(),
      getNotificationsByUserId: jest.fn().mockResolvedValue([]),
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
      renderTemplateByType: jest.fn().mockResolvedValue(null)
    };
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const request: NotificationRequest = {
        userId: 'user123',
        type: NotificationType.APPLICATION_STATUS,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.EMAIL],
        subject: 'Test Subject',
        message: 'Test message content'
      };

      const result = await notificationService.sendNotification(request);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle multiple channels', async () => {
      const request: NotificationRequest = {
        userId: 'user123',
        type: NotificationType.APPLICATION_STATUS,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        subject: 'Test Subject',
        message: 'Test message content'
      };

      const result = await notificationService.sendNotification(request);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle critical notifications with override preferences', async () => {
      const request: NotificationRequest = {
        userId: 'user123',
        type: NotificationType.SECURITY_ALERT,
        priority: NotificationPriority.CRITICAL,
        message: 'Critical security alert',
        overridePreferences: true
      };

      const result = await notificationService.sendNotification(request);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      const userId = 'user123';
      const count = await notificationService.getUnreadCount(userId);

      expect(count).toBe(5);
      expect(mockInAppService.getUnreadCount).toHaveBeenCalledWith(userId);
    });

    it('should handle errors gracefully', async () => {
      mockInAppService.getUnreadCount.mockRejectedValue(new Error('Redis error'));

      const userId = 'user123';
      const count = await notificationService.getUnreadCount(userId);

      expect(count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      // Mock the repository method
      const mockGetNotificationById = jest.fn().mockResolvedValue({
        id: 'notif123',
        userId: 'user123',
        channel: NotificationChannel.IN_APP,
        message: 'Test notification'
      });

      // Replace the repository method
      (notificationService as any).notificationRepository.getNotificationById = mockGetNotificationById;
      (notificationService as any).notificationRepository.markAsRead = jest.fn().mockResolvedValue(undefined);

      const result = await notificationService.markAsRead('notif123', 'user123');

      expect(result).toBe(true);
      expect(mockInAppService.markAsRead).toHaveBeenCalledWith('notif123', 'user123');
    });

    it('should return false for non-existent notification', async () => {
      // Mock the repository method to return null
      const mockGetNotificationById = jest.fn().mockResolvedValue(null);
      (notificationService as any).notificationRepository.getNotificationById = mockGetNotificationById;

      const result = await notificationService.markAsRead('nonexistent', 'user123');

      expect(result).toBe(false);
    });

    it('should return false for unauthorized access', async () => {
      // Mock the repository method to return notification for different user
      const mockGetNotificationById = jest.fn().mockResolvedValue({
        id: 'notif123',
        userId: 'otheruser',
        channel: NotificationChannel.IN_APP,
        message: 'Test notification'
      });

      (notificationService as any).notificationRepository.getNotificationById = mockGetNotificationById;

      const result = await notificationService.markAsRead('notif123', 'user123');

      expect(result).toBe(false);
    });
  });

  describe('sendBulkNotification', () => {
    it('should send notifications to multiple users', async () => {
      const request = {
        userIds: ['user1', 'user2', 'user3'],
        type: NotificationType.SCHEME_DEADLINE,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.EMAIL],
        subject: 'Scheme Deadline Reminder',
        message: 'Your scheme deadline is approaching'
      };

      const result = await notificationService.sendBulkNotification(request);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle large batches efficiently', async () => {
      const userIds = Array.from({ length: 250 }, (_, i) => `user${i + 1}`);
      
      const request = {
        userIds,
        type: NotificationType.SYSTEM_MAINTENANCE,
        message: 'System maintenance scheduled'
      };

      const result = await notificationService.sendBulkNotification(request);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});