#!/bin/bash

# LTET Employee Trust Portal - Production Deployment Script
# This script deploys the application to AWS ECS

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME=${CLUSTER_NAME:-ltet-prod-cluster}
IMAGE_TAG=${IMAGE_TAG:-latest}
DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-600}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if cluster exists
    if ! aws ecs describe-clusters --clusters ${CLUSTER_NAME} --region ${AWS_REGION} &> /dev/null; then
        log_error "ECS cluster ${CLUSTER_NAME} not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create ECS task definitions
create_task_definitions() {
    log_info "Creating ECS task definitions..."
    
    # Get infrastructure outputs
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=ltet-prod-vpc" --query 'Vpcs[0].VpcId' --output text --region ${AWS_REGION})
    PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=*private*" --query 'Subnets[].SubnetId' --output text --region ${AWS_REGION})
    SECURITY_GROUP=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=ltet-prod-ecs-tasks*" --query 'SecurityGroups[0].GroupId' --output text --region ${AWS_REGION})
    EXECUTION_ROLE=$(aws iam get-role --role-name ltet-prod-ecs-task-execution --query 'Role.Arn' --output text)
    TASK_ROLE=$(aws iam get-role --role-name ltet-prod-ecs-task --query 'Role.Arn' --output text)
    LOG_GROUP="/ecs/ltet-prod"
    
    # Services configuration
    declare -A services=(
        ["user-service"]="3001"
        ["scheme-service"]="3002"
        ["application-service"]="3003"
        ["document-service"]="3004"
        ["notification-service"]="3005"
    )
    
    # Create task definition for each service
    for service in "${!services[@]}"; do
        port=${services[$service]}
        
        log_info "Creating task definition for ${service}..."
        
        cat > "/tmp/${service}-task-definition.json" << EOF
{
    "family": "ltet-prod-${service}",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "${EXECUTION_ROLE}",
    "taskRoleArn": "${TASK_ROLE}",
    "containerDefinitions": [
        {
            "name": "${service}",
            "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ltet-prod-${service}:${IMAGE_TAG}",
            "portMappings": [
                {
                    "containerPort": ${port},
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "${LOG_GROUP}",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "${service}"
                }
            },
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "PORT", "value": "${port}"},
                {"name": "SERVICE_NAME", "value": "${service}"}
            ],
            "secrets": [
                {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/ltet/prod/database-url"},
                {"name": "REDIS_URL", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/ltet/prod/redis-url"},
                {"name": "JWT_SECRET", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/ltet/prod/jwt-secret"}
            ],
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:${port}/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOF
        
        # Register task definition
        aws ecs register-task-definition \
            --cli-input-json file:///tmp/${service}-task-definition.json \
            --region ${AWS_REGION} > /dev/null
        
        log_success "Task definition for ${service} created"
    done
    
    # Create web app task definition
    log_info "Creating task definition for web-app..."
    
    cat > "/tmp/web-app-task-definition.json" << EOF
{
    "family": "ltet-prod-web-app",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "executionRoleArn": "${EXECUTION_ROLE}",
    "taskRoleArn": "${TASK_ROLE}",
    "containerDefinitions": [
        {
            "name": "web-app",
            "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ltet-prod-web-app:${IMAGE_TAG}",
            "portMappings": [
                {
                    "containerPort": 3000,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "${LOG_GROUP}",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "web-app"
                }
            },
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "PORT", "value": "3000"}
            ],
            "secrets": [
                {"name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/ltet/prod/nextauth-secret"}
            ],
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOF
    
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/web-app-task-definition.json \
        --region ${AWS_REGION} > /dev/null
    
    log_success "Task definition for web-app created"
}

# Create ECS services
create_services() {
    log_info "Creating ECS services..."
    
    # Get infrastructure details
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=ltet-prod-vpc" --query 'Vpcs[0].VpcId' --output text --region ${AWS_REGION})
    PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=*private*" --query 'Subnets[].SubnetId' --output text --region ${AWS_REGION} | tr '\t' ',')
    SECURITY_GROUP=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=ltet-prod-ecs-tasks*" --query 'SecurityGroups[0].GroupId' --output text --region ${AWS_REGION})
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --names ltet-prod-web-app --query 'TargetGroups[0].TargetGroupArn' --output text --region ${AWS_REGION})
    
    # Services to deploy
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service")
    
    # Create backend services
    for service in "${services[@]}"; do
        log_info "Creating ECS service for ${service}..."
        
        aws ecs create-service \
            --cluster ${CLUSTER_NAME} \
            --service-name ${service} \
            --task-definition ltet-prod-${service} \
            --desired-count 2 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=DISABLED}" \
            --enable-execute-command \
            --region ${AWS_REGION} > /dev/null
        
        log_success "ECS service for ${service} created"
    done
    
    # Create web app service with load balancer
    log_info "Creating ECS service for web-app..."
    
    aws ecs create-service \
        --cluster ${CLUSTER_NAME} \
        --service-name web-app \
        --task-definition ltet-prod-web-app \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=DISABLED}" \
        --load-balancers "targetGroupArn=${TARGET_GROUP_ARN},containerName=web-app,containerPort=3000" \
        --enable-execute-command \
        --region ${AWS_REGION} > /dev/null
    
    log_success "ECS service for web-app created"
}

# Wait for services to be stable
wait_for_deployment() {
    log_info "Waiting for services to become stable..."
    
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service" "web-app")
    
    for service in "${services[@]}"; do
        log_info "Waiting for ${service} to stabilize..."
        
        aws ecs wait services-stable \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --region ${AWS_REGION}
        
        log_success "${service} is stable"
    done
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Get a running task ARN for application-service
    TASK_ARN=$(aws ecs list-tasks \
        --cluster ${CLUSTER_NAME} \
        --service-name application-service \
        --desired-status RUNNING \
        --query 'taskArns[0]' \
        --output text \
        --region ${AWS_REGION})
    
    if [ "${TASK_ARN}" != "None" ] && [ -n "${TASK_ARN}" ]; then
        log_info "Running migrations on task ${TASK_ARN}..."
        
        aws ecs execute-command \
            --cluster ${CLUSTER_NAME} \
            --task ${TASK_ARN} \
            --container application-service \
            --interactive \
            --command "npm run migrate:prod" \
            --region ${AWS_REGION}
        
        log_success "Database migrations completed"
    else
        log_warning "No running application-service task found. Migrations may need to be run manually."
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names ltet-prod-alb \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region ${AWS_REGION})
    
    # Test health endpoint
    if curl -f -s "http://${ALB_DNS}/health" > /dev/null; then
        log_success "Health check passed"
    else
        log_warning "Health check failed. Application may still be starting up."
    fi
    
    # Check service status
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service" "web-app")
    
    for service in "${services[@]}"; do
        RUNNING_COUNT=$(aws ecs describe-services \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --query 'services[0].runningCount' \
            --output text \
            --region ${AWS_REGION})
        
        DESIRED_COUNT=$(aws ecs describe-services \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --query 'services[0].desiredCount' \
            --output text \
            --region ${AWS_REGION})
        
        if [ "${RUNNING_COUNT}" -eq "${DESIRED_COUNT}" ]; then
            log_success "${service}: ${RUNNING_COUNT}/${DESIRED_COUNT} tasks running"
        else
            log_warning "${service}: ${RUNNING_COUNT}/${DESIRED_COUNT} tasks running"
        fi
    done
    
    log_info "Application URL: http://${ALB_DNS}"
}

# Main deployment function
main() {
    log_info "Starting LTET Portal production deployment..."
    
    # Get AWS Account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Check prerequisites
    check_prerequisites
    
    # Create task definitions
    create_task_definitions
    
    # Create services
    create_services
    
    # Wait for deployment to complete
    wait_for_deployment
    
    # Run database migrations
    run_migrations
    
    # Verify deployment
    verify_deployment
    
    log_success "Production deployment completed successfully!"
    log_info "Next steps:"
    echo "  1. Configure DNS to point to the load balancer"
    echo "  2. Set up SSL certificate"
    echo "  3. Configure monitoring and alerts"
    echo "  4. Run integration tests"
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"