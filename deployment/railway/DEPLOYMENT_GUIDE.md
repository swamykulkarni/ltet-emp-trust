# LTET Employee Trust Portal - Complete Railway Deployment Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Railway account ([sign up here](https://railway.app))
- Git repository with LTET portal code
- Railway CLI installed

### One-Command Deployment

```bash
# Clone and deploy in one go
git clone <your-repo-url>
cd ltet-employee-trust-portal
./deployment/railway/deploy.sh
```

That's it! Your LTET portal will be live in ~5 minutes.

## 📋 Detailed Deployment Steps

### Step 1: Install Railway CLI

```bash
# Using npm
npm install -g @railway/cli

# Using curl (macOS/Linux)
curl -fsSL https://railway.app/install.sh | sh

# Using Homebrew (macOS)
brew install railway/tap/railway
```

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Initialize Project

```bash
# In your project directory
railway init ltet-employee-trust-portal
```

### Step 4: Add Database Services

```bash
# Add PostgreSQL
railway add --database postgresql

# Add Redis
railway add --database redis
```

### Step 5: Configure Environment Variables

```bash
# Generate secrets
export JWT_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)

# Set core variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway variables set DEMO_MODE=true

# Set mock API configurations
railway variables set MOCK_HRMS_ENABLED=true
railway variables set MOCK_SAP_ENABLED=true
railway variables set MOCK_PAYMENT_GATEWAY_ENABLED=true

# Configure email (replace with your credentials)
railway variables set SMTP_USER=your-email@gmail.com
railway variables set SMTP_PASS=your-app-password
```

### Step 6: Deploy Application

```bash
railway up --detach
```

### Step 7: Run Database Migrations

```bash
# Wait for deployment to complete, then run migrations
railway run npm run db:migrate
```

### Step 8: Access Your Application

```bash
# Get your application URL
railway domain

# Open in browser
railway open
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Deployment                       │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                        │
│  ├── User Service (Express.js)                             │
│  ├── Scheme Service (Express.js)                           │
│  ├── Application Service (Express.js)                      │
│  ├── Document Service (Express.js)                         │
│  └── Notification Service (Express.js)                     │
│                                                             │
│  Data Layer:                                               │
│  ├── PostgreSQL Database (Railway)                         │
│  └── Redis Cache (Railway)                                 │
│                                                             │
│  Mock External APIs:                                       │
│  ├── Mock HRMS API                                         │
│  ├── Mock SAP API                                          │
│  └── Mock Payment Gateway API                              │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Details

### Environment Variables

#### Core Application
```bash
NODE_ENV=production
DEMO_MODE=true
JWT_SECRET=<generated-secret>
ENCRYPTION_KEY=<generated-key>
```

#### Database (Auto-provided by Railway)
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

#### Mock External APIs
```bash
HRMS_API_URL=https://mock-hrms.railway.app
SAP_API_URL=https://mock-sap.railway.app
PAYMENT_GATEWAY_BASE_URL=https://mock-payment.railway.app
MOCK_HRMS_ENABLED=true
MOCK_SAP_ENABLED=true
MOCK_PAYMENT_GATEWAY_ENABLED=true
```

#### Email Notifications
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Service Configuration

Each microservice runs on Railway with:
- **Auto-scaling**: Based on CPU/memory usage
- **Health checks**: `/health` endpoint monitoring
- **Logging**: Centralized log aggregation
- **Metrics**: Built-in performance monitoring

## 🎯 Demo Features

### Pre-configured Demo Data
- **Admin User**: admin@ltet-demo.com / Demo@123
- **Regular User**: user@ltet-demo.com / User@123
- **Sample Schemes**: Medical, Education, Housing, Vehicle
- **Mock Employees**: 50+ sample employee profiles
- **Demo Applications**: Various application states

### Mock External Services
- **HRMS Integration**: Employee data lookup simulation
- **SAP Integration**: Payment processing simulation
- **Payment Gateway**: Bank validation and transfer simulation
- **OCR Service**: Document processing simulation

### Functional Features
- ✅ User authentication and authorization
- ✅ Scheme discovery and eligibility checking
- ✅ Application submission and tracking
- ✅ Document upload and processing
- ✅ Payment processing and reconciliation
- ✅ Multi-channel notifications
- ✅ Admin dashboard and reporting
- ✅ AI-powered recommendations
- ✅ Automated approval workflows

## 💰 Cost Breakdown

### Railway Pricing (Monthly)
- **Web App**: $5/month
- **User Service**: $5/month
- **Scheme Service**: $5/month
- **Application Service**: $5/month
- **Document Service**: $5/month
- **Notification Service**: $5/month
- **PostgreSQL**: $5/month
- **Redis**: $5/month
- **Total**: ~$40/month

### Included Features
- **SSL Certificate**: Free (automatic)
- **Custom Domain**: Free
- **Bandwidth**: 100GB included
- **Storage**: 1GB per service
- **Backups**: Automatic daily backups
- **Monitoring**: Built-in metrics and logs

## 📊 Monitoring and Management

### Railway Dashboard
Access at [railway.app/dashboard](https://railway.app/dashboard)

Features:
- Real-time metrics (CPU, memory, network)
- Application logs with filtering
- Deployment history and rollbacks
- Environment variable management
- Service scaling controls

### CLI Commands

```bash
# View application logs
railway logs

