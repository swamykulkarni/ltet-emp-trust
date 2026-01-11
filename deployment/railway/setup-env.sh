#!/bin/bash

# LTET Employee Trust Portal - Railway Environment Setup Script
# This script helps configure environment variables for Railway deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Generate secure random strings
generate_jwt_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32
    else
        # Fallback for systems without openssl
        head -c 32 /dev/urandom | base64
    fi
}

generate_encryption_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32 | cut -c1-32
    else
        # Fallback for systems without openssl
        head -c 24 /dev/urandom | base64 | cut -c1-32
    fi
}

# Check if Railway CLI is available
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
}

# Set core environment variables
set_core_variables() {
    print_status "Setting core environment variables..."
    
    # Generate secrets
    JWT_SECRET=$(generate_jwt_secret)
    ENCRYPTION_KEY=$(generate_encryption_key)
    SESSION_SECRET=$(generate_jwt_secret)
    
    # Set core variables
    railway variables set NODE_ENV=production
    railway variables set JWT_SECRET="$JWT_SECRET"
    railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
    railway variables set SESSION_SECRET="$SESSION_SECRET"
    
    print_success "Core variables set"
}

# Set demo mode variables
set_demo_variables() {
    print_status "Setting demo mode variables..."
    
    railway variables set DEMO_MODE=true
    railway variables set DEMO_DATA_ENABLED=true
    railway variables set DEBUG_MODE=true
    
    # Demo user credentials
    railway variables set DEMO_ADMIN_EMAIL=admin@ltet-demo.com
    railway variables set DEMO_ADMIN_PASSWORD=Demo@123
    railway variables set DEMO_USER_EMAIL=user@ltet-demo.com
    railway variables set DEMO_USER_PASSWORD=User@123
    
    print_success "Demo variables set"
}

# Set mock API variables
set_mock_api_variables() {
    print_status "Setting mock API variables..."
    
    # HRMS Mock Configuration
    railway variables set HRMS_API_URL=https://mock-hrms.railway.app
    railway variables set HRMS_CLIENT_ID=demo_client
    railway variables set HRMS_CLIENT_SECRET=demo_secret
    railway variables set HRMS_TOKEN_URL=https://mock-hrms.railway.app/oauth/token
    railway variables set HRMS_SCOPE=employee:read
    railway variables set MOCK_HRMS_ENABLED=true
    
    # SAP Mock Configuration
    railway variables set SAP_API_URL=https://mock-sap.railway.app
    railway variables set SAP_CLIENT_ID=demo_client
    railway variables set SAP_CLIENT_SECRET=demo_secret
    railway variables set SAP_TOKEN_URL=https://mock-sap.railway.app/oauth/token
    railway variables set SAP_BASE_URL=https://mock-sap.railway.app/api/v1
    railway variables set SAP_SCOPE=payment:write
    railway variables set MOCK_SAP_ENABLED=true
    
    # Payment Gateway Mock Configuration
    railway variables set PAYMENT_GATEWAY_API_KEY=demo_api_key
    railway variables set PAYMENT_GATEWAY_SECRET_KEY=demo_secret_key
    railway variables set PAYMENT_GATEWAY_BASE_URL=https://mock-payment.railway.app/api/v1
    railway variables set PAYMENT_GATEWAY_WEBHOOK_SECRET=demo_webhook_secret
    railway variables set PAYMENT_GATEWAY_ENVIRONMENT=sandbox
    railway variables set MOCK_PAYMENT_GATEWAY_ENABLED=true
    
    # OCR Mock Configuration
    railway variables set OCR_SERVICE_URL=https://mock-ocr.railway.app/api/v1
    railway variables set OCR_API_KEY=demo_ocr_key
    railway variables set MOCK_OCR_ENABLED=true
    
    # SMS Mock Configuration
    railway variables set SMS_API_KEY=demo_sms_key
    railway variables set SMS_API_URL=https://mock-sms.railway.app/api/v1
    railway variables set MOCK_SMS_ENABLED=true
    
    print_success "Mock API variables set"
}

# Set application configuration
set_app_config() {
    print_status "Setting application configuration..."
    
    # Rate limiting
    railway variables set RATE_LIMIT_WINDOW_MS=900000
    railway variables set RATE_LIMIT_MAX_REQUESTS=100
    railway variables set AUTH_RATE_LIMIT_MAX_ATTEMPTS=5
    
    # Caching
    railway variables set CACHE_TTL=3600
    railway variables set CACHE_PREFIX=ltet:
    railway variables set CACHE_ENABLED=true
    
    # File upload
    railway variables set MAX_FILE_SIZE=10485760
    railway variables set ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png,doc,docx
    
    # Business logic
    railway variables set AUTO_APPROVAL_ENABLED=true
    railway variables set AUTO_APPROVAL_THRESHOLD=50000
    railway variables set MANUAL_REVIEW_THRESHOLD=100000
    
    # Notifications
    railway variables set EMAIL_NOTIFICATION_ENABLED=true
    railway variables set SMS_NOTIFICATION_ENABLED=true
    railway variables set IN_APP_NOTIFICATION_ENABLED=true
    
    # Security
    railway variables set HELMET_ENABLED=true
    railway variables set CORS_ENABLED=true
    railway variables set COMPRESSION_ENABLED=true
    
    print_success "Application configuration set"
}

