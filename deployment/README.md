# LTET Employee Trust Portal - Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the LTET Employee Trust Portal to production infrastructure.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker and Docker Compose installed
- kubectl configured for Kubernetes cluster access
- Terraform installed (for infrastructure provisioning)
- Domain name and SSL certificates ready

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Architecture                   │
├─────────────────────────────────────────────────────────────┤
│  Load Balancer (ALB)                                       │
│  ├── Web App (Next.js) - Auto Scaling Group               │
│  └── API Gateway                                           │
│      ├── User Service - ECS/Fargate                        │
│      ├── Scheme Service - ECS/Fargate                      │
│      ├── Application Service - ECS/Fargate                 │
│      ├── Document Service - ECS/Fargate                    │
│      └── Notification Service - ECS/Fargate               │
│                                                             │
│  Data Layer:                                               │
│  ├── RDS PostgreSQL (Multi-AZ)                            │
│  ├── ElastiCache Redis (Cluster Mode)                     │
│  ├── S3 (Document Storage)                                │
│  └── CloudFront CDN                                       │
│                                                             │
│  Monitoring & Security:                                    │
│  ├── CloudWatch Logs & Metrics                            │
│  ├── AWS WAF                                              │
│  ├── VPC with Private/Public Subnets                      │
│  └── Security Groups & NACLs                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

1. **Infrastructure Setup**
   ```bash
   cd deployment/terraform
   terraform init
   terraform plan
   terraform apply
   ```

2. **Build and Push Images**
   ```bash
   ./scripts/build-and-push.sh
   ```

3. **Deploy Services**
   ```bash
   ./scripts/deploy-production.sh
   ```

4. **Verify Deployment**
   ```bash
   ./scripts/health-check.sh
   ```

## Detailed Steps

### Phase 1: Infrastructure Provisioning
- VPC and networking setup
- RDS PostgreSQL database
- ElastiCache Redis cluster
- S3 buckets for document storage
- ECS cluster and task definitions

### Phase 2: Application Deployment
- Build Docker images
- Push to ECR
- Deploy microservices to ECS
- Deploy frontend to CloudFront

### Phase 3: Configuration and Testing
- Database migrations
- Environment configuration
- Health checks and monitoring
- Load testing

### Phase 4: Go-Live
- DNS cutover
- SSL certificate activation
- Monitoring alerts setup
- Backup verification

## Environment Variables

See `environments/production.env` for required environment variables.

## Monitoring and Alerts

- CloudWatch dashboards for system metrics
- Application performance monitoring
- Error tracking and alerting
- Log aggregation and analysis

## Backup and Recovery

- Automated daily database backups
- Document storage replication
- Disaster recovery procedures
- Point-in-time recovery capabilities

## Security

- WAF rules for application protection
- VPC security groups and NACLs
- Encryption at rest and in transit
- IAM roles and policies
- Security scanning and compliance

## Scaling

- Auto Scaling Groups for web tier
- ECS service auto-scaling
- Database read replicas
- CDN edge locations

## Support and Maintenance

- Deployment rollback procedures
- Blue-green deployment strategy
- Maintenance windows
- Update procedures