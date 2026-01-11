export const environment = {
  production: false,
  port: process.env['SCHEME_SERVICE_PORT'] || 3002,
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432'),
    username: process.env['DB_USERNAME'] || 'ltet_user',
    password: process.env['DB_PASSWORD'] || 'ltet_password',
    database: process.env['DB_NAME'] || 'ltet_portal',
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    password: process.env['REDIS_PASSWORD'],
  },
  jwt: {
    secret: process.env['JWT_SECRET'] || 'ltet-scheme-service-secret',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    credentials: true,
  },
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
  },
};