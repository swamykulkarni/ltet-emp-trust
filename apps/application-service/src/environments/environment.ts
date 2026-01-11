export const environment = {
  production: false,
  port: process.env.PORT || 3003,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://ltet_user:ltet_password@localhost:5432/ltet_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
  sap: {
    clientId: process.env.SAP_CLIENT_ID || 'ltet-sap-client',
    clientSecret: process.env.SAP_CLIENT_SECRET || 'dev-sap-secret',
    tokenUrl: process.env.SAP_TOKEN_URL || 'http://localhost:8080/sap/oauth/token',
    baseUrl: process.env.SAP_BASE_URL || 'http://localhost:8080/sap/api',
    scope: process.env.SAP_SCOPE || 'payment:write'
  },
  paymentGateway: {
    apiKey: process.env.PAYMENT_GATEWAY_API_KEY || 'dev-gateway-key',
    secretKey: process.env.PAYMENT_GATEWAY_SECRET_KEY || 'dev-gateway-secret',
    baseUrl: process.env.PAYMENT_GATEWAY_BASE_URL || 'http://localhost:8080/gateway/api',
    webhookSecret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || 'dev-webhook-secret',
    environment: process.env.PAYMENT_GATEWAY_ENV || 'sandbox'
  }
};