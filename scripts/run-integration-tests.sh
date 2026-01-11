#!/bin/bash

# LTET Integration Test Runner
# This script starts the services and runs integration tests

set -e

echo "🚀 Starting LTET Integration Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

print_status "Stopping any existing containers..."
docker-compose down --remove-orphans

print_status "Starting infrastructure services (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

print_status "Waiting for database to be ready..."
sleep 10

# Check if PostgreSQL is ready
until docker-compose exec -T postgres pg_isready -U ltet_user -d ltet_portal; do
    print_warning "Waiting for PostgreSQL..."
    sleep 2
done

print_status "Starting core services..."
docker-compose up -d user-service scheme-service application-service document-service

print_status "Waiting for services to be ready..."
sleep 15

# Function to check service health
check_service_health() {
    local service_name=$1
    local service_url=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$service_url/health" > /dev/null; then
            print_status "$service_name is healthy"
            return 0
        fi
        
        print_warning "Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed to start"
    return 1
}

# Check all services
print_status "Checking service health..."
check_service_health "User Service" "http://localhost:3001" || exit 1
check_service_health "Scheme Service" "http://localhost:3002" || exit 1
check_service_health "Application Service" "http://localhost:3003" || exit 1
check_service_health "Document Service" "http://localhost:3004" || exit 1

print_status "All services are healthy! Running integration tests..."

# Install test dependencies if needed
if [ ! -d "integration-tests/node_modules" ]; then
    print_status "Installing test dependencies..."
    cd integration-tests
    npm install
    cd ..
fi

# Run the integration tests
cd integration-tests
print_status "Running API contract tests..."
npm test -- api-contracts.test.ts

print_status "Running core services integration tests..."
npm test -- core-services.integration.test.ts

# Check test results
if [ $? -eq 0 ]; then
    print_status "✅ All integration tests passed!"
else
    print_error "❌ Some integration tests failed!"
    exit 1
fi

cd ..

print_status "Integration tests completed successfully!"
print_status "Services are running and communicating properly."

# Optionally stop services
read -p "Do you want to stop the services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Stopping services..."
    docker-compose down
    print_status "Services stopped."
else
    print_status "Services are still running. Use 'docker-compose down' to stop them."
fi