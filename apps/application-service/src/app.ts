import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import applicationRoutes from './routes/application.routes';
import financeRoutes from './routes/finance.routes';
import { integrationHealthRoutes } from './routes/integration-health.routes';
import backupRoutes from './routes/backup.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'application-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', applicationRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/integration/health', integrationHealthRoutes);
app.use('/api/backup', backupRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

export default app;