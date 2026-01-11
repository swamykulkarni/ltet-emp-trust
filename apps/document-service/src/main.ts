import { createApp } from './app';
import { environment } from './environments/environment';
import { db } from './database/connection';

async function bootstrap() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ Database connection established');

    // Create Express app
    const app = createApp();

    // Start server
    const port = environment.port;
    app.listen(port, () => {
      console.log(`🚀 Document Service is running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📄 Document API: http://localhost:${port}/api/documents`);
      console.log(`🌍 Environment: ${environment.production ? 'production' : 'development'}`);
      console.log(`🔍 OCR Provider: ${environment.ocr.provider}`);
      console.log(`☁️  Storage: ${environment.production ? 'AWS S3' : 'Local filesystem'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      await db.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Document Service:', error);
    process.exit(1);
  }
}

bootstrap();