import app from './app';
import { environment } from './environments/environment';
import { db } from './database/connection';

async function bootstrap() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ Database connection established');

    // Start the server
    const server = app.listen(environment.port, () => {
      console.log(`🚀 Scheme Service running on port ${environment.port}`);
      console.log(`📊 Environment: ${environment.production ? 'production' : 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await db.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(async () => {
        await db.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start Scheme Service:', error);
    process.exit(1);
  }
}

bootstrap();