export const environment = {
  production: false,
  port: parseInt(process.env['DOCUMENT_SERVICE_PORT'] || '3003', 10),
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'ltet_portal',
    username: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'password',
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || '',
  },
  aws: {
    region: process.env['AWS_REGION'] || 'us-east-1',
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
    s3Bucket: process.env['AWS_S3_BUCKET'] || 'ltet-documents',
  },
  ocr: {
    provider: process.env['OCR_PROVIDER'] || 'aws-textract', // aws-textract, google-vision, azure-cognitive
    apiKey: process.env['OCR_API_KEY'] || '',
    endpoint: process.env['OCR_ENDPOINT'] || '',
    confidenceThreshold: parseFloat(process.env['OCR_CONFIDENCE_THRESHOLD'] || '0.8'),
    timeout: parseInt(process.env['OCR_TIMEOUT'] || '120000', 10), // 2 minutes
  },
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-secret-key',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },
};