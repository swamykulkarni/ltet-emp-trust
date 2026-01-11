# Mock External Services Configuration

This document describes the mock/demo configurations for external API integrations used in the Railway deployment.

## Overview

For demo purposes, the LTET Employee Trust Portal uses mock implementations of external services:
- **HRMS Integration**: Employee data lookup and synchronization
- **SAP Integration**: Payment processing and financial operations
- **Payment Gateway**: Bank transfers and payment validation
- **OCR Service**: Document processing and text extraction

## Mock Service Implementations

### 1. HRMS Integration Service

**Purpose**: Employee data lookup and synchronization
**Mock Endpoint**: `https://mock-hrms.railway.app`

#### Mock Responses

```javascript
// Employee Data Lookup
GET /api/employees/{employeeId}
Response: {
  "success": true,
  "data": {
    "employeeId": "EMP001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "department": "Engineering",
    "designation": "Senior Developer",
    "joiningDate": "2020-01-15",
    "salary": 75000,
    "bankAccount": {
      "accountNumber": "1234567890",
      "ifscCode": "HDFC0001234",
      "bankName": "HDFC Bank"
    },
    "address": {
      "street": "123 Tech Street",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001"
    },
    "dependents": [
      {
        "name": "Jane Doe",
        "relationship": "Spouse",
        "dateOfBirth": "1985-05-20"
      }
    ]
  }
}

// Batch Employee Sync
POST /api/employees/batch
Request: {
  "employeeIds": ["EMP001", "EMP002", "EMP003"]
}
Response: {
  "success": true,
  "data": [/* array of employee objects */],
  "processed": 3,
  "failed": 0
}
```

#### Configuration

```bash
HRMS_API_URL=https://mock-hrms.railway.app
HRMS_CLIENT_ID=demo_client
HRMS_CLIENT_SECRET=demo_secret
HRMS_TOKEN_URL=https://mock-hrms.railway.app/oauth/token
HRMS_SCOPE=employee:read
MOCK_HRMS_ENABLED=true
```

### 2. SAP Integration Service

**Purpose**: Payment processing and financial operations
**Mock Endpoint**: `https://mock-sap.railway.app`

#### Mock Responses

```javascript
// Single Payment Processing
POST /api/payments
Request: {
  "payment_id": "PAY001",
  "beneficiary": {
    "name": "John Doe",
    "account_number": "1234567890",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank"
  },
  "amount": 50000,
  "currency": "INR",
  "purpose": "LTET Scheme Payment",
  "reference_number": "LTET_APP001_PAY001"
}
Response: {
  "success": true,
  "transaction_id": "TXN_SAP_001",
  "sap_reference": "SAP_REF_12345",
  "status": "initiated"
}

// Batch Payment Processing
POST /api/payments/batch
Request: {
  "batch_id": "BATCH001",
  "batch_name": "Monthly Scheme Payments",
  "total_amount": 500000,
  "total_count": 10,
  "payments": [/* array of payment objects */]
}
Response: {
  "success": true,
  "batch_reference": "SAP_BATCH_001",
  "processed_count": 10,
  "failed_count": 0,
  "total_amount": 500000,
  "errors": []
}

// Payment Status Check
GET /api/payments/{transactionId}/status
Response: {
  "success": true,
  "status": "processed",
  "transaction_id": "TXN_SAP_001",
  "completed_at": "2024-01-15T10:30:00Z"
}
```

#### Configuration

```bash
SAP_API_URL=https://mock-sap.railway.app
SAP_CLIENT_ID=demo_client
SAP_CLIENT_SECRET=demo_secret
SAP_TOKEN_URL=https://mock-sap.railway.app/oauth/token
SAP_BASE_URL=https://mock-sap.railway.app/api/v1
SAP_SCOPE=payment:write
MOCK_SAP_ENABLED=true
```

### 3. Payment Gateway Service

**Purpose**: Bank transfers and payment validation
**Mock Endpoint**: `https://mock-payment.railway.app`

#### Mock Responses

