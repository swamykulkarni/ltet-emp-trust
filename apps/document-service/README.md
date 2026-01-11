# Document Service

The Document Service is responsible for handling document upload, OCR processing, and validation within the LTET Employee Trust Portal. It provides comprehensive document management capabilities with AI-powered text extraction and validation against application data.

## Features

### Core Functionality
- **Document Upload**: Secure file upload with format and size validation
- **OCR Processing**: Automated text extraction using AWS Textract
- **Document Validation**: Intelligent validation against application data
- **Confidence Scoring**: Quality assessment of OCR results
- **File Storage**: Support for both local and AWS S3 storage

### OCR Capabilities
- **Text Extraction**: Full text extraction from PDF and image documents
- **Field Detection**: Automatic identification of key-value pairs
- **Document-Specific Processing**: Specialized extraction for different document types:
  - Income certificates and salary slips
  - Medical bills and reports
  - Education certificates and marksheets
  - Bank statements

### Validation Features
- **Data Matching**: Compare extracted data with application information
- **Format Validation**: Ensure proper data formats (currency, dates, percentages)
- **Business Rules**: Apply document-specific validation rules
- **Confidence Thresholds**: Flag low-confidence extractions for manual review

## API Endpoints

### Document Management
- `POST /api/documents/upload` - Upload a new document
- `GET /api/documents/:documentId` - Get document details
- `GET /api/documents/:documentId/download` - Get download URL
- `DELETE /api/documents/:documentId` - Delete document
- `GET /api/documents` - Search documents with filters

### OCR and Validation
- `POST /api/documents/:documentId/validate` - Validate document against application data
- `POST /api/documents/:documentId/reprocess-ocr` - Reprocess OCR for a document
- `POST /api/documents/application/:applicationId/bulk-validate` - Bulk validate all documents for an application

### Analytics
- `GET /api/documents/statistics` - Get document processing statistics
- `GET /api/documents/application/:applicationId/confidence-summary` - Get confidence score summary

## Configuration

### Environment Variables
```bash
# Service Configuration
DOCUMENT_SERVICE_PORT=3003
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ltet_portal
DB_USER=postgres
DB_PASSWORD=password

# AWS Configuration (for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=ltet-documents

# OCR Configuration
OCR_PROVIDER=aws-textract
OCR_CONFIDENCE_THRESHOLD=0.8
OCR_TIMEOUT=120000

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

### Supported File Types
- PDF documents
- JPEG/JPG images
- PNG images
- Maximum file size: 5MB

## OCR Processing

### AWS Textract Integration
The service uses AWS Textract for OCR processing with the following features:
- Form extraction for key-value pairs
- Table detection and extraction
- High accuracy text recognition
- Confidence scoring for each extracted element

### Document-Specific Processing
Different document types have specialized processing logic:

#### Income Documents
- Salary amount extraction
- Employee ID validation
- Income verification against claims

#### Medical Documents
- Bill amount extraction
- Patient name verification
- Medical expense validation

#### Education Documents
- Grade/percentage extraction
- Student name verification
- Academic achievement validation

#### Bank Documents
- Account number extraction
- IFSC code validation
- Banking detail verification

## Validation Rules

### Automatic Validation
- File format and size validation
- OCR confidence threshold checking
- Data format validation (currency, dates, numbers)
- Cross-reference with application data

### Custom Validation Rules
Support for configurable validation rules:
- Required field validation
- Expected value matching
- Pattern matching with regex
- Data type validation
- Tolerance-based numeric comparisons

## Error Handling

### OCR Errors
- Automatic retry for transient failures
- Graceful degradation for low-quality documents
- Detailed error reporting with confidence scores

### Validation Errors
- Field-level error reporting
- Warning system for potential issues
- Comprehensive validation results with metadata

## Security

### Access Control
- JWT-based authentication
- Role-based authorization
- Document access restrictions

### Data Protection
- Encrypted file storage
- Secure file transfer
- Audit logging for all operations

## Development

### Running Locally
```bash
# Install dependencies
npm install

# Start the service
npm run dev:document-service

# Run tests
npm run test document-service
```

### Testing
The service includes comprehensive test coverage:
- Unit tests for core functionality
- Integration tests for OCR processing
- Property-based tests for validation logic
- Mock services for external dependencies

## Monitoring

### Health Checks
- Service health endpoint: `/health`
- Database connectivity monitoring
- OCR service availability checking

### Metrics
- Document processing statistics
- OCR confidence score tracking
- Validation success rates
- Performance metrics

## Deployment

### Docker Support
The service includes Docker configuration for containerized deployment:
```bash
# Build image
docker build -t document-service .

# Run container
docker run -p 3003:3003 document-service
```

### Production Considerations
- Configure AWS credentials for S3 storage
- Set up proper OCR service limits
- Configure monitoring and alerting
- Implement backup strategies for documents