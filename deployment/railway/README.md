# LTET Employee Trust Portal - Railway Deployment Guide

This guide provides step-by-step instructions for deploying the LTET Employee Trust Portal to Railway for demo purposes.

## Overview

Railway deployment provides:
- **Cost**: $25-40/month for demo deployment
- **Features**: PostgreSQL, Redis, HTTPS/SSL, custom domains, Git deployments
- **Scalability**: Auto-scaling based on traffic
- **Monitoring**: Built-in metrics and logging
- **Demo Setup**: Mock external APIs for HRMS, SAP, and Payment Gateway

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI**: Install the Railway CLI
3. **Git Repository**: Your code should be in a Git repository
4. **Node.js**: Version 18 or higher

## Quick Start

### 1. Install Railway CLI

```bash
# Using npm
npm install -g @railway/cli

# Or using curl
curl -fsSL https://railway.app/install.sh | sh
```

### 2. Login to Railway

```bash
railway login
```

### 3. Deploy Using Our Script

```bash
# Run the automated deployment script
./deployment/railway/deploy.sh
```

The script will:
- Create a new Railway project
- Add PostgreSQL and Redis services
- Configure environment variables with demo/mock settings
- Deploy all microservices
- Run database migrations
- Provide you with the deployment URL

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Initialize Railway Project

```bash
railway init ltet-employee-trust-portal
```

### 2. Add Database Services

```bash
# Add PostgreSQL
railway add --database postgresql

# Add Redis
railway add --database redis
```

### 3. Configure Environment Variables

Copy the template and configure:

```bash
cp deployment/railway/environment.template.env .env
```

Edit the `.env` file with your specific values, then set them in Railway:

```bash
# Set environment variables from file
railway variables set --from-file .env

# Or set individual variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-jwt-secret
railway variables set DEMO_MODE=true
```

### 4. Deploy Application

```bash
railway up
```

### 5. Run Database Migrations

```bash
railway run npm run db:migrate
```

## Service Architecture on Railway

The deployment creates the following services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Deployment                       │
├─────────────────────────────────────────────────────────────┤
│  Web App (Next.js)                                         │
│  ├── User Service (Node.js/Express)                        │
│  ├── Scheme Service (Node.js/Express)                      │
│  ├── Application Service (Node.js/Express)                 │
│  ├── Document Service (Node.js/Express)                    │
│  └── Notification Service (Node.js/Express)                │
│                                                             │
│  Data Layer:                                               │
│  ├── PostgreSQL Database                                   │
│  └── Redis Cache                                           │
│                                                             │
│  External APIs (Mock/Demo):                                │
│  ├── Mock HRMS API                                         │
│  ├── Mock SAP API                                          │
│  └── Mock Payment Gateway API                              │
└─────────────────────────────────────────────────────────────┘
```

## Environment Configuration

### Core Settings

```bash
# Application
NODE_ENV=production
DEMO_MODE=true

# Security
JWT_SECRET=your-super-secure-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# Database (automatically provided by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

### Mock External APIs (Demo Setup)

```bash
# HRMS Integration (Mock)
HRMS_API_URL=https://mock-hrms.railway.app
HRMS_CLIENT_ID=demo_client
HRMS_CLIENT_SECRET=demo_secret
MOCK_HRMS_ENABLED=true

# SAP Integration (Mock)
SAP_API_URL=https://mock-sap.railway.app
SAP_CLIENT_ID=demo_client
SAP_CLIENT_SECRET=demo_secret
MOCK_SAP_ENABLED=true

# Payment Gateway (Mock)
PAYMENT_GATEWAY_API_KEY=demo_api_key
PAYMENT_GATEWAY_SECRET_KEY=demo_secret_key
PAYMENT_GATEWAY_BASE_URL=https://mock-payment.railway.app
PAYMENT_GATEWAY_ENVIRONMENT=sandbox
MOCK_PAYMENT_GATEWAY_ENABLED=true
```

