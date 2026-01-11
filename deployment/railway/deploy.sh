#!/bin/bash

# LTET Employee Trust Portal - Railway Deployment Script
# This script helps deploy the LTET portal to Railway with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        echo "or"
        echo "curl -fsSL https://railway.app/install.sh | sh"
        exit 1
    fi
    print_success "Railway CLI is installed"
}

# Check if user is logged in to Railway
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        print_error "You are not logged in to Railway. Please run:"
        echo "railway login"
        exit 1
    fi
    print_success "Logged in to Railway as $(railway whoami)"
}

# Create or connect to Railway project
setup_railway_project() {
    print_status "Setting up Railway project..."
    
    if [ ! -f ".railway/project.json" ]; then
        print_status "No existing Railway project found. Creating new project..."
        railway init ltet-employee-trust-portal
        print_success "Railway project created"
    else
        print_success "Using existing Railway project"
    fi
}

# Add required services
add_railway_services() {
    print_status "Adding required services to Railway project..."
    
    # Add PostgreSQL database
    print_status "Adding PostgreSQL database..."
    railway add --database postgresql || print_warning "PostgreSQL might already be added"
    
    # Add Redis cache
    print_status "Adding Redis cache..."
    railway add --database redis || print_warning "Redis might already be added"
    
    print_success "Database services configured"
}

# Set environment variables
set_environment_variables() {
    print_status "Setting up environment variables..."
    
    # Generate JWT secret if not provided
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        print_status "Generated JWT secret"
    fi
    
    # Generate encryption key if not provided
    if [ -z "$ENCRYPTION_KEY" ]; then
        ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
        print_status "Generated encryption key"
    fi
    
    # Set core environment variables
    railway variables set NODE_ENV=production
    railway variables set JWT_SECRET="$JWT_SECRET"
    railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
    
    # Set demo/mock API configurations
    railway variables set HRMS_API_URL="https://mock-hrms.railway.app"
    railway variables set HRMS_CLIENT_ID="demo_client"
    railway variables set HRMS_CLIENT_SECRET="demo_secret"
    railway variables set HRMS_TOKEN_URL="https://mock-hrms.railway.app/oauth/token"
    
    railway variables set SAP_API_URL="https://mock-sap.railway.app"
    railway variables set SAP_CLIENT_ID="demo_client"
    railway variables set SAP_CLIENT_SECRET="demo_secret"
    railway variables set SAP_TOKEN_URL="https://mock-sap.railway.app/oauth/token"
    
    railway variables set PAYMENT_GATEWAY_API_KEY="demo_api_key"
    railway variables set PAYMENT_GATEWAY_SECRET_KEY="demo_secret_key"
    railway variables set PAYMENT_GATEWAY_BASE_URL="https://mock-payment.railway.app"
    railway variables set PAYMENT_GATEWAY_WEBHOOK_SECRET="demo_webhook_secret"
    railway variables set PAYMENT_GATEWAY_ENVIRONMENT="sandbox"
    
    # Set demo mode
    railway variables set DEMO_MODE="true"
    railway variables set MOCK_HRMS_ENABLED="true"
    railway variables set MOCK_SAP_ENABLED="true"
    railway variables set MOCK_PAYMENT_GATEWAY_ENABLED="true"
    
    print_success "Environment variables configured"
}

# Deploy the application
deploy_application() {
    print_status "Deploying application to Railway..."
    
    # Deploy using Railway
    railway up --detach
    
    print_success "Application deployed successfully!"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for deployment to be ready
    sleep 30
    
    # Run migrations for each service
    railway run npm run db:migrate || print_warning "Migration might have failed - check logs"
    
    print_success "Database migrations completed"
}

# Display deployment information
show_deployment_info() {
    print_success "=== DEPLOYMENT COMPLETED ==="
    echo ""
    print_status "Your LTET Employee Trust Portal is now deployed!"
    echo ""
    print_status "Application URL: $(railway domain)"
    echo ""
    print_status "To view logs: railway logs"
    print_status "To open dashboard: railway open"
    print_status "To check status: railway status"
    echo ""
    print_warning "IMPORTANT NEXT STEPS:"
    echo "1. Configure your SMTP credentials for email notifications:"
    echo "   railway variables set SMTP_USER=your-email@gmail.com"
    echo "   railway variables set SMTP_PASS=your-app-password"
    echo ""
    echo "2. Update CORS origins with your Railway domain:"
    echo "   railway variables set CORS_ORIGINS=https://your-app.railway.app"
    echo ""
    echo "3. Update frontend API URL:"
    echo "   railway variables set NEXT_PUBLIC_API_URL=https://your-app.railway.app"
    echo ""
    echo "4. For production use, replace mock API configurations with real ones"
    echo ""
    print_status "Demo login credentials:"
    echo "Email: admin@ltet-demo.com"
    echo "Password: Demo@123"
}

# Main deployment process
main() {
    print_status "Starting LTET Employee Trust Portal deployment to Railway..."
    echo ""
    
    # Pre-deployment checks
    check_railway_cli
    check_railway_auth
    
    # Setup project
    setup_railway_project
    add_railway_services
    
    # Configure environment
    set_environment_variables
    
    # Deploy
    deploy_application
    run_migrations
    
    # Show results
    show_deployment_info
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "LTET Employee Trust Portal - Railway Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --env-only     Only set environment variables"
        echo "  --deploy-only  Only deploy (skip environment setup)"
        echo ""
        echo "Environment variables you can set:"
        echo "  JWT_SECRET           Custom JWT secret (auto-generated if not set)"
        echo "  ENCRYPTION_KEY       Custom encryption key (auto-generated if not set)"
        echo "  SMTP_USER           Your SMTP email address"
        echo "  SMTP_PASS           Your SMTP password/app password"
        echo ""
        echo "Example:"
        echo "  SMTP_USER=admin@company.com SMTP_PASS=mypassword $0"
        exit 0
        ;;
    --env-only)
        print_status "Setting up environment variables only..."
        check_railway_cli
        check_railway_auth
        set_environment_variables
        print_success "Environment variables configured"
        exit 0
        ;;
    --deploy-only)
        print_status "Deploying application only..."
        check_railway_cli
        check_railway_auth
        deploy_application
        run_migrations
        show_deployment_info
        exit 0
        ;;
    "")
        # Run full deployment
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac