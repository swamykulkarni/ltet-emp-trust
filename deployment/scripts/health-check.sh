#!/bin/bash

# LTET Employee Trust Portal - Health Check Script
# Comprehensive health check for production deployment

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME=${CLUSTER_NAME:-ltet-prod-cluster}
TIMEOUT=${TIMEOUT:-30}

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

# Check ECS services health
check_ecs_services() {
    log_info "Checking ECS services health..."
    
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service" "web-app")
    all_healthy=true
    
    for service in "${services[@]}"; do
        # Get service status
        SERVICE_STATUS=$(aws ecs describe-services \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --query 'services[0].status' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "NOT_FOUND")
        
        RUNNING_COUNT=$(aws ecs describe-services \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --query 'services[0].runningCount' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "0")
        
        DESIRED_COUNT=$(aws ecs describe-services \
            --cluster ${CLUSTER_NAME} \
            --services ${service} \
            --query 'services[0].desiredCount' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "0")
        
        if [ "${SERVICE_STATUS}" = "ACTIVE" ] && [ "${RUNNING_COUNT}" -eq "${DESIRED_COUNT}" ] && [ "${RUNNING_COUNT}" -gt 0 ]; then
            log_success "${service}: HEALTHY (${RUNNING_COUNT}/${DESIRED_COUNT} tasks)"
        else
            log_error "${service}: UNHEALTHY (${RUNNING_COUNT}/${DESIRED_COUNT} tasks, status: ${SERVICE_STATUS})"
            all_healthy=false
        fi
    done
    
    return $([ "$all_healthy" = true ] && echo 0 || echo 1)
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    # Get RDS instance status
    DB_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier ltet-prod-postgres \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "NOT_FOUND")
    
    if [ "${DB_STATUS}" = "available" ]; then
        log_success "Database: HEALTHY (${DB_STATUS})"
        return 0
    else
        log_error "Database: UNHEALTHY (${DB_STATUS})"
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    log_info "Checking Redis connectivity..."
    
    # Get ElastiCache status
    REDIS_STATUS=$(aws elasticache describe-replication-groups \
        --replication-group-id ltet-prod-redis \
        --query 'ReplicationGroups[0].Status' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "NOT_FOUND")
    
    if [ "${REDIS_STATUS}" = "available" ]; then
        log_success "Redis: HEALTHY (${REDIS_STATUS})"
        return 0
    else
        log_error "Redis: UNHEALTHY (${REDIS_STATUS})"
        return 1
    fi
}

# Check load balancer health
check_load_balancer() {
    log_info "Checking load balancer health..."
    
    # Get ALB status
    ALB_STATE=$(aws elbv2 describe-load-balancers \
        --names ltet-prod-alb \
        --query 'LoadBalancers[0].State.Code' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "NOT_FOUND")
    
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names ltet-prod-alb \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "")
    
    if [ "${ALB_STATE}" = "active" ]; then
        log_success "Load Balancer: HEALTHY (${ALB_STATE})"
        
        # Check target group health
        TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
            --names ltet-prod-web-app \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "")
        
        if [ -n "${TARGET_GROUP_ARN}" ]; then
            HEALTHY_TARGETS=$(aws elbv2 describe-target-health \
                --target-group-arn ${TARGET_GROUP_ARN} \
                --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
                --output text \
                --region ${AWS_REGION} 2>/dev/null || echo "0")
            
            TOTAL_TARGETS=$(aws elbv2 describe-target-health \
                --target-group-arn ${TARGET_GROUP_ARN} \
                --query 'length(TargetHealthDescriptions)' \
                --output text \
                --region ${AWS_REGION} 2>/dev/null || echo "0")
            
            if [ "${HEALTHY_TARGETS}" -gt 0 ]; then
                log_success "Target Group: HEALTHY (${HEALTHY_TARGETS}/${TOTAL_TARGETS} targets)"
            else
                log_error "Target Group: UNHEALTHY (${HEALTHY_TARGETS}/${TOTAL_TARGETS} targets)"
                return 1
            fi
        fi
        
        return 0
    else
        log_error "Load Balancer: UNHEALTHY (${ALB_STATE})"
        return 1
    fi
}

# Check application endpoints
check_application_endpoints() {
    log_info "Checking application endpoints..."
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names ltet-prod-alb \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "")
    
    if [ -z "${ALB_DNS}" ]; then
        log_error "Could not get load balancer DNS name"
        return 1
    fi
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    if curl -f -s --max-time ${TIMEOUT} "http://${ALB_DNS}/health" > /dev/null; then
        log_success "Health endpoint: ACCESSIBLE"
    else
        log_error "Health endpoint: NOT ACCESSIBLE"
        return 1
    fi
    
    # Test API endpoints
    endpoints=("/api/health" "/api/user/health" "/api/schemes/health" "/api/applications/health")
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testing ${endpoint}..."
        if curl -f -s --max-time ${TIMEOUT} "http://${ALB_DNS}${endpoint}" > /dev/null; then
            log_success "${endpoint}: ACCESSIBLE"
        else
            log_warning "${endpoint}: NOT ACCESSIBLE (may be expected if service is not fully started)"
        fi
    done
    
    return 0
}