### Email Configuration (Required)

```bash
# Replace with your actual SMTP credentials
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Demo Features

The Railway deployment includes:

### 1. Mock External Services
- **HRMS Integration**: Simulated employee data lookup
- **SAP Integration**: Mock payment processing
- **Payment Gateway**: Sandbox payment simulation
- **OCR Service**: Mock document processing

### 2. Demo Data
- Pre-configured schemes and eligibility rules
- Sample employee profiles
- Demo applications and workflows

### 3. Admin Access
- **Email**: admin@ltet-demo.com
- **Password**: Demo@123
- Full administrative access to all features

## Cost Breakdown

### Railway Pricing (Demo Setup)
- **Starter Plan**: $5/month per service
- **Services**: 5 microservices = $25/month
- **PostgreSQL**: $5/month
- **Redis**: $5/month
- **Total**: ~$35/month

### Additional Costs
- **Custom Domain**: Free with Railway
- **SSL Certificate**: Free (automatic)
- **Bandwidth**: 100GB included
- **Storage**: 1GB included per service

## Monitoring and Management

### Railway Dashboard
- Access at [railway.app/dashboard](https://railway.app/dashboard)
- View metrics, logs, and deployments
- Manage environment variables
- Scale services up/down

### CLI Commands

```bash
# View logs
railway logs

# Check service status
railway status

# Open application
railway open

# Connect to database
railway connect postgres

# Run commands in production
railway run <command>

# Scale services
railway scale --replicas 2
```

## Troubleshooting

### Common Issues

1. **Deployment Fails**
   ```bash
   # Check build logs
   railway logs --build
   
   # Redeploy
   railway up --detach
   ```

2. **Database Connection Issues**
   ```bash
   # Check database status
   railway status
   
   # Restart database
   railway restart postgres
   ```

3. **Environment Variables Not Set**
   ```bash
   # List current variables
   railway variables
   
   # Set missing variables
   railway variables set KEY=value
   ```

### Health Checks

```bash
# Check application health
curl https://your-app.railway.app/health

# Check individual services
curl https://your-app.railway.app/api/user/health
curl https://your-app.railway.app/api/scheme/health
curl https://your-app.railway.app/api/application/health
```

## Production Considerations

### Security
- Replace all demo/mock credentials with real ones
- Enable proper authentication and authorization
- Configure CORS for your domain only
- Use strong, unique secrets

### Performance
- Enable Redis caching
- Configure CDN for static assets
- Monitor response times and optimize queries
- Set up proper logging and monitoring

### Backup
- Railway provides automatic database backups
- Consider additional backup strategies for critical data
- Test restore procedures regularly

## Migration to Production

When ready for production:

1. **Replace Mock APIs**: Configure real HRMS, SAP, and Payment Gateway
2. **Security Hardening**: Update all secrets and credentials
3. **Domain Setup**: Configure custom domain and SSL
4. **Monitoring**: Set up comprehensive monitoring and alerting
5. **Backup Strategy**: Implement robust backup and recovery
6. **Load Testing**: Test with expected user loads
7. **Documentation**: Update operational procedures

## Support

### Railway Support
- Documentation: [docs.railway.app](https://docs.railway.app)
- Community: [Railway Discord](https://discord.gg/railway)
- Support: [help.railway.app](https://help.railway.app)

### LTET Portal Support
- Check application logs: `railway logs`
- Review health endpoints
- Monitor Railway dashboard metrics
- Contact development team for application-specific issues

## Next Steps

After successful deployment:

1. **Test All Features**: Verify all functionality works correctly
2. **Configure Email**: Set up SMTP for notifications
3. **Custom Domain**: Add your custom domain if needed
4. **User Training**: Prepare user documentation and training
5. **Monitoring Setup**: Configure alerts and monitoring
6. **Backup Testing**: Verify backup and restore procedures

Your LTET Employee Trust Portal is now ready for demo use on Railway!