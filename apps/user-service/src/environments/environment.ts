export const environment = {
  production: false,
  port: process.env.USER_SERVICE_PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  // Security configuration
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key-change-in-production',
  auditEncryptionKey: process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key-change-in-production',
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY || 'default-db-key-change-in-production',
  sessionSecret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
  httpsEnabled: process.env.HTTPS_ENABLED === 'true',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200', 'http://localhost:3000'],
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ltet_portal',
    ssl: process.env.DB_SSL === 'true',
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10')
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ltet:',
    ttl: parseInt(process.env.REDIS_TTL || '3600')
  },
  hrms: {
    baseUrl: process.env.HRMS_BASE_URL || 'http://localhost:8080/hrms',
    apiKey: process.env.HRMS_API_KEY || 'dev-hrms-key',
    clientId: process.env.HRMS_CLIENT_ID || 'ltet-portal-client',
    clientSecret: process.env.HRMS_CLIENT_SECRET || 'dev-client-secret',
    tokenUrl: process.env.HRMS_TOKEN_URL || 'http://localhost:8080/hrms/oauth/token',
    scope: process.env.HRMS_SCOPE || 'employee:read',
    timeout: parseInt(process.env.HRMS_TIMEOUT || '30000')
  },
  security: {
    rateLimiting: {
      enabled: true,
      loginWindow: 15 * 60 * 1000, // 15 minutes
      loginMax: 5,
      apiWindow: 15 * 60 * 1000, // 15 minutes
      apiMax: 100
    },
    mfa: {
      required: process.env.MFA_REQUIRED === 'true',
      gracePeriod: parseInt(process.env.MFA_GRACE_PERIOD || '604800000'), // 7 days
      issuer: process.env.MFA_ISSUER || 'LTET Portal'
    },
    audit: {
      enabled: true,
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'), // 7 years
      encryptLogs: true
    },
    session: {
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
      renewThreshold: parseInt(process.env.SESSION_RENEW_THRESHOLD || '14400000'), // 4 hours
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3')
    }
  }
};