```javascript
// Bank Account Validation
POST /api/validate/bank-account
Request: {
  "account_number": "1234567890",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "John Doe"
}
Response: {
  "success": true,
  "valid": true,
  "bank_name": "HDFC Bank",
  "branch_name": "MG Road Branch",
  "account_holder_name": "John Doe"
}

// Payment Initiation
POST /api/payments
Request: {
  "payment_id": "PAY001",
  "amount": 50000,
  "currency": "INR",
  "beneficiary": {
    "name": "John Doe",
    "account_number": "1234567890",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank"
  },
  "purpose": "LTET Scheme Payment",
  "reference_number": "LTET_APP001_PAY001"
}
Response: {
  "success": true,
  "transaction_id": "TXN_GW_001",
  "gateway_reference": "GW_REF_12345",
  "status": "initiated"
}

// Supported Banks
GET /api/banks
Response: {
  "success": true,
  "banks": [
    {
      "ifscPrefix": "HDFC",
      "bankName": "HDFC Bank"
    },
    {
      "ifscPrefix": "ICIC",
      "bankName": "ICICI Bank"
    },
    {
      "ifscPrefix": "SBIN",
      "bankName": "State Bank of India"
    }
  ]
}
```

#### Configuration

```bash
PAYMENT_GATEWAY_API_KEY=demo_api_key
PAYMENT_GATEWAY_SECRET_KEY=demo_secret_key
PAYMENT_GATEWAY_BASE_URL=https://mock-payment.railway.app/api/v1
PAYMENT_GATEWAY_WEBHOOK_SECRET=demo_webhook_secret
PAYMENT_GATEWAY_ENVIRONMENT=sandbox
MOCK_PAYMENT_GATEWAY_ENABLED=true
```

### 4. OCR Service

**Purpose**: Document processing and text extraction
**Mock Endpoint**: `https://mock-ocr.railway.app`

#### Mock Responses

```javascript
// Document OCR Processing
POST /api/ocr/process
Request: {
  "document_id": "DOC001",
  "document_type": "aadhaar",
  "image_url": "https://storage.railway.app/documents/doc001.jpg"
}
Response: {
  "success": true,
  "extracted_data": {
    "document_type": "aadhaar",
    "aadhaar_number": "1234 5678 9012",
    "name": "John Doe",
    "date_of_birth": "01/01/1990",
    "address": "123 Tech Street, Bangalore, Karnataka - 560001",
    "confidence_score": 0.95
  },
  "processing_time": 2.5
}

// Document Validation
POST /api/ocr/validate
Request: {
  "document_type": "pan",
  "extracted_data": {
    "pan_number": "ABCDE1234F",
    "name": "John Doe"
  }
}
Response: {
  "success": true,
  "valid": true,
  "validation_details": {
    "format_valid": true,
    "checksum_valid": true,
    "name_match": true
  }
}
```

#### Configuration

```bash
OCR_SERVICE_URL=https://mock-ocr.railway.app/api/v1
MOCK_OCR_ENABLED=true
```

## Mock Service Behavior

### Authentication

All mock services use OAuth2 client credentials flow:

```javascript
// Token Request
POST /oauth/token
Request: {
  "grant_type": "client_credentials",
  "client_id": "demo_client",
  "client_secret": "demo_secret",
  "scope": "required_scope"
}
Response: {
  "access_token": "mock_access_token_12345",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "required_scope"
}
```

### Error Simulation

Mock services can simulate various error conditions:

```javascript
// Network Timeout (5% chance)
{
  "error": "timeout",
  "message": "Request timed out"
}

// Service Unavailable (2% chance)
{
  "error": "service_unavailable",
  "message": "Service temporarily unavailable"
}

// Invalid Request (for malformed data)
{
  "error": "invalid_request",
  "message": "Invalid request parameters",
  "details": ["Missing required field: account_number"]
}

// Authentication Error (for invalid credentials)
{
  "error": "authentication_failed",
  "message": "Invalid client credentials"
}
```

### Response Delays

Mock services simulate realistic response times:
- **HRMS**: 500-2000ms
- **SAP**: 1000-5000ms (payment processing)
- **Payment Gateway**: 800-3000ms
- **OCR**: 2000-8000ms (document processing)