# Set email configuration
set_email_config() {
    print_status "Setting email configuration..."
    
    # Check if user provided SMTP credentials
    if [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; then
        railway variables set SMTP_HOST=smtp.gmail.com
        railway variables set SMTP_PORT=587
        railway variables set SMTP_SECURE=false
        railway variables set SMTP_USER="$SMTP_USER"
        railway variables set SMTP_PASS="$SMTP_PASS"
        railway variables set EMAIL_FROM="$SMTP_USER"
        railway variables set EMAIL_FROM_NAME="LTET Employee Trust Portal"
        print_success "Email configuration set with provided credentials"
    else
        print_warning "SMTP credentials not provided. Email notifications will be disabled."
        print_warning "To enable email notifications later, run:"
        echo "railway variables set SMTP_USER=your-email@gmail.com"
        echo "railway variables set SMTP_PASS=your-app-password"
    fi
}

# Set logging configuration
set_logging_config() {
    print_status "Setting logging configuration..."
    
    railway variables set LOG_LEVEL=info
    railway variables set LOG_FORMAT=json
    railway variables set ENABLE_REQUEST_LOGGING=true
    railway variables set ENABLE_ERROR_STACK_TRACE=true
    
    # Health checks
    railway variables set HEALTH_CHECK_ENABLED=true
    railway variables set HEALTH_CHECK_TIMEOUT=5000
    
    # Metrics
    railway variables set METRICS_ENABLED=true
    
    print_success "Logging configuration set"
}

# Set feature flags
set_feature_flags() {
    print_status "Setting feature flags..."
    
    railway variables set FEATURE_AI_RECOMMENDATIONS=true
    railway variables set FEATURE_AUTOMATED_APPROVAL=true
    railway variables set FEATURE_BULK_OPERATIONS=true
    railway variables set FEATURE_ADVANCED_REPORTING=true
    railway variables set FEATURE_MULTI_LANGUAGE=false
    railway variables set FEATURE_MOBILE_APP_API=true
    
    print_success "Feature flags set"
}

# Display summary
display_summary() {
    print_success "=== ENVIRONMENT CONFIGURATION COMPLETED ==="
    echo ""
    print_status "Configuration Summary:"
    echo "✅ Core security variables (JWT, encryption keys)"
    echo "✅ Demo mode enabled with sample data"
    echo "✅ Mock external APIs configured"
    echo "✅ Application settings optimized"
    echo "✅ Logging and monitoring enabled"
    echo "✅ Feature flags configured"
    
    if [ -n "$SMTP_USER" ]; then
        echo "✅ Email notifications configured"
    else
        echo "⚠️  Email notifications not configured (SMTP credentials needed)"
    fi
    
    echo ""
    print_status "Next Steps:"
    echo "1. Deploy your application: railway up --detach"
    echo "2. Run database migrations: railway run npm run db:migrate"
    echo "3. Access your app: railway open"
    echo ""
    print_status "Demo Login Credentials:"
    echo "Admin: admin@ltet-demo.com / Demo@123"
    echo "User:  user@ltet-demo.com / User@123"
    echo ""
    
    if [ -z "$SMTP_USER" ]; then
        print_warning "To enable email notifications, set SMTP credentials:"
        echo "railway variables set SMTP_USER=your-email@gmail.com"
        echo "railway variables set SMTP_PASS=your-app-password"
        echo ""
    fi
    
    print_status "View all variables: railway variables"
    print_status "View deployment logs: railway logs"
}

# Main function
main() {
    print_status "Starting LTET Employee Trust Portal environment setup..."
    echo ""
    
    # Check prerequisites
    check_railway_cli
    
    # Set all configuration
    set_core_variables
    set_demo_variables
    set_mock_api_variables
    set_app_config
    set_email_config
    set_logging_config
    set_feature_flags
    
    # Show summary
    display_summary
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "LTET Employee Trust Portal - Railway Environment Setup"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --core-only    Set only core variables (JWT, encryption)"
        echo "  --demo-only    Set only demo-related variables"
        echo "  --mock-only    Set only mock API variables"
        echo ""
        echo "Environment variables you can set before running:"
        echo "  SMTP_USER      Your SMTP email address"
        echo "  SMTP_PASS      Your SMTP password/app password"
        echo ""
        echo "Example:"
        echo "  SMTP_USER=admin@company.com SMTP_PASS=mypassword $0"
        exit 0
        ;;
    --core-only)
        print_status "Setting core variables only..."
        check_railway_cli
        set_core_variables
        print_success "Core variables configured"
        exit 0
        ;;
    --demo-only)
        print_status "Setting demo variables only..."
        check_railway_cli
        set_demo_variables
        print_success "Demo variables configured"
        exit 0
        ;;
    --mock-only)
        print_status "Setting mock API variables only..."
        check_railway_cli
        set_mock_api_variables
        print_success "Mock API variables configured"
        exit 0
        ;;
    "")
        # Run full setup
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac