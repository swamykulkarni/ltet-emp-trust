import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { 
  NotificationPreference,
  NotificationChannel,
  NotificationType
} from '../models/notification.model';
import Joi from 'joi';

export class PreferenceController {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  // Set notification preference
  async setPreference(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userId: Joi.string().required(),
        type: Joi.string().valid(...Object.values(NotificationType)).required(),
        channels: Joi.array().items(Joi.string().valid(...Object.values(NotificationChannel))).required(),
        frequency: Joi.string().valid('immediate', 'daily', 'weekly', 'disabled').default('immediate'),
        quietHours: Joi.object({
          start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
          end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
        }).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const preference: NotificationPreference = {
        ...value,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.notificationService.setNotificationPreference(preference);

      res.json({
        success: true,
        message: 'Notification preference updated successfully'
      });
    } catch (error: any) {
      console.error('Failed to set notification preference:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set notification preference'
      });
    }
  }

  // Get user preferences
  async getUserPreferences(req: Request, res: Response): Promise<void> {
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
      const preferences = await this.notificationService.getUserPreferences(userId);

      // If no preferences exist, return default preferences
      if (preferences.length === 0) {
        const defaultPreferences = this.getDefaultPreferences(userId);
        res.json({
          success: true,
          preferences: defaultPreferences,
          isDefault: true
        });
        return;
      }

      res.json({
        success: true,
        preferences,
        isDefault: false
      });
    } catch (error: any) {
      console.error('Failed to get user preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user preferences'
      });
    }
  }

  // Set multiple preferences at once
  async setBulkPreferences(req: Request, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        userId: Joi.string().required(),
        preferences: Joi.array().items(
          Joi.object({
            type: Joi.string().valid(...Object.values(NotificationType)).required(),
            channels: Joi.array().items(Joi.string().valid(...Object.values(NotificationChannel))).required(),
            frequency: Joi.string().valid('immediate', 'daily', 'weekly', 'disabled').default('immediate'),
            quietHours: Joi.object({
              start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
              end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
            }).optional()
          })
        ).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { userId, preferences } = value;

      // Set each preference
      for (const pref of preferences) {
        const preference: NotificationPreference = {
          userId,
          ...pref,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await this.notificationService.setNotificationPreference(preference);
      }

      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        updatedCount: preferences.length
      });
    } catch (error: any) {
      console.error('Failed to set bulk preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set bulk preferences'
      });
    }
  }

  // Reset preferences to default
  async resetToDefault(req: Request, res: Response): Promise<void> {
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
      const defaultPreferences = this.getDefaultPreferences(userId);

      // Set each default preference
      for (const preference of defaultPreferences) {
        await this.notificationService.setNotificationPreference(preference);
      }

      res.json({
        success: true,
        message: 'Preferences reset to default successfully',
        preferences: defaultPreferences
      });
    } catch (error: any) {
      console.error('Failed to reset preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reset preferences'
      });
    }
  }

  private getDefaultPreferences(userId: string): NotificationPreference[] {
    const now = new Date();
    
    return [
      {
        userId,
        type: NotificationType.APPLICATION_STATUS,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.SCHEME_DEADLINE,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.SYSTEM_MAINTENANCE,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.APPROVAL_REQUEST,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.PAYMENT_UPDATE,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.DOCUMENT_REQUEST,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      },
      {
        userId,
        type: NotificationType.SECURITY_ALERT,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        frequency: 'immediate',
        createdAt: now,
        updatedAt: now
      }
    ];
  }
}