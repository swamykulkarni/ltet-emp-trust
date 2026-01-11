export const environment = {
  production: true,
  port: process.env.PORT || 3003,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET
};