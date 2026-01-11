import { 
  Document, 
  DocumentUploadRequest, 
  DocumentValidationRequest, 
  DocumentSearchQuery,
  OCRProcessingResult,
  ValidationResults,
  DocumentValidationStatus
} from '../models/document.model';
import { ocrService } from './ocr.service';
import { documentValidationService } from './document-validation.service';
import { documentRepository } from '../repositories/document.repository';
import { storageService } from './storage.service';
import { randomUUID } from 'crypto';
import multer from 'multer';

export class DocumentService {

  /**
   * Upload and process a document with OCR
   */
  async uploadDocument(uploadRequest: DocumentUploadRequest, userId: string): Promise<Document> {
    try {
      console.log(`Starting document upload for application: ${uploadRequest.applicationId}`);
      
      // Generate unique document ID
      const documentId = randomUUID();
      
      // Store file with version 1
      const filePath = await storageService.storeFile(uploadRequest.file, documentId, 1);
      
      // Create initial document record
      const document: Partial<Document> = {
        documentId,
        applicationId: uploadRequest.applicationId,
        fileName: `${documentId}_v1_${uploadRequest.file.originalname}`,
        originalName: uploadRequest.file.originalname,
        mimeType: uploadRequest.file.mimetype,
        fileSize: uploadRequest.file.size,
        filePath,
        documentType: uploadRequest.documentType,
        validationStatus: 'processing',
        uploadedBy: userId,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };
      
      // Save to database
      const savedDocument = await documentRepository.create(document as Document);
      
      // Process OCR asynchronously
      this.processOCRAsync(savedDocument);
      
      return savedDocument;
      
    } catch (error) {
      console.error('Document upload failed:', error);
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process OCR asynchronously
   */
  private async processOCRAsync(document: Document): Promise<void> {
    try {
      console.log(`Starting OCR processing for document: ${document.documentId}`);
      
      // Process with OCR
      const ocrResult = await ocrService.processDocument(document.filePath, document.documentType);
      
      // Update document with OCR results
      const updateData: Partial<Document> = {
        ocrData: ocrResult.ocrData,
        confidenceScore: ocrResult.confidenceScore,
        validationStatus: ocrResult.success ? 'pending' : 'failed',
        updatedAt: new Date()
      };
      
      if (!ocrResult.success) {
        updateData.validationResults = {
          isValid: false,
          errors: [{
            field: 'ocr_processing',
            message: ocrResult.error || 'OCR processing failed',
            code: 'OCR_PROCESSING_FAILED'
          }],
          warnings: [],
          metadata: {
            isReadable: false,
            hasText: false
          }
        };
      }
      
      await documentRepository.update(document.documentId, updateData);
      
      console.log(`OCR processing completed for document: ${document.documentId}, success: ${ocrResult.success}`);
      
    } catch (error) {
      console.error(`OCR processing failed for document ${document.documentId}:`, error);
      
      // Update document with error status
      await documentRepository.update(document.documentId, {
        validationStatus: 'failed',
        validationResults: {
          isValid: false,
          errors: [{
            field: 'ocr_processing',
            message: 'OCR processing encountered an error',
            code: 'OCR_PROCESSING_ERROR'
          }],
          warnings: [],
          metadata: {
            isReadable: false,
            hasText: false
          }
        },
        updatedAt: new Date()
      });
    }
  }

  /**
   * Validate document against application data
   */
  async validateDocument(validationRequest: DocumentValidationRequest): Promise<ValidationResults> {
    try {
      console.log(`Starting validation for document: ${validationRequest.documentId}`);
      
      // Get document from database
      const document = await documentRepository.findById(validationRequest.documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Perform validation
      const validationResults = await documentValidationService.validateDocument(
        document,
        validationRequest.applicationData,
        validationRequest.validationRules
      );
      
      // Update document with validation results
      const validationStatus: DocumentValidationStatus = validationResults.isValid ? 'validated' : 'failed';
      
      await documentRepository.update(document.documentId, {
        validationStatus,
        validationResults,
        updatedAt: new Date()
      });
      
      console.log(`Validation completed for document: ${validationRequest.documentId}, valid: ${validationResults.isValid}`);
      
      return validationResults;
      
    } catch (error) {
      console.error('Document validation failed:', error);
      throw new Error(`Document validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<Document | null> {
    return documentRepository.findById(documentId);
  }

  /**
   * Search documents
   */
  async searchDocuments(query: DocumentSearchQuery): Promise<{ documents: Document[], total: number }> {
    return documentRepository.search(query);
  }

  /**
   * Get documents by application ID
   */
  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return documentRepository.findByApplicationId(applicationId);
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      const document = await documentRepository.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Delete file from storage
      await storageService.deleteFile(document.filePath);
      
      // Delete from database
      await documentRepository.delete(documentId);
      
      console.log(`Document deleted: ${documentId} by user: ${userId}`);
      
    } catch (error) {
      console.error('Document deletion failed:', error);
      throw new Error(`Document deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reprocess document OCR
   */
  async reprocessOCR(documentId: string): Promise<OCRProcessingResult> {
    try {
      const document = await documentRepository.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Reset validation status
      await documentRepository.update(documentId, {
        validationStatus: 'processing',
        updatedAt: new Date()
      });
      
      // Process OCR
      const ocrResult = await ocrService.processDocument(document.filePath, document.documentType);
      
      // Update document
      await documentRepository.update(documentId, {
        ocrData: ocrResult.ocrData,
        confidenceScore: ocrResult.confidenceScore,
        validationStatus: ocrResult.success ? 'pending' : 'failed',
        updatedAt: new Date()
      });
      
      return ocrResult;
      
    } catch (error) {
      console.error('OCR reprocessing failed:', error);
      throw new Error(`OCR reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStatistics(applicationId?: string): Promise<any> {
    return documentRepository.getStatistics(applicationId);
  }

  /**
   * Bulk validate documents for an application
   */
  async bulkValidateDocuments(applicationId: string, applicationData: any): Promise<{ [documentId: string]: ValidationResults }> {
    try {
      const documents = await this.getDocumentsByApplication(applicationId);
      const results: { [documentId: string]: ValidationResults } = {};
      
      // Validate each document
      for (const document of documents) {
        if (document.ocrData) {
          const validationResults = await documentValidationService.validateDocument(
            document,
            applicationData
          );
          
          // Update document status
          await documentRepository.update(document.documentId, {
            validationStatus: validationResults.isValid ? 'validated' : 'failed',
            validationResults,
            updatedAt: new Date()
          });
          
          results[document.documentId] = validationResults;
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Bulk validation failed:', error);
      throw new Error(`Bulk validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get confidence score summary for application
   */
  async getConfidenceScoreSummary(applicationId: string): Promise<{
    averageConfidence: number;
    lowConfidenceDocuments: string[];
    totalDocuments: number;
    processedDocuments: number;
  }> {
    const documents = await this.getDocumentsByApplication(applicationId);
    
    const processedDocuments = documents.filter(doc => doc.confidenceScore !== undefined);
    const confidenceScores = processedDocuments.map(doc => doc.confidenceScore!);
    
    const averageConfidence = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
      : 0;
    
    const lowConfidenceDocuments = processedDocuments
      .filter(doc => doc.confidenceScore! < 0.8)
      .map(doc => doc.documentId);
    
    return {
      averageConfidence,
      lowConfidenceDocuments,
      totalDocuments: documents.length,
      processedDocuments: processedDocuments.length
    };
  }

  /**
   * Upload new version of existing document
   */
  async uploadDocumentVersion(documentId: string, file: multer.File, userId: string): Promise<Document> {
    try {
      console.log(`Starting document version upload for document: ${documentId}`);
      
      // Get existing document
      const existingDocument = await documentRepository.findById(documentId);
      if (!existingDocument) {
        throw new Error('Document not found');
      }
      
      // Create version record before updating main document
      await documentRepository.createVersion(existingDocument);
      
      // Increment version number
      const newVersion = existingDocument.version + 1;
      
      // Store new file version
      const filePath = await storageService.storeFile(file, documentId, newVersion);
      
      // Update document with new version
      const updatedDocument = await documentRepository.update(documentId, {
        fileName: `${documentId}_v${newVersion}_${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath,
        validationStatus: 'processing',
        validationResults: undefined, // Reset validation results
        ocrData: undefined, // Reset OCR data
        confidenceScore: undefined, // Reset confidence score
        version: newVersion,
        updatedAt: new Date()
      });
      
      // Process OCR asynchronously for new version
      this.processOCRAsync(updatedDocument);
      
      console.log(`Document version ${newVersion} uploaded successfully for document: ${documentId}`);
      
      return updatedDocument;
      
    } catch (error) {
      console.error('Document version upload failed:', error);
      throw new Error(`Document version upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document version history
   */
  async getDocumentVersions(documentId: string): Promise<any[]> {
    try {
      const versions = await documentRepository.getVersionHistory(documentId);
      return versions;
    } catch (error) {
      console.error('Failed to get document versions:', error);
      throw new Error(`Failed to get document versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore document to previous version
   */
  async restoreDocumentVersion(documentId: string, versionNumber: number, userId: string): Promise<Document> {
    try {
      console.log(`Restoring document ${documentId} to version ${versionNumber}`);
      
      // Get the version to restore
      const versionToRestore = await documentRepository.getVersion(documentId, versionNumber);
      if (!versionToRestore) {
        throw new Error(`Version ${versionNumber} not found for document ${documentId}`);
      }
      
      // Get current document
      const currentDocument = await documentRepository.findById(documentId);
      if (!currentDocument) {
        throw new Error('Document not found');
      }
      
      // Create version record for current state before restoring
      await documentRepository.createVersion(currentDocument);
      
      // Increment version number for the restoration
      const newVersion = currentDocument.version + 1;
      
      // Update document with restored version data
      const restoredDocument = await documentRepository.update(documentId, {
        filePath: versionToRestore.filePath,
        fileSize: versionToRestore.fileSize,
        validationStatus: versionToRestore.validationStatus,
        validationResults: versionToRestore.validationResults,
        ocrData: versionToRestore.ocrData,
        confidenceScore: versionToRestore.confidenceScore,
        version: newVersion,
        updatedAt: new Date()
      });
      
      console.log(`Document ${documentId} restored to version ${versionNumber} as new version ${newVersion}`);
      
      return restoredDocument;
      
    } catch (error) {
      console.error('Document version restoration failed:', error);
      throw new Error(`Document version restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(documentId: string): Promise<any> {
    try {
      const metadata = await documentRepository.getMetadata(documentId);
      return metadata;
    } catch (error) {
      console.error('Failed to get document metadata:', error);
      throw new Error(`Failed to get document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(documentId: string, metadata: any): Promise<void> {
    try {
      await documentRepository.updateMetadata(documentId, metadata);
      console.log(`Document metadata updated for document: ${documentId}`);
    } catch (error) {
      console.error('Failed to update document metadata:', error);
      throw new Error(`Failed to update document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const documentService = new DocumentService();