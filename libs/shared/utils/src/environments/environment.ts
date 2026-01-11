export const environment = {
  production: process.env.NODE_ENV === 'production',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'ltet_portal',
    user: process.env.DB_USER || 'ltet_user',
    password: process.env.DB_PASSWORD || 'ltet_password',
    ssl: process.env.NODE_ENV === 'production',
    poolMax: parseInt(process.env.DB_POOL_MAX || '20'),
    poolMin: parseInt(process.env.DB_POOL_MIN || '5'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000')
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  },

  // Cache configuration
  cache: {
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
    enableLogging: process.env.CACHE_ENABLE_LOGGING === 'true',
    enableMetrics: process.env.CACHE_ENABLE_METRICS === 'true'
  },

  // CDN configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    baseUrl: process.env.CDN_BASE_URL || '',
    regions: (process.env.CDN_REGIONS || 'us-east-1,ap-south-1').split(','),
    cacheTTL: parseInt(process.env.CDN_CACHE_TTL || '3600'),
    assetVersion: process.env.ASSET_VERSION || 'v1'
  },

  // Performance configuration
  performance: {
    enableQueryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION !== 'false',
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
    maxConcurrentQueries: parseInt(process.env.MAX_CONCURRENT_QUERIES || '5'),
    enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true' || process.env.NODE_ENV === 'development'
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800000'), // 30 minutes
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000') // 15 minutes
  },

  // Monitoring and logging
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false'
  }
};

export default environment;