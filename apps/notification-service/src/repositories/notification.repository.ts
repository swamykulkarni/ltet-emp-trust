import pool from '../database/connection';
import { 
  Notification, 
  NotificationTemplate, 
  NotificationPreference,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  NotificationPriority
} from '../models/notification.model';

export class NotificationRepository {
  
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const query = `
      INSERT INTO notifications (
        user_id, type, priority, channel, template_id, subject, message, 
        data, status, scheduled_at, retry_count, max_retries, external_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      notification.userId,
      notification.type,
      notification.priority,
      notification.channel,
      notification.templateId || null,
      notification.subject || null,
      notification.message,
      notification.data ? JSON.stringify(notification.data) : null,
      notification.status,
      notification.scheduledAt || null,
      notification.retryCount,
      notification.maxRetries,
      notification.externalId || null
    ];

    const result = await pool.query(query, values);
    return this.mapRowToNotification(result.rows[0]);
  }

  async updateNotificationStatus(
    id: string, 
    status: NotificationStatus, 
    externalId?: string,
    failureReason?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [id, status];
    let paramIndex = 3;

    if (status === NotificationStatus.SENT) {
      updates.push(`sent_at = CURRENT_TIMESTAMP`);
    } else if (status === NotificationStatus.DELIVERED) {
      updates.push(`delivered_at = CURRENT_TIMESTAMP`);
    } else if (status === NotificationStatus.READ) {
      updates.push(`read_at = CURRENT_TIMESTAMP`);
    }

    if (externalId) {
      updates.push(`external_id = $${paramIndex}`);
      values.push(externalId);
      paramIndex++;
    }

    if (failureReason) {
      updates.push(`failure_reason = $${paramIndex}`);
      values.push(failureReason);
      paramIndex++;
    }

    if (status === NotificationStatus.FAILED) {
      updates.push(`retry_count = retry_count + 1`);
    }

    const query = `
      UPDATE notifications 
      SET ${updates.join(', ')}
      WHERE id = $1
    `;

    await pool.query(query, values);
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToNotification(result.rows[0]);
  }

  async getNotificationsByUserId(
    userId: string, 
    limit: number = 50, 
    offset: number = 0,
    status?: NotificationStatus
  ): Promise<Notification[]> {
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    const values: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async getPendingNotifications(limit: number = 100): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE status = 'pending' 
        AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
        AND retry_count < max_retries
      ORDER BY priority DESC, created_at ASC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async getFailedNotificationsForRetry(limit: number = 50): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE status = 'failed' 
        AND retry_count < max_retries
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      ORDER BY priority DESC, created_at ASC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async markAsRead(id: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET status = 'read', read_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND status IN ('sent', 'delivered')
    `;
    await pool.query(query, [id]);
  }

  async getNotificationStats(userId?: string): Promise<any> {
    let query = `
      SELECT 
        status,
        channel,
        type,
        COUNT(*) as count
      FROM notifications
    `;
    const values: any[] = [];

    if (userId) {
      query += ' WHERE user_id = $1';
      values.push(userId);
    }

    query += ' GROUP BY status, channel, type ORDER BY count DESC';

    const result = await pool.query(query, values);
    return result.rows;
  }

  private mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as NotificationType,
      priority: row.priority as NotificationPriority,
      channel: row.channel as NotificationChannel,
      templateId: row.template_id,
      subject: row.subject,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      status: row.status as NotificationStatus,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      failureReason: row.failure_reason,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      externalId: row.external_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export class NotificationTemplateRepository {
  
  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const query = `
      INSERT INTO notification_templates (name, type, channel, subject, body_template, variables, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      template.name,
      template.type,
      template.channel,
      template.subject || null,
      template.bodyTemplate,
      JSON.stringify(template.variables),
      template.isActive
    ];

    const result = await pool.query(query, values);
    return this.mapRowToTemplate(result.rows[0]);
  }

  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    const query = 'SELECT * FROM notification_templates WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToTemplate(result.rows[0]);
  }

  async getTemplateByTypeAndChannel(
    type: NotificationType, 
    channel: NotificationChannel
  ): Promise<NotificationTemplate | null> {
    const query = `
      SELECT * FROM notification_templates 
      WHERE type = $1 AND channel = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [type, channel]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToTemplate(result.rows[0]);
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    const query = 'SELECT * FROM notification_templates ORDER BY type, channel';
    const result = await pool.query(query);
    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<void> {
    const setClause: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.subject !== undefined) {
      setClause.push(`subject = $${paramIndex}`);
      values.push(updates.subject);
      paramIndex++;
    }

    if (updates.bodyTemplate !== undefined) {
      setClause.push(`body_template = $${paramIndex}`);
      values.push(updates.bodyTemplate);
      paramIndex++;
    }

    if (updates.variables !== undefined) {
      setClause.push(`variables = $${paramIndex}`);
      values.push(JSON.stringify(updates.variables));
      paramIndex++;
    }

    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex}`);
      values.push(updates.isActive);
      paramIndex++;
    }

    if (setClause.length === 0) {
      return;
    }

    const query = `
      UPDATE notification_templates 
      SET ${setClause.join(', ')}
      WHERE id = $1
    `;

    await pool.query(query, values);
  }

  private mapRowToTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      name: row.name,
      type: row.type as NotificationType,
      channel: row.channel as NotificationChannel,
      subject: row.subject,
      bodyTemplate: row.body_template,
      variables: JSON.parse(row.variables),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export class NotificationPreferenceRepository {
  
  async setPreference(preference: Omit<NotificationPreference, 'createdAt' | 'updatedAt'>): Promise<NotificationPreference> {
    const query = `
      INSERT INTO notification_preferences (user_id, type, channels, frequency, quiet_hours)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, type) 
      DO UPDATE SET 
        channels = EXCLUDED.channels,
        frequency = EXCLUDED.frequency,
        quiet_hours = EXCLUDED.quiet_hours,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      preference.userId,
      preference.type,
      JSON.stringify(preference.channels),
      preference.frequency,
      preference.quietHours ? JSON.stringify(preference.quietHours) : null
    ];

    const result = await pool.query(query, values);
    return this.mapRowToPreference(result.rows[0]);
  }

  async getPreference(userId: string, type: NotificationType): Promise<NotificationPreference | null> {
    const query = 'SELECT * FROM notification_preferences WHERE user_id = $1 AND type = $2';
    const result = await pool.query(query, [userId, type]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPreference(result.rows[0]);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const query = 'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY type';
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => this.mapRowToPreference(row));
  }

  async deletePreference(userId: string, type: NotificationType): Promise<void> {
    const query = 'DELETE FROM notification_preferences WHERE user_id = $1 AND type = $2';
    await pool.query(query, [userId, type]);
  }

  private mapRowToPreference(row: any): NotificationPreference {
    return {
      userId: row.user_id,
      type: row.type as NotificationType,
      channels: JSON.parse(row.channels),
      frequency: row.frequency,
      quietHours: row.quiet_hours ? JSON.parse(row.quiet_hours) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}