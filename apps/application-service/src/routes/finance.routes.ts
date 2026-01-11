import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller';

const router = Router();
const financeController = new FinanceController();

// Dashboard
router.get('/dashboard', financeController.getDashboard);

// Payment Queue Management
router.get('/queue', financeController.getPaymentQueue);
router.post('/queue/:applicationId', financeController.addToPaymentQueue);
router.post('/queue/:queueId/validate', financeController.validateBankDetails);
router.post('/queue/:queueId/check-duplicates', financeController.checkDuplicates);

// Bulk Operations
router.post('/queue/bulk/validate', financeController.bulkValidateBankDetails);
router.post('/queue/bulk/check-duplicates', financeController.bulkCheckDuplicates);

// Batch Processing
router.get('/batches', financeController.getPaymentBatches);
router.post('/batches', financeController.createPaymentBatch);
router.post('/batches/:batchId/process', financeController.processBatch);

// Statistics and Reporting
router.get('/statistics', financeController.getQueueStatistics);
router.get('/export', financeController.exportPaymentQueue);

// Payment Reconciliation
router.post('/reconciliation/import', financeController.importReconciliationFile);
router.post('/reconciliation/match', financeController.performAutomaticMatching);
router.get('/reconciliation/status', financeController.getReconciliationStatus);
router.post('/reconciliation/failure/:queueId', financeController.handlePaymentFailure);
router.post('/reconciliation/retry', financeController.retryFailedPayments);

export default router;