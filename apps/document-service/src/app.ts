import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { documentRoutes } from './routes/document.routes';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));

  // Compression middleware
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded files in development
  if (!process.env['NODE_ENV'] || process.env['NODE_ENV'] === 'development') {
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Document Service is healthy',
      timestamp: new Date().toISOString(),
      service: 'document-service',
      version: '1.0.0'
    });
  });

  // API routes
  app.use('/api/documents', documentRoutes);

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
      error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : error.message
    });
  });

  return app;
}