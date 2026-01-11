import { Request, Response } from 'express';
import { documentService } from '../services/document.service';
import { storageService } from '../services/storage.service';
import { DocumentUploadRequest, DocumentValidationRequest, DocumentSearchQuery } from '../models/document.model';

export class DocumentController {

  /**
   * Upload document
   */
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const { applicationId, documentType } = req.body;
      const userId = req.user?.userId; // Assuming auth middleware sets this

      if (!applicationId || !documentType) {
        res.status(400).json({
          success: false,
          error: 'Application ID and document type are required'
        });
        return;
      }

      const uploadRequest: DocumentUploadRequest = {
        applicationId,
        documentType,
        file: req.file
      };

      const document = await documentService.uploadDocument(uploadRequest, userId);

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          documentId: document.documentId,
          fileName: document.fileName,
          validationStatus: document.validationStatus,
          uploadedAt: document.uploadedAt
        }
      });

    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document upload failed'
      });
    }
  }

  /**
   * Validate document
   */
  async validateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { applicationData, validationRules } = req.body;

      const validationRequest: DocumentValidationRequest = {
        documentId,
        applicationData,
        validationRules
      };

      const validationResults = await documentService.validateDocument(validationRequest);

      res.status(200).json({
        success: true,
        message: 'Document validation completed',
        data: validationResults
      });

    } catch (error) {
      console.error('Document validation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document validation failed'
      });
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: document
      });

    } catch (error) {
      console.error('Get document error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve document'
      });
    }
  }

  /**
   * Download document
   */
  async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const document = await documentService.getDocument(documentId);

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found'
        });
        return;
      }

      // Get signed URL for download
      const downloadUrl = await storageService.getFileUrl(document.filePath);

      res.status(200).json({
        success: true,
        data: {
          downloadUrl,
          fileName: document.originalName,
          mimeType: document.mimeType,
          fileSize: document.fileSize
        }
      });

    } catch (error) {
      console.error('Document download error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL'
      });
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(req: Request, res: Response): Promise<void> {
    try {
      const query: DocumentSearchQuery = {
        applicationId: req.query.applicationId as string,
        documentType: req.query.documentType as string,
        validationStatus: req.query.validationStatus as any,
        uploadedBy: req.query.uploadedBy as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await documentService.searchDocuments(query);

      res.status(200).json({
        success: true,
        data: result.documents,
        pagination: {
          total: result.total,
          limit: query.limit || 20,
          offset: query.offset || 0
        }
      });

    } catch (error) {
      console.error('Document search error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document search failed'
      });
    }
  }

  /**
   * Get documents by application
   */
  async getDocumentsByApplication(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.params;

      const documents = await documentService.getDocumentsByApplication(applicationId);

      res.status(200).json({
        success: true,
        data: documents
      });

    } catch (error) {
      console.error('Get documents by application error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve documents'
      });
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = req.user?.userId;

      await documentService.deleteDocument(documentId, userId);

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      console.error('Document deletion error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document deletion failed'
      });
    }
  }

  /**
   * Reprocess OCR
   */
  async reprocessOCR(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const ocrResult = await documentService.reprocessOCR(documentId);

      res.status(200).json({
        success: true,
        message: 'OCR reprocessing completed',
        data: {
          success: ocrResult.success,
          confidenceScore: ocrResult.confidenceScore,
          error: ocrResult.error
        }
      });

    } catch (error) {
      console.error('OCR reprocessing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'OCR reprocessing failed'
      });
    }
  }

  /**
   * Bulk validate documents
   */
  async bulkValidateDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.params;
      const { applicationData } = req.body;

      const results = await documentService.bulkValidateDocuments(applicationId, applicationData);

      res.status(200).json({
        success: true,
        message: 'Bulk validation completed',
        data: results
      });

    } catch (error) {
      console.error('Bulk validation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Bulk validation failed'
      });
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.query;

      const statistics = await documentService.getDocumentStatistics(applicationId as string);

      res.status(200).json({
        success: true,
        data: statistics
      });

    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve statistics'
      });
    }
  }

  /**
   * Get confidence score summary
   */
  async getConfidenceScoreSummary(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.params;

      const summary = await documentService.getConfidenceScoreSummary(applicationId);

      res.status(200).json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Get confidence summary error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve confidence summary'
      });
    }
  }

  /**
   * Upload new version of document
   */
  async uploadDocumentVersion(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = req.user?.userId;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const document = await documentService.uploadDocumentVersion(documentId, req.file, userId);

      res.status(201).json({
        success: true,
        message: 'Document version uploaded successfully',
        data: {
          documentId: document.documentId,
          fileName: document.fileName,
          version: document.version,
          validationStatus: document.validationStatus,
          uploadedAt: document.uploadedAt
        }
      });

    } catch (error) {
      console.error('Document version upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document version upload failed'
      });
    }
  }

  /**
   * Get document version history
   */
  async getDocumentVersions(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const versions = await documentService.getDocumentVersions(documentId);

      res.status(200).json({
        success: true,
        data: versions
      });

    } catch (error) {
      console.error('Get document versions error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve document versions'
      });
    }
  }

  /**
   * Restore document to previous version
   */
  async restoreDocumentVersion(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, versionNumber } = req.params;
      const userId = req.user?.userId;

      const document = await documentService.restoreDocumentVersion(
        documentId, 
        parseInt(versionNumber), 
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Document restored to previous version successfully',
        data: {
          documentId: document.documentId,
          version: document.version,
          restoredFromVersion: parseInt(versionNumber),
          updatedAt: document.updatedAt
        }
      });

    } catch (error) {
      console.error('Document version restoration error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Document version restoration failed'
      });
    }
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;

      const metadata = await documentService.getDocumentMetadata(documentId);

      res.status(200).json({
        success: true,
        data: metadata
      });

    } catch (error) {
      console.error('Get document metadata error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve document metadata'
      });
    }
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const metadata = req.body;

      await documentService.updateDocumentMetadata(documentId, metadata);

      res.status(200).json({
        success: true,
        message: 'Document metadata updated successfully'
      });

    } catch (error) {
      console.error('Update document metadata error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document metadata'
      });
    }
  }
}

export const documentController = new DocumentController();