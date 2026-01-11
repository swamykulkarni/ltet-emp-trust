import {
  Notification,
  NotificationRequest,
  BulkNotificationRequest,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  NotificationType,
  NotificationPreference
} from '../models/notification.model';
import {
  NotificationRepository,
  NotificationPreferenceRepository
} from '../repositories/notification.repository';
import { TemplateService } from './template.service';
import { EmailDeliveryService } from './delivery/email.service';
import { SMSDeliveryService } from './delivery/sms.service';
import { InAppDeliveryService } from './delivery/in-app.service';

export class NotificationService {
  private notificationRepository: NotificationRepository;
  private preferenceRepository: NotificationPreferenceRepository;
  private templateService: TemplateService;
  private emailService: EmailDeliveryService;
  private smsService: SMSDeliveryService;
  private inAppService: InAppDeliveryService;

  constructor(
    emailService: EmailDeliveryService,
    smsService: SMSDeliveryService,
    inAppService: InAppDeliveryService
  ) {
    this.notificationRepository = new NotificationRepository();
    this.preferenceRepository = new NotificationPreferenceRepository();
    this.templateService = new TemplateService();
    this.emailService = emailService;
    this.smsService = smsService;
    this.inAppService = inAppService;
  }

  async sendNotification(request: NotificationRequest): Promise<string[]> {
    try {
      // Determine channels to use
      const channels = await this.determineChannels(request);
      const notificationIds: string[] = [];

      // Create notifications for each channel
      for (const channel of channels) {
        const notificationId = await this.createNotification(request, channel);
        if (notificationId) {
          notificationIds.push(notificationId);
        }
      }

      // Process notifications immediately if not scheduled
      if (!request.scheduledAt) {
        await this.processNotifications(notificationIds);
      }

      return notificationIds;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  async sendBulkNotification(request: BulkNotificationRequest): Promise<string[]> {
    const allNotificationIds: string[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < request.userIds.length; i += batchSize) {
      const batch = request.userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(userId => 
        this.sendNotification({
          ...request,
          userId
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allNotificationIds.push(...result.value);
        } else {
          console.error('Failed to send notification in batch:', result.reason);
        }
      }
    }

    return allNotificationIds;
  }

  async processNotifications(notificationIds?: string[]): Promise<void> {
    try {
      let notifications: Notification[];
      
      if (notificationIds) {
        // Process specific notifications
        notifications = [];
        for (const id of notificationIds) {
          const notification = await this.notificationRepository.getNotificationById(id);
          if (notification && notification.status === NotificationStatus.PENDING) {
            notifications.push(notification);
          }
        }
      } else {
        // Process all pending notifications
        notifications = await this.notificationRepository.getPendingNotifications();
      }

      // Process notifications in parallel with concurrency limit
      const concurrencyLimit = 10;
      for (let i = 0; i < notifications.length; i += concurrencyLimit) {
        const batch = notifications.slice(i, i + concurrencyLimit);
        await Promise.allSettled(
          batch.map(notification => this.deliverNotification(notification))
        );
      }
    } catch (error) {
      console.error('Failed to process notifications:', error);
    }
  }

  async retryFailedNotifications(): Promise<void> {
    try {
      const failedNotifications = await this.notificationRepository.getFailedNotificationsForRetry();
      
      for (const notification of failedNotifications) {
        await this.deliverNotification(notification);
      }
    } catch (error) {
      console.error('Failed to retry notifications:', error);
    }
  }

  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    status?: NotificationStatus
  ): Promise<Notification[]> {
    return this.notificationRepository.getNotificationsByUserId(userId, limit, offset, status);
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const notification = await this.notificationRepository.getNotificationById(notificationId);
      
      if (!notification || notification.userId !== userId) {
        return false;
      }

      if (notification.channel === NotificationChannel.IN_APP) {
        await this.inAppService.markAsRead(notificationId, userId);
      }

      await this.notificationRepository.markAsRead(notificationId);
      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.inAppService.getUnreadCount(userId);
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  // Preference Management
  async setNotificationPreference(preference: NotificationPreference): Promise<void> {
    await this.preferenceRepository.setPreference(preference);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepository.getUserPreferences(userId);
  }

  async getNotificationStats(userId?: string): Promise<any> {
    return this.notificationRepository.getNotificationStats(userId);
  }

  private async determineChannels(request: NotificationRequest): Promise<NotificationChannel[]> {
    // If channels are explicitly specified, use them
    if (request.channels && request.channels.length > 0) {
      return request.channels;
    }

    // If overriding preferences (for critical notifications), use all channels
    if (request.overridePreferences) {
      return [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP];
    }

    // Get user preferences
    const preference = await this.preferenceRepository.getPreference(request.userId, request.type);
    
    if (preference) {
      // Check if we're in quiet hours
      if (preference.quietHours && this.isInQuietHours(preference.quietHours)) {
        // During quiet hours, only send critical notifications
        if (request.priority === NotificationPriority.CRITICAL) {
          return preference.channels;
        } else {
          // For non-critical notifications, only use in-app
          return preference.channels.includes(NotificationChannel.IN_APP) 
            ? [NotificationChannel.IN_APP] 
            : [];
        }
      }

      return preference.channels;
    }

    // Default channels if no preference is set
    return [NotificationChannel.EMAIL, NotificationChannel.IN_APP];
  }

  private async createNotification(
    request: NotificationRequest,
    channel: NotificationChannel
  ): Promise<string | null> {
    try {
      let subject = request.subject;
      let message = request.message;

      // If using a template, render it
      if (request.templateId) {
        const rendered = await this.templateService.renderTemplate(request.templateId, request.data || {});
        if (rendered) {
          subject = rendered.subject || subject;
          message = rendered.content;
        }
      } else if (!message) {
        // Try to find a default template for this type and channel
        const rendered = await this.templateService.renderTemplateByType(
          request.type,
          channel,
          request.data || {}
        );
        if (rendered) {
          subject = rendered.subject || subject;
          message = rendered.content;
        }
      }

      if (!message) {
        console.error(`No message content available for notification type ${request.type} and channel ${channel}`);
        return null;
      }

      const notification = await this.notificationRepository.createNotification({
        userId: request.userId,
        type: request.type,
        priority: request.priority || NotificationPriority.NORMAL,
        channel,
        templateId: request.templateId,
        subject,
        message,
        data: request.data,
        status: NotificationStatus.PENDING,
        scheduledAt: request.scheduledAt,
        retryCount: 0,
        maxRetries: 3
      });

      return notification.id;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    try {
      let result;

      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailService.sendEmail(
            notification.userId, // In real implementation, this should be email address
            notification.subject || 'LTET Portal Notification',
            notification.message
          );
          break;

        case NotificationChannel.SMS:
          result = await this.smsService.sendSMS(
            notification.userId, // In real implementation, this should be phone number
            notification.message
          );
          break;

        case NotificationChannel.IN_APP:
          result = await this.inAppService.sendInAppNotification(
            notification.userId,
            notification.id,
            notification.subject || 'Notification',
            notification.message,
            notification.data
          );
          break;

        default:
          throw new Error(`Unsupported notification channel: ${notification.channel}`);
      }

      if (result.success) {
        await this.notificationRepository.updateNotificationStatus(
          notification.id,
          NotificationStatus.SENT,
          result.externalId
        );
      } else {
        const status = result.retryable && notification.retryCount < notification.maxRetries
          ? NotificationStatus.FAILED
          : NotificationStatus.FAILED;

        await this.notificationRepository.updateNotificationStatus(
          notification.id,
          status,
          undefined,
          result.error
        );
      }
    } catch (error) {
      console.error(`Failed to deliver notification ${notification.id}:`, error);
      
      await this.notificationRepository.updateNotificationStatus(
        notification.id,
        NotificationStatus.FAILED,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private isInQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = quietHours;
    
    // Handle cases where quiet hours span midnight
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }
}