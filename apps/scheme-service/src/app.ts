import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { environment } from './environments/environment';
import schemeRoutes from './routes/scheme.routes';
import discoveryRoutes from './routes/discovery.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(environment.cors));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'scheme-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/schemes', schemeRoutes);
app.use('/api/schemes', discoveryRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: environment.production ? 'Internal server error' : err.message,
    ...(environment.production ? {} : { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

export default app;