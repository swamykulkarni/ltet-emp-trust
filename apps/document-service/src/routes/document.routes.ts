import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { uploadMiddleware, handleUploadError } from '../middleware/upload.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Document upload
router.post(
  '/upload',
  uploadMiddleware.single('document'),
  handleUploadError,
  documentController.uploadDocument.bind(documentController)
);

// Document validation
router.post(
  '/:documentId/validate',
  requireRole(['approver', 'admin', 'system_admin']),
  documentController.validateDocument.bind(documentController)
);

// Get document by ID
router.get(
  '/:documentId',
  documentController.getDocument.bind(documentController)
);

// Download document
router.get(
  '/:documentId/download',
  documentController.downloadDocument.bind(documentController)
);

// Delete document
router.delete(
  '/:documentId',
  documentController.deleteDocument.bind(documentController)
);

// Reprocess OCR
router.post(
  '/:documentId/reprocess-ocr',
  requireRole(['admin', 'system_admin']),
  documentController.reprocessOCR.bind(documentController)
);

// Search documents
router.get(
  '/',
  documentController.searchDocuments.bind(documentController)
);

// Get documents by application
router.get(
  '/application/:applicationId',
  documentController.getDocumentsByApplication.bind(documentController)
);

// Bulk validate documents for an application
router.post(
  '/application/:applicationId/bulk-validate',
  requireRole(['approver', 'admin', 'system_admin']),
  documentController.bulkValidateDocuments.bind(documentController)
);

// Get confidence score summary for an application
router.get(
  '/application/:applicationId/confidence-summary',
  requireRole(['approver', 'admin', 'system_admin']),
  documentController.getConfidenceScoreSummary.bind(documentController)
);

// Get document statistics
router.get(
  '/statistics',
  requireRole(['admin', 'head', 'system_admin']),
  documentController.getDocumentStatistics.bind(documentController)
);

// Document versioning routes
router.post(
  '/:documentId/versions',
  uploadMiddleware.single('document'),
  handleUploadError,
  documentController.uploadDocumentVersion.bind(documentController)
);

router.get(
  '/:documentId/versions',
  documentController.getDocumentVersions.bind(documentController)
);

router.post(
  '/:documentId/versions/:versionNumber/restore',
  requireRole(['admin', 'system_admin']),
  documentController.restoreDocumentVersion.bind(documentController)
);

// Document metadata routes
router.get(
  '/:documentId/metadata',
  documentController.getDocumentMetadata.bind(documentController)
);

router.put(
  '/:documentId/metadata',
  requireRole(['admin', 'system_admin']),
  documentController.updateDocumentMetadata.bind(documentController)
);

export { router as documentRoutes };