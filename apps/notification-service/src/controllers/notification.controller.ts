import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { 
  NotificationRequest, 
  BulkNotificationRequest,
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStatus
} from '../models/notification.model';
import Joi from 'joi';

export class NotificationController {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  // Send single notification
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userId: Joi.string().required(),
        type: Joi.string().valid(...Object.values(NotificationType)).required(),
        priority: Joi.string().valid(...Object.values(NotificationPriority)).optional(),
        channels: Joi.array().items(Joi.string().valid(...Object.values(NotificationChannel))).optional(),
        templateId: Joi.string().uuid().optional(),
        subject: Joi.string().optional(),
        message: Joi.string().optional(),
        data: Joi.object().optional(),
        scheduledAt: Joi.date().optional(),
        overridePreferences: Joi.boolean().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const request: NotificationRequest = value;
      const notificationIds = await this.notificationService.sendNotification(request);

      res.status(201).json({
        success: true,
        notificationIds,
        message: 'Notification sent successfully'
      });
    } catch (error: any) {
      console.error('Failed to send notification:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send notification'
      });
    }
  }

  // Send bulk notifications
  async sendBulkNotification(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userIds: Joi.array().items(Joi.string()).min(1).max(1000).required(),
        type: Joi.string().valid(...Object.values(NotificationType)).required(),
        priority: Joi.string().valid(...Object.values(NotificationPriority)).optional(),
        channels: Joi.array().items(Joi.string().valid(...Object.values(NotificationChannel))).optional(),
        templateId: Joi.string().uuid().optional(),
        subject: Joi.string().optional(),
        message: Joi.string().optional(),
        data: Joi.object().optional(),
        scheduledAt: Joi.date().optional(),
        overridePreferences: Joi.boolean().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const request: BulkNotificationRequest = value;
      const notificationIds = await this.notificationService.sendBulkNotification(request);

      res.status(201).json({
        success: true,
        notificationIds,
        totalSent: notificationIds.length,
        message: 'Bulk notifications sent successfully'
      });
    } catch (error: any) {
      console.error('Failed to send bulk notification:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send bulk notification'
      });
    }
  }

  // Get user notifications
  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userId: Joi.string().required(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0),
        status: Joi.string().valid(...Object.values(NotificationStatus)).optional()
      });

      const { error, value } = schema.validate({
        userId: req.params.userId,
        ...req.query
      });

      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { userId, limit, offset, status } = value;
      const notifications = await this.notificationService.getUserNotifications(
        userId, 
        limit, 
        offset, 
        status
      );

      res.json({
        success: true,
        notifications,
        pagination: {
          limit,
          offset,
          count: notifications.length
        }
      });
    } catch (error: any) {
      console.error('Failed to get user notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notifications'
      });
    }
  }

  // Mark notification as read
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        notificationId: Joi.string().uuid().required(),
        userId: Joi.string().required()
      });

      const { error, value } = schema.validate({
        notificationId: req.params.notificationId,
        userId: req.body.userId
      });

      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { notificationId, userId } = value;
      const success = await this.notificationService.markAsRead(notificationId, userId);

      if (success) {
        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found or access denied'
        });
      }
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark notification as read'
      });
    }
  }

  // Get unread count
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userId: Joi.string().required()
      });

      const { error, value } = schema.validate({
        userId: req.params.userId
      });

      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { userId } = value;
      const unreadCount = await this.notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        unreadCount
      });
    } catch (error: any) {
      console.error('Failed to get unread count:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get unread count'
      });
    }
  }

  // Process pending notifications (admin endpoint)
  async processPendingNotifications(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.processNotifications();
      
      res.json({
        success: true,
        message: 'Pending notifications processed'
      });
    } catch (error: any) {
      console.error('Failed to process pending notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process notifications'
      });
    }
  }

  // Retry failed notifications (admin endpoint)
  async retryFailedNotifications(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.retryFailedNotifications();
      
      res.json({
        success: true,
        message: 'Failed notifications retry initiated'
      });
    } catch (error: any) {
      console.error('Failed to retry notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry notifications'
      });
    }
  }

  // Get notification statistics (admin endpoint)
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId as string;
      const stats = await this.notificationService.getNotificationStats(userId);

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error('Failed to get notification stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get notification stats'
      });
    }
  }
}