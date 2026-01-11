import dotenv from 'dotenv';
import { createApp, startBackgroundJobs } from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3004;

async function bootstrap(): Promise<void> {
  try {
    // Create Express app
    const app = createApp();

    // Start background jobs
    await startBackgroundJobs();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Notification Service running on port ${PORT}`);
      console.log(`📧 Health check: http://localhost:${PORT}/health`);
      console.log(`📱 API docs: http://localhost:${PORT}/api/notifications`);
    });
  } catch (error) {
    console.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

bootstrap();