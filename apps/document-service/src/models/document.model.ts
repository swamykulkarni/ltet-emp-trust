import multer from 'multer';

export interface Document {
  documentId: string;
  applicationId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  documentType: string;
  validationStatus: DocumentValidationStatus;
  validationResults?: ValidationResults;
  ocrData?: OCRData;
  confidenceScore?: number;
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt: Date;
  version: number;
}

export type DocumentValidationStatus = 'pending' | 'validated' | 'failed' | 'processing';

export interface ValidationResults {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: DocumentMetadata;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface DocumentMetadata {
  pageCount?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  quality?: 'high' | 'medium' | 'low';
  isReadable: boolean;
  hasText: boolean;
}

export interface OCRData {
  extractedText: string;
  extractedFields: ExtractedField[];
  confidence: number;
  processedAt: Date;
  provider: string;
  rawResponse?: any;
}

export interface ExtractedField {
  fieldName: string;
  value: string;
  confidence: number;
  boundingBox?: BoundingBox;
  dataType: 'text' | 'number' | 'date' | 'currency' | 'percentage';
}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DocumentUploadRequest {
  applicationId: string;
  documentType: string;
  file: multer.File;
}

export interface DocumentValidationRequest {
  documentId: string;
  applicationData?: any;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  fieldName: string;
  expectedValue?: string;
  expectedPattern?: string;
  required: boolean;
  dataType: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  tolerance?: number; // For numeric comparisons
}

export interface OCRProcessingResult {
  success: boolean;
  ocrData?: OCRData;
  error?: string;
  confidenceScore: number;
}

export interface DocumentSearchQuery {
  applicationId?: string;
  documentType?: string;
  validationStatus?: DocumentValidationStatus;
  uploadedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}