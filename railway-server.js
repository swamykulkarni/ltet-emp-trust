const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Important for Railway
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN;
const BASE_URL = RAILWAY_PUBLIC_DOMAIN ? `https://${RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for demo
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'LTET Employee Trust Portal',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    railway: {
      domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
      url: BASE_URL
    }
  });
});

// Keep-alive endpoint for Railway
app.get('/ping', (req, res) => {
  res.send('pong');
});

// API endpoints for demo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: ['user', 'scheme', 'application', 'document', 'notification'] });
});

// Mock authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Demo credentials
  if (email === 'demo@ltet.com' && password === 'demo123') {
    res.json({
      success: true,
      token: 'demo-jwt-token-' + Date.now(),
      user: {
        id: 1,
        email: 'demo@ltet.com',
        name: 'Demo User',
        role: 'employee',
        employeeId: 'EMP001'
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Mock user endpoints
app.get('/api/users/profile', (req, res) => {
  res.json({
    id: 1,
    email: 'demo@ltet.com',
    name: 'Demo User',
    role: 'employee',
    employeeId: 'EMP001',
    department: 'Engineering',
    joinDate: '2020-01-15',
    phone: '+91-9876543210',
    address: 'Mumbai, Maharashtra'
  });
});

// Mock schemes endpoints
app.get('/api/schemes', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Medical Reimbursement',
      description: 'Reimbursement for medical expenses',
      category: 'Healthcare',
      maxAmount: 50000,
      eligibility: 'All employees',
      status: 'active'
    },
    {
      id: 2,
      name: 'Education Loan',
      description: 'Educational assistance for employees and dependents',
      category: 'Education',
      maxAmount: 200000,
      eligibility: 'Employees with 2+ years service',
      status: 'active'
    },
    {
      id: 3,
      name: 'Housing Loan',
      description: 'Home loan assistance for employees',
      category: 'Housing',
      maxAmount: 2000000,
      eligibility: 'Permanent employees',
      status: 'active'
    }
  ]);
});

// Mock applications endpoints
app.get('/api/applications', (req, res) => {
  res.json([
    {
      id: 1,
      schemeId: 1,
      schemeName: 'Medical Reimbursement',
      amount: 15000,
      status: 'approved',
      submittedDate: '2024-01-10',
      approvedDate: '2024-01-12'
    },
    {
      id: 2,
      schemeId: 2,
      schemeName: 'Education Loan',
      amount: 100000,
      status: 'pending',
      submittedDate: '2024-01-08',
      approvedDate: null
    }
  ]);
});

app.post('/api/applications', (req, res) => {
  const { schemeId, amount, documents } = req.body;
  
  res.json({
    success: true,
    applicationId: Date.now(),
    message: 'Application submitted successfully',
    status: 'pending'
  });
});

// Mock documents endpoints
app.post('/api/documents/upload', (req, res) => {
  res.json({
    success: true,
    documentId: 'DOC' + Date.now(),
    message: 'Document uploaded successfully',
    status: 'processed'
  });
});

// Mock notifications endpoints
app.get('/api/notifications', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Application Approved',
      message: 'Your medical reimbursement application has been approved',
      type: 'success',
      date: '2024-01-12',
      read: false
    },
    {
      id: 2,
      title: 'Document Required',
      message: 'Please upload salary certificate for your education loan application',
      type: 'warning',
      date: '2024-01-10',
      read: true
    }
  ]);
});

// Serve static files (for the web app)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 LTET Employee Trust Portal is running on port ${PORT}`);
  console.log(`📊 Health check: ${BASE_URL}/health`);
  console.log(`🌐 Web app: ${BASE_URL}`);
  console.log(`🔗 API: ${BASE_URL}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Demo credentials: demo@ltet.com / demo123`);
  
  if (RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🚂 Railway Domain: ${RAILWAY_PUBLIC_DOMAIN}`);
    console.log(`🌐 Public URL: ${BASE_URL}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Keep the server running - Railway will handle container lifecycle
console.log('🎯 Server started successfully - Railway will manage lifecycle');