# Check S3 buckets
check_s3_buckets() {
    log_info "Checking S3 buckets..."
    
    # Get bucket names
    DOCUMENTS_BUCKET=$(aws s3api list-buckets \
        --query 'Buckets[?contains(Name, `ltet-prod-documents`)].Name' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "")
    
    BACKUPS_BUCKET=$(aws s3api list-buckets \
        --query 'Buckets[?contains(Name, `ltet-prod-backups`)].Name' \
        --output text \
        --region ${AWS_REGION} 2>/dev/null || echo "")
    
    if [ -n "${DOCUMENTS_BUCKET}" ]; then
        log_success "Documents bucket: ACCESSIBLE (${DOCUMENTS_BUCKET})"
    else
        log_error "Documents bucket: NOT FOUND"
        return 1
    fi
    
    if [ -n "${BACKUPS_BUCKET}" ]; then
        log_success "Backups bucket: ACCESSIBLE (${BACKUPS_BUCKET})"
    else
        log_error "Backups bucket: NOT FOUND"
        return 1
    fi
    
    return 0
}

# Check CloudWatch logs
check_cloudwatch_logs() {
    log_info "Checking CloudWatch logs..."
    
    LOG_GROUP="/ecs/ltet-prod"
    
    # Check if log group exists
    if aws logs describe-log-groups \
        --log-group-name-prefix ${LOG_GROUP} \
        --region ${AWS_REGION} \
        --query 'logGroups[0].logGroupName' \
        --output text 2>/dev/null | grep -q "${LOG_GROUP}"; then
        
        log_success "CloudWatch logs: ACCESSIBLE (${LOG_GROUP})"
        
        # Check recent log streams
        RECENT_STREAMS=$(aws logs describe-log-streams \
            --log-group-name ${LOG_GROUP} \
            --order-by LastEventTime \
            --descending \
            --max-items 5 \
            --query 'length(logStreams)' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "0")
        
        log_info "Recent log streams: ${RECENT_STREAMS}"
        return 0
    else
        log_error "CloudWatch logs: NOT ACCESSIBLE"
        return 1
    fi
}

# Generate health report
generate_health_report() {
    local overall_status=$1
    local timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    
    cat > "/tmp/health-report.json" << EOF
{
    "timestamp": "${timestamp}",
    "overall_status": "${overall_status}",
    "checks": {
        "ecs_services": ${ecs_check_result:-false},
        "database": ${db_check_result:-false},
        "redis": ${redis_check_result:-false},
        "load_balancer": ${lb_check_result:-false},
        "application_endpoints": ${app_check_result:-false},
        "s3_buckets": ${s3_check_result:-false},
        "cloudwatch_logs": ${logs_check_result:-false}
    },
    "environment": {
        "aws_region": "${AWS_REGION}",
        "cluster_name": "${CLUSTER_NAME}"
    }
}
EOF
    
    log_info "Health report generated: /tmp/health-report.json"
}

# Main health check function
main() {
    log_info "Starting LTET Portal health check..."
    log_info "Region: ${AWS_REGION}"
    log_info "Cluster: ${CLUSTER_NAME}"
    echo ""
    
    # Initialize check results
    ecs_check_result=false
    db_check_result=false
    redis_check_result=false
    lb_check_result=false
    app_check_result=false
    s3_check_result=false
    logs_check_result=false
    
    # Run health checks
    if check_ecs_services; then ecs_check_result=true; fi
    echo ""
    
    if check_database; then db_check_result=true; fi
    echo ""
    
    if check_redis; then redis_check_result=true; fi
    echo ""
    
    if check_load_balancer; then lb_check_result=true; fi
    echo ""
    
    if check_application_endpoints; then app_check_result=true; fi
    echo ""
    
    if check_s3_buckets; then s3_check_result=true; fi
    echo ""
    
    if check_cloudwatch_logs; then logs_check_result=true; fi
    echo ""
    
    # Determine overall status
    if [ "$ecs_check_result" = true ] && [ "$db_check_result" = true ] && [ "$redis_check_result" = true ] && [ "$lb_check_result" = true ] && [ "$app_check_result" = true ] && [ "$s3_check_result" = true ] && [ "$logs_check_result" = true ]; then
        overall_status="HEALTHY"
        log_success "Overall Status: HEALTHY ✅"
        exit_code=0
    else
        overall_status="UNHEALTHY"
        log_error "Overall Status: UNHEALTHY ❌"
        exit_code=1
    fi
    
    # Generate report
    generate_health_report "$overall_status"
    
    echo ""
    log_info "Health check completed"
    
    exit $exit_code
}

# Handle script interruption
trap 'log_error "Health check interrupted"; exit 1' INT TERM

# Run main function
main "$@"