# Check service status
railway status

# Scale services
railway scale --replicas 2

# Connect to database
railway connect postgres

# Run commands in production
railway run <command>

# Open application
railway open

# View metrics
railway metrics
```

### Health Monitoring

```bash
# Check application health
curl https://your-app.railway.app/health

# Check individual services
curl https://your-app.railway.app/api/user/health
curl https://your-app.railway.app/api/scheme/health
curl https://your-app.railway.app/api/application/health
curl https://your-app.railway.app/api/document/health
curl https://your-app.railway.app/api/notification/health
```

## 🔒 Security Configuration

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Session management
- Account lockout protection

### Data Security
- Encryption at rest and in transit
- Secure password hashing (bcrypt)
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Network Security
- HTTPS enforcement
- CORS configuration
- Rate limiting
- Security headers (Helmet.js)
- Content Security Policy (CSP)

## 🚨 Troubleshooting

### Common Issues

#### 1. Deployment Fails
```bash
# Check build logs
railway logs --build

# Redeploy
railway up --detach
```

#### 2. Database Connection Issues
```bash
# Check database status
railway status

# Restart database
railway restart postgres

# Check connection string
railway variables | grep DATABASE_URL
```

#### 3. Environment Variables Not Set
```bash
# List all variables
railway variables

# Set missing variables
railway variables set KEY=value

# Bulk set from file
railway variables set --from-file .env
```

#### 4. Service Not Responding
```bash
# Check service logs
railway logs --service user-service

# Restart service
railway restart user-service

# Check health endpoint
curl https://your-app.railway.app/api/user/health
```

### Debug Mode

Enable debug logging:
```bash
railway variables set DEBUG_MODE=true
railway variables set LOG_LEVEL=debug
```

### Performance Issues

Check metrics and scale if needed:
```bash
# View metrics
railway metrics

# Scale up
railway scale --replicas 2

# Check resource usage
railway logs | grep "Memory\|CPU"
```

## 🔄 Updates and Maintenance

### Deploying Updates

```bash
# Deploy latest changes
git push origin main
railway up --detach
```

### Database Migrations

```bash
# Run new migrations
railway run npm run db:migrate

# Rollback if needed
railway run npm run db:rollback
```

### Backup and Recovery

```bash
# Manual backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore from backup
railway run psql $DATABASE_URL < backup.sql
```

## 🎓 Next Steps

### For Demo/Testing
1. **Explore Features**: Test all portal functionality
2. **User Training**: Create user guides and documentation
3. **Feedback Collection**: Gather stakeholder feedback
4. **Performance Testing**: Test with expected user loads

### For Production Migration
1. **Replace Mock APIs**: Configure real HRMS, SAP, Payment Gateway
2. **Security Hardening**: Update secrets, enable additional security
3. **Custom Domain**: Configure your organization's domain
4. **Monitoring Setup**: Implement comprehensive monitoring
5. **Backup Strategy**: Set up robust backup and recovery
6. **Load Testing**: Validate performance under production loads

### Scaling Considerations
- **Horizontal Scaling**: Add more service replicas
- **Database Optimization**: Implement read replicas
- **CDN Integration**: Use Railway's CDN for static assets
- **Caching Strategy**: Optimize Redis usage
- **Load Balancing**: Configure load balancing rules

## 📞 Support

### Railway Support
- **Documentation**: [docs.railway.app](https://docs.railway.app)
- **Community**: [Railway Discord](https://discord.gg/railway)
- **Support**: [help.railway.app](https://help.railway.app)

### LTET Portal Support
- **Application Logs**: `railway logs`
- **Health Checks**: Monitor `/health` endpoints
- **Metrics Dashboard**: Railway dashboard metrics
- **Debug Mode**: Enable for detailed logging

## 🎉 Success!

Your LTET Employee Trust Portal is now running on Railway! 

**Demo URL**: https://your-app.railway.app
**Admin Login**: admin@ltet-demo.com / Demo@123
**User Login**: user@ltet-demo.com / User@123

The portal includes all features for a complete demo experience with mock external integrations. Perfect for showcasing to stakeholders and gathering feedback before production deployment.