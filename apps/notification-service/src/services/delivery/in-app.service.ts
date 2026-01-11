import { createClient, RedisClientType } from 'redis';
import { NotificationDeliveryResult } from '../../models/notification.model';

export interface InAppConfig {
  redisUrl: string;
  ttl?: number; // Time to live in seconds, default 30 days
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  read: boolean;
}

export class InAppDeliveryService {
  private redis: RedisClientType;
  private ttl: number;

  constructor(config: InAppConfig) {
    this.redis = createClient({ url: config.redisUrl });
    this.ttl = config.ttl || 30 * 24 * 60 * 60; // 30 days default
  }

  async connect(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.disconnect();
    }
  }

  async sendInAppNotification(
    userId: string,
    notificationId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<NotificationDeliveryResult> {
    try {
      await this.connect();

      const notification: InAppNotification = {
        id: notificationId,
        userId,
        title,
        message,
        data,
        timestamp: new Date(),
        read: false,
      };

      // Store in user's notification list (simple list for now)
      const userKey = `user:${userId}:notifications`;
      
      await this.redis.lPush(userKey, JSON.stringify(notification));

      // Set expiration on the user's notification list
      await this.redis.expire(userKey, this.ttl);

      // Store individual notification for quick access
      const notificationKey = `notification:${notificationId}`;
      await this.redis.setEx(
        notificationKey,
        this.ttl,
        JSON.stringify(notification)
      );

      // Increment unread count
      const unreadKey = `user:${userId}:unread_count`;
      await this.redis.incr(unreadKey);
      await this.redis.expire(unreadKey, this.ttl);

      return {
        success: true,
        messageId: notificationId,
        externalId: notificationId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: true, // Redis errors are usually retryable
      };
    }
  }

  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<InAppNotification[]> {
    try {
      await this.connect();

      const userKey = `user:${userId}:notifications`;
      
      // Get all notifications and handle pagination in memory for simplicity
      // In production, you'd want to use proper Redis pagination
      const allNotifications = await this.redis.lRange(userKey, 0, -1) as string[];
      
      // Sort by timestamp (newest first) and paginate
      const notifications = allNotifications
        .map(notificationStr => JSON.parse(notificationStr) as InAppNotification)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);

      return notifications;
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      await this.connect();

      const notificationKey = `notification:${notificationId}`;
      const notificationStr = await this.redis.get(notificationKey);
      
      if (!notificationStr) {
        return false;
      }

      const notification: InAppNotification = JSON.parse(notificationStr);
      
      if (notification.userId !== userId) {
        return false; // User doesn't own this notification
      }

      if (!notification.read) {
        // Mark as read
        notification.read = true;
        await this.redis.setEx(
          notificationKey,
          this.ttl,
          JSON.stringify(notification)
        );

        // Update in user's list - for simplicity, we'll remove and re-add
        const userKey = `user:${userId}:notifications`;
        await this.redis.lRem(userKey, 0, notificationStr);
        await this.redis.lPush(userKey, JSON.stringify(notification));

        // Decrement unread count
        const unreadKey = `user:${userId}:unread_count`;
        const currentCount = await this.redis.get(unreadKey);
        if (currentCount && parseInt(currentCount) > 0) {
          await this.redis.decr(unreadKey);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      await this.connect();

      const unreadKey = `user:${userId}:unread_count`;
      const count = await this.redis.get(unreadKey);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      await this.connect();

      const notificationKey = `notification:${notificationId}`;
      const notificationStr = await this.redis.get(notificationKey);
      
      if (!notificationStr) {
        return false;
      }

      const notification: InAppNotification = JSON.parse(notificationStr);
      
      if (notification.userId !== userId) {
        return false; // User doesn't own this notification
      }

      // Remove from Redis
      await this.redis.del(notificationKey);

      // Remove from user's list
      const userKey = `user:${userId}:notifications`;
      await this.redis.lRem(userKey, 0, notificationStr);

      // Decrement unread count if it was unread
      if (!notification.read) {
        const unreadKey = `user:${userId}:unread_count`;
        const currentCount = await this.redis.get(unreadKey);
        if (currentCount && parseInt(currentCount) > 0) {
          await this.redis.decr(unreadKey);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      await this.connect();

      const userKey = `user:${userId}:notifications`;
      const unreadKey = `user:${userId}:unread_count`;

      // Get all notifications to delete individual keys
      const notifications = await this.redis.lRange(userKey, 0, -1);
      
      for (const notificationStr of notifications) {
        const notification: InAppNotification = JSON.parse(notificationStr);
        const notificationKey = `notification:${notification.id}`;
        await this.redis.del(notificationKey);
      }

      // Clear user's notification list and unread count
      await this.redis.del(userKey);
      await this.redis.del(unreadKey);

      return true;
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      return false;
    }
  }
}