## Demo Data Sets

### Employee Profiles

```javascript
const mockEmployees = [
  {
    employeeId: "EMP001",
    name: "John Doe",
    department: "Engineering",
    salary: 75000,
    eligible_schemes: ["medical", "education", "housing"]
  },
  {
    employeeId: "EMP002",
    name: "Jane Smith",
    department: "HR",
    salary: 65000,
    eligible_schemes: ["medical", "education"]
  },
  {
    employeeId: "EMP003",
    name: "Mike Johnson",
    department: "Finance",
    salary: 80000,
    eligible_schemes: ["medical", "housing", "vehicle"]
  }
];
```

### Bank Accounts

```javascript
const mockBankAccounts = [
  {
    accountNumber: "1234567890",
    ifscCode: "HDFC0001234",
    bankName: "HDFC Bank",
    branchName: "MG Road Branch",
    accountHolderName: "John Doe"
  },
  {
    accountNumber: "9876543210",
    ifscCode: "ICIC0001234",
    bankName: "ICICI Bank",
    branchName: "Koramangala Branch",
    accountHolderName: "Jane Smith"
  }
];
```

### Document Templates

```javascript
const mockDocuments = {
  aadhaar: {
    number: "1234 5678 9012",
    name: "John Doe",
    dateOfBirth: "01/01/1990",
    address: "123 Tech Street, Bangalore"
  },
  pan: {
    number: "ABCDE1234F",
    name: "John Doe"
  },
  bankStatement: {
    accountNumber: "1234567890",
    balance: 150000,
    transactions: [
      {
        date: "2024-01-15",
        description: "Salary Credit",
        amount: 75000,
        type: "credit"
      }
    ]
  }
};
```

## Testing Mock Services

### Health Check Endpoints

```bash
# Check all mock services
curl https://mock-hrms.railway.app/health
curl https://mock-sap.railway.app/health
curl https://mock-payment.railway.app/health
curl https://mock-ocr.railway.app/health
```

### Integration Testing

```javascript
// Test HRMS integration
const hrmsService = new HRMSIntegrationService();
const result = await hrmsService.lookupEmployeeData('EMP001');
console.log('HRMS Test:', result);

// Test SAP integration
const sapService = new SAPIntegrationService();
const paymentResult = await sapService.processPayment(mockPaymentRequest);
console.log('SAP Test:', paymentResult);

// Test Payment Gateway
const gatewayService = new PaymentGatewayService();
const validationResult = await gatewayService.validateBankAccount(mockBankAccount);
console.log('Gateway Test:', validationResult);
```

## Switching to Production APIs

When ready for production, update environment variables:

```bash
# Disable mock services
railway variables set MOCK_HRMS_ENABLED=false
railway variables set MOCK_SAP_ENABLED=false
railway variables set MOCK_PAYMENT_GATEWAY_ENABLED=false
railway variables set MOCK_OCR_ENABLED=false

# Set real API endpoints
railway variables set HRMS_API_URL=https://real-hrms-api.company.com
railway variables set SAP_API_URL=https://real-sap-api.company.com
railway variables set PAYMENT_GATEWAY_BASE_URL=https://real-payment-gateway.com

# Set real credentials
railway variables set HRMS_CLIENT_ID=real_client_id
railway variables set HRMS_CLIENT_SECRET=real_client_secret
railway variables set SAP_CLIENT_ID=real_sap_client
railway variables set SAP_CLIENT_SECRET=real_sap_secret
railway variables set PAYMENT_GATEWAY_API_KEY=real_api_key
railway variables set PAYMENT_GATEWAY_SECRET_KEY=real_secret_key
```

## Monitoring Mock Services

### Logs and Metrics

```bash
# View application logs
railway logs

# Check specific service logs
railway logs --service user-service
railway logs --service application-service

# Monitor API calls
railway logs | grep "Mock API"
```

### Performance Monitoring

Mock services include performance metrics:
- Response times
- Success/failure rates
- Error simulation statistics
- Authentication attempts

This mock setup provides a complete demo environment that showcases all LTET portal features without requiring real external service integrations.