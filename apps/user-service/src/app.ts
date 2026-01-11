import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { performanceMiddleware } from '@ltet/shared-utils';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { lockoutRoutes } from './routes/lockout.routes';
import { hrmsIntegrationRoutes } from './routes/hrms-integration.routes';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));

  // Performance monitoring middleware
  app.use(performanceMiddleware.middleware());

  // Compression middleware
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting for authentication endpoints
  app.use('/api/auth', performanceMiddleware.rateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10 // 10 requests per window
  }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'User Service is healthy',
      timestamp: new Date().toISOString(),
      service: 'user-service',
      version: '1.0.0'
    });
  });

  // Performance metrics endpoint
  app.get('/metrics', (req, res) => {
    const metrics = performanceMiddleware.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(performanceMiddleware.exportMetrics());
  });

  // API routes with caching for read-only endpoints
  app.use('/api/auth', authRoutes);
  app.use('/api/users', 
    performanceMiddleware.cacheMiddleware(300), // 5 minutes cache for user data
    userRoutes
  );
  app.use('/api/lockout', lockoutRoutes);
  app.use('/api/hrms', 
    performanceMiddleware.cacheMiddleware(600), // 10 minutes cache for HRMS data
    hrmsIntegrationRoutes
  );

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    
    res.status(error.status || 500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  });

  return app;
}