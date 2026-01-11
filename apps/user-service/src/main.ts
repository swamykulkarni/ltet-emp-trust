import { createApp } from './app';
import { environment } from './environments/environment';
import { db } from './database/connection';
import { redisService } from './services/redis.service';
import { startupService } from '@ltet/shared-utils';

async function bootstrap() {
  try {
    // Initialize performance services
    await startupService.initialize({
      enableCaching: true,
      enablePerformanceMonitoring: true,
      enableDatabaseOptimization: true,
      enableCDN: process.env.CDN_ENABLED === 'true',
      preloadData: true,
      warmupCache: true
    });

    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ Database connection established');

    // Initialize Redis connection
    await redisService.connect();
    console.log('✅ Redis connection established');

    // Create Express app
    const app = createApp();

    // Start server
    const port = environment.port;
    app.listen(port, () => {
      console.log(`🚀 User Service is running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📈 Performance metrics: http://localhost:${port}/metrics`);
      console.log(`🔐 Auth API: http://localhost:${port}/api/auth`);
      console.log(`👤 User API: http://localhost:${port}/api/users`);
      console.log(`🌍 Environment: ${environment.production ? 'production' : 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      await startupService.shutdown();
      await redisService.disconnect();
      await db.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      await startupService.shutdown();
      await redisService.disconnect();
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start User Service:', error);
    process.exit(1);
  }
}

bootstrap();