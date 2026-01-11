export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  PUSH = 'push'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationType {
  APPLICATION_STATUS = 'application_status',
  SCHEME_DEADLINE = 'scheme_deadline',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  APPROVAL_REQUEST = 'approval_request',
  PAYMENT_UPDATE = 'payment_update',
  DOCUMENT_REQUEST = 'document_request',
  SECURITY_ALERT = 'security_alert'
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string; // For email
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  frequency: 'immediate' | 'daily' | 'weekly' | 'disabled';
  quietHours?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  templateId?: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  externalId?: string; // ID from external service (email provider, SMS provider, etc.)
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRequest {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  templateId?: string;
  subject?: string;
  message?: string;
  data?: Record<string, any>;
  scheduledAt?: Date;
  overridePreferences?: boolean; // For critical notifications
}

export interface NotificationDeliveryResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
  retryable?: boolean;
}

export interface BulkNotificationRequest {
  userIds: string[];
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  templateId?: string;
  subject?: string;
  message?: string;
  data?: Record<string, any>;
  scheduledAt?: Date;
  overridePreferences?: boolean;
}