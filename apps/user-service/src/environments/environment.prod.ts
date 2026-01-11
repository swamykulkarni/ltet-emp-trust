export const environment = {
  production: true,
  port: process.env.USER_SERVICE_PORT || 3001,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  // Security configuration - all required in production
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY!,
  auditEncryptionKey: process.env.AUDIT_ENCRYPTION_KEY!,
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY!,
  sessionSecret: process.env.SESSION_SECRET!,
  httpsEnabled: true, // Always enabled in production
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: true, // Always enabled in production
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
  },
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD!,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ltet:',
    ttl: parseInt(process.env.REDIS_TTL || '3600')
  },
  hrms: {
    baseUrl: process.env.HRMS_BASE_URL!,
    apiKey: process.env.HRMS_API_KEY!,
    clientId: process.env.HRMS_CLIENT_ID!,
    clientSecret: process.env.HRMS_CLIENT_SECRET!,
    tokenUrl: process.env.HRMS_TOKEN_URL!,
    scope: process.env.HRMS_SCOPE || 'employee:read',
    timeout: parseInt(process.env.HRMS_TIMEOUT || '30000')
  },
  security: {
    rateLimiting: {
      enabled: true,
      loginWindow: 15 * 60 * 1000, // 15 minutes
      loginMax: 3, // Stricter in production
      apiWindow: 15 * 60 * 1000, // 15 minutes
      apiMax: 100
    },
    mfa: {
      required: true, // Always required in production
      gracePeriod: parseInt(process.env.MFA_GRACE_PERIOD || '604800000'), // 7 days
      issuer: process.env.MFA_ISSUER || 'LTET Portal'
    },
    audit: {
      enabled: true,
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'), // 7 years
      encryptLogs: true
    },
    session: {
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '28800000'), // 8 hours in production
      renewThreshold: parseInt(process.env.SESSION_RENEW_THRESHOLD || '14400000'), // 4 hours
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '2') // Stricter in production
    }
  }
};