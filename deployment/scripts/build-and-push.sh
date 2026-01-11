#!/bin/bash

# LTET Employee Trust Portal - Build and Push Docker Images
# This script builds and pushes all service images to ECR

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG=${IMAGE_TAG:-latest}
BUILD_NUMBER=${BUILD_NUMBER:-$(date +%Y%m%d-%H%M%S)}

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
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if we can access ECR
    if ! aws ecr describe-repositories --region ${AWS_REGION} &> /dev/null; then
        log_error "Cannot access ECR. Check AWS credentials and permissions"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Login to ECR
ecr_login() {
    log_info "Logging in to ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | \
        docker login --username AWS --password-stdin ${ECR_REGISTRY}
    log_success "ECR login successful"
}

# Build and push a service image
build_and_push_service() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=${3:-.}
    
    log_info "Building ${service_name}..."
    
    # Build the image
    docker build \
        --target service-runtime \
        --file ${dockerfile_path} \
        --tag ${service_name}:${IMAGE_TAG} \
        --tag ${service_name}:${BUILD_NUMBER} \
        --build-arg SERVICE_NAME=${service_name} \
        --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
        ${context_path}
    
    # Tag for ECR
    docker tag ${service_name}:${IMAGE_TAG} ${ECR_REGISTRY}/ltet-prod-${service_name}:${IMAGE_TAG}
    docker tag ${service_name}:${BUILD_NUMBER} ${ECR_REGISTRY}/ltet-prod-${service_name}:${BUILD_NUMBER}
    
    # Push to ECR
    log_info "Pushing ${service_name} to ECR..."
    docker push ${ECR_REGISTRY}/ltet-prod-${service_name}:${IMAGE_TAG}
    docker push ${ECR_REGISTRY}/ltet-prod-${service_name}:${BUILD_NUMBER}
    
    log_success "${service_name} build and push completed"
}

# Build and push web application
build_and_push_web() {
    log_info "Building web application..."
    
    # Build the web app image
    docker build \
        --target web-runtime \
        --file deployment/docker/Dockerfile.production \
        --tag web-app:${IMAGE_TAG} \
        --tag web-app:${BUILD_NUMBER} \
        --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
        .
    
    # Tag for ECR
    docker tag web-app:${IMAGE_TAG} ${ECR_REGISTRY}/ltet-prod-web-app:${IMAGE_TAG}
    docker tag web-app:${BUILD_NUMBER} ${ECR_REGISTRY}/ltet-prod-web-app:${BUILD_NUMBER}
    
    # Push to ECR
    log_info "Pushing web application to ECR..."
    docker push ${ECR_REGISTRY}/ltet-prod-web-app:${IMAGE_TAG}
    docker push ${ECR_REGISTRY}/ltet-prod-web-app:${BUILD_NUMBER}
    
    log_success "Web application build and push completed"
}

# Create service-specific Dockerfiles
create_service_dockerfiles() {
    log_info "Creating service-specific Dockerfiles..."
    
    # Services to build
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service")
    
    for service in "${services[@]}"; do
        cat > "deployment/docker/Dockerfile.${service}" << EOF
FROM service-runtime AS ${service}

# Copy service-specific files
COPY --from=builder --chown=nodejs:nodejs /app/apps/${service}/dist ./apps/${service}/dist

# Set service-specific environment
ENV SERVICE_NAME=${service}
ENV PORT=3000

# Health check for this service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Start the service
CMD ["node", "apps/${service}/dist/main.js"]
EOF
    done
    
    log_success "Service Dockerfiles created"
}

# Clean up old images
cleanup_images() {
    log_info "Cleaning up old Docker images..."
    
    # Remove old local images (keep last 3 builds)
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        grep -E "(user-service|scheme-service|application-service|document-service|notification-service|web-app)" | \
        sort -k2 -r | \
        tail -n +10 | \
        awk '{print $1}' | \
        xargs -r docker rmi -f 2>/dev/null || true
    
    log_success "Image cleanup completed"
}

# Main execution
main() {
    log_info "Starting LTET Portal build and push process..."
    log_info "Build Number: ${BUILD_NUMBER}"
    log_info "Image Tag: ${IMAGE_TAG}"
    log_info "ECR Registry: ${ECR_REGISTRY}"
    
    # Check prerequisites
    check_prerequisites
    
    # Login to ECR
    ecr_login
    
    # Create service-specific Dockerfiles
    create_service_dockerfiles
    
    # Build and push services
    services=("user-service" "scheme-service" "application-service" "document-service" "notification-service")
    
    for service in "${services[@]}"; do
        build_and_push_service ${service} "deployment/docker/Dockerfile.${service}"
    done
    
    # Build and push web application
    build_and_push_web
    
    # Clean up old images
    cleanup_images
    
    log_success "All images built and pushed successfully!"
    log_info "Images available at:"
    for service in "${services[@]}" "web-app"; do
        echo "  ${ECR_REGISTRY}/ltet-prod-${service}:${IMAGE_TAG}"
        echo "  ${ECR_REGISTRY}/ltet-prod-${service}:${BUILD_NUMBER}"
    done
}

# Handle script interruption
trap 'log_error "Build process interrupted"; exit 1' INT TERM

# Run main function
main "$@"