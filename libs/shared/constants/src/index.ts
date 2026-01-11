// Shared constants for LTET Employee Trust Portal

/**
 * Application status constants
 */
export const APPLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DISBURSED: 'disbursed'
} as const;

/**
 * User role constants
 */
export const USER_ROLES = {
  EMPLOYEE: 'employee',
  APPROVER: 'approver',
  FINANCE: 'finance',
  ADMIN: 'admin',
  HEAD: 'head',
  SYSTEM_ADMIN: 'system_admin'
} as const;

/**
 * Scheme category constants
 */
export const SCHEME_CATEGORIES = {
  MEDICAL: 'medical',
  EDUCATION: 'education',
  SKILL_BUILDING: 'skill_building'
} as const;

/**
 * Document validation constants
 */
export const DOCUMENT_CONSTANTS = {
  ALLOWED_TYPES: ['pdf', 'jpg', 'jpeg', 'png'],
  ALLOWED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_PER_APPLICATION: 10
} as const;

/**
 * Validation constants
 */
export const VALIDATION_CONSTANTS = {
  PASSWORD_MIN_LENGTH: 8,
  PHONE_LENGTH: 10,
  IFSC_LENGTH: 11,
  PAN_LENGTH: 10,
  PINCODE_LENGTH: 6,
  MAX_LOGIN_ATTEMPTS: 3,
  SESSION_TIMEOUT_MINUTES: 30,
  OTP_EXPIRY_MINUTES: 10
} as const;

/**
 * API constants
 */
export const API_CONSTANTS = {
  BASE_URL: process.env['API_BASE_URL'] || 'http://localhost:3000/api',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
} as const;

/**
 * Pagination constants
 */
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 5
} as const;

/**
 * SLA constants (in hours)
 */
export const SLA_CONSTANTS = {
  DEFAULT_APPROVAL_SLA: 72, // 3 days
  URGENT_APPROVAL_SLA: 24, // 1 day
  FINANCE_PROCESSING_SLA: 48, // 2 days
  ESCALATION_WARNING_HOURS: 12, // 12 hours before SLA breach
  AUTO_ESCALATION_HOURS: 6 // 6 hours after SLA breach
} as const;

/**
 * Notification constants
 */
export const NOTIFICATION_CONSTANTS = {
  CHANNELS: {
    EMAIL: 'email',
    SMS: 'sms',
    IN_APP: 'in_app',
    PUSH: 'push'
  },
  TYPES: {
    APPLICATION_SUBMITTED: 'application_submitted',
    APPLICATION_APPROVED: 'application_approved',
    APPLICATION_REJECTED: 'application_rejected',
    CLARIFICATION_REQUESTED: 'clarification_requested',
    PAYMENT_PROCESSED: 'payment_processed',
    DEADLINE_REMINDER: 'deadline_reminder',
    SLA_WARNING: 'sla_warning',
    SYSTEM_MAINTENANCE: 'system_maintenance'
  },
  PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
} as const;

/**
 * Cache constants
 */
export const CACHE_CONSTANTS = {
  TTL: {
    USER_PROFILE: 3600, // 1 hour
    SCHEMES: 1800, // 30 minutes
    APPLICATIONS: 300, // 5 minutes
    NOTIFICATIONS: 600 // 10 minutes
  },
  KEYS: {
    USER_PREFIX: 'user:',
    SCHEME_PREFIX: 'scheme:',
    APPLICATION_PREFIX: 'app:',
    SESSION_PREFIX: 'session:'
  }
} as const;

/**
 * Database constants
 */
export const DATABASE_CONSTANTS = {
  CONNECTION_POOL_SIZE: 10,
  QUERY_TIMEOUT: 30000, // 30 seconds
  TRANSACTION_TIMEOUT: 60000, // 1 minute
  RETRY_ATTEMPTS: 3
} as const;

/**
 * Security constants
 */
export const SECURITY_CONSTANTS = {
  JWT_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  BCRYPT_ROUNDS: 12,
  RATE_LIMIT: {
    LOGIN: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_ATTEMPTS: 5
    },
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    }
  }
} as const;

/**
 * Environment constants
 */
export const ENVIRONMENT_CONSTANTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
} as const;

/**
 * Integration constants
 */
export const INTEGRATION_CONSTANTS = {
  HRMS: {
    SYNC_INTERVAL_HOURS: 24,
    BATCH_SIZE: 1000,
    TIMEOUT: 60000
  },
  SAP: {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    BATCH_SIZE: 500,
    HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
    TOKEN_REFRESH_BUFFER: 300000 // 5 minutes before expiry
  },
  PAYMENT_GATEWAY: {
    TIMEOUT: 45000,
    RETRY_ATTEMPTS: 2,
    HEALTH_CHECK_INTERVAL: 180000, // 3 minutes
    WEBHOOK_TIMEOUT: 30000
  },
  INTEGRATION_HEALTH: {
    RESPONSE_TIME_THRESHOLD: 5000, // 5 seconds
    ERROR_RATE_THRESHOLD: 10, // 10%
    UPTIME_THRESHOLD: 95, // 95%
    HISTORY_RETENTION_HOURS: 168, // 1 week
    ALERT_CLEANUP_HOURS: 168 // 1 week
  },
  OCR: {
    TIMEOUT: 120000, // 2 minutes
    CONFIDENCE_THRESHOLD: 0.8
  }
} as const;

/**
 * Audit constants
 */
export const AUDIT_CONSTANTS = {
  ACTIONS: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    APPROVE: 'approve',
    REJECT: 'reject',
    SUBMIT: 'submit',
    UPLOAD: 'upload'
  },
  RETENTION_DAYS: 2555 // 7 years
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  
  // Business logic errors
  SCHEME_NOT_ELIGIBLE: 'SCHEME_NOT_ELIGIBLE',
  APPLICATION_DEADLINE_PASSED: 'APPLICATION_DEADLINE_PASSED',
  DUPLICATE_APPLICATION: 'DUPLICATE_APPLICATION',
  INSUFFICIENT_BUDGET: 'INSUFFICIENT_BUDGET',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  APPLICATION_SUBMITTED: 'Application submitted successfully',
  APPLICATION_APPROVED: 'Application approved successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  DOCUMENT_UPLOADED: 'Document uploaded successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  NOTIFICATION_SENT: 'Notification sent successfully'
} as const;

/**
 * Regular expressions
 */
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  PINCODE: /^[1-9][0-9]{5}$/,
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  EMPLOYEE_ID: /^[A-Z0-9]{6,10}$/
} as const;