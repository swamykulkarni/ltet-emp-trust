import { Request, Response } from 'express';
import { FinanceService } from '../services/finance.service';
import { PaymentQueueFilters, BatchFilters } from '../models/finance.model';

export class FinanceController {
  private financeService: FinanceService;

  constructor() {
    this.financeService = new FinanceService();
  }

  // Dashboard endpoint
  getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const dashboard = await this.financeService.getFinanceDashboard();
      
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load dashboard'
      });
    }
  };

  // Payment Queue Management
  getPaymentQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        status,
        validationStatus,
        batchId,
        dateFrom,
        dateTo,
        amountMin,
        amountMax,
        priorityLevel,
        schemeId,
        page = '1',
        pageSize = '50'
      } = req.query;

      const filters: PaymentQueueFilters = {};
      
      if (status) filters.status = status as any;
      if (validationStatus) filters.validationStatus = validationStatus as any;
      if (batchId) filters.batchId = batchId as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      if (amountMin) filters.amountMin = parseFloat(amountMin as string);
      if (amountMax) filters.amountMax = parseFloat(amountMax as string);
      if (priorityLevel) filters.priorityLevel = parseInt(priorityLevel as string);
      if (schemeId) filters.schemeId = schemeId as string;

      const result = await this.financeService.getPaymentQueue(
        filters,
        parseInt(page as string),
        parseInt(pageSize as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch payment queue'
      });
    }
  };

  addToPaymentQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { financeUserId } = req.body;

      if (!financeUserId) {
        res.status(400).json({
          error: 'financeUserId is required'
        });
        return;
      }

      const queueEntry = await this.financeService.addApprovedApplicationToQueue(
        applicationId,
        financeUserId
      );

      res.status(201).json({
        success: true,
        data: queueEntry,
        message: 'Application added to payment queue successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add to payment queue'
      });
    }
  };

  validateBankDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueId } = req.params;
      
      const validationResult = await this.financeService.validateBankDetails(queueId);

      res.json({
        success: true,
        data: validationResult,
        message: validationResult.isValid ? 'Bank details validated successfully' : 'Bank validation failed'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to validate bank details'
      });
    }
  };

  checkDuplicates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueId } = req.params;
      
      const duplicateResult = await this.financeService.checkForDuplicates(queueId);

      res.json({
        success: true,
        data: duplicateResult,
        message: duplicateResult.isDuplicate ? 
          `Duplicates detected (Risk: ${duplicateResult.riskLevel})` : 
          'No duplicates found'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to check duplicates'
      });
    }
  };

  // Batch Processing
  getPaymentBatches = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        status,
        batchType,
        createdBy,
        dateFrom,
        dateTo,
        page = '1',
        pageSize = '20'
      } = req.query;

      const filters: BatchFilters = {};
      
      if (status) filters.status = status as any;
      if (batchType) filters.batchType = batchType as any;
      if (createdBy) filters.createdBy = createdBy as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      const result = await this.financeService.getPaymentBatches(
        filters,
        parseInt(page as string),
        parseInt(pageSize as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch payment batches'
      });
    }
  };

  createPaymentBatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchName, batchType, createdBy, queueIds } = req.body;

      if (!batchName || !batchType || !createdBy || !queueIds || !Array.isArray(queueIds)) {
        res.status(400).json({
          error: 'batchName, batchType, createdBy, and queueIds (array) are required'
        });
        return;
      }

      if (queueIds.length === 0) {
        res.status(400).json({
          error: 'At least one queue entry ID is required'
        });
        return;
      }

      const batch = await this.financeService.createPaymentBatch(
        batchName,
        batchType,
        createdBy,
        queueIds
      );

      res.status(201).json({
        success: true,
        data: batch,
        message: 'Payment batch created successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create payment batch'
      });
    }
  };

  processBatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params;
      const { processedBy } = req.body;

      if (!processedBy) {
        res.status(400).json({
          error: 'processedBy is required'
        });
        return;
      }

      const result = await this.financeService.processBatch(batchId, processedBy);

      res.json({
        success: true,
        data: result,
        message: `Batch processed: ${result.processedCount} successful, ${result.failedCount} failed`
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to process batch'
      });
    }
  };

  // Bulk operations
  bulkValidateBankDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueIds } = req.body;

      if (!queueIds || !Array.isArray(queueIds)) {
        res.status(400).json({
          error: 'queueIds array is required'
        });
        return;
      }

      const results = await Promise.allSettled(
        queueIds.map(queueId => this.financeService.validateBankDetails(queueId))
      );

      const validationResults = results.map((result, index) => ({
        queueId: queueIds[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason?.message : null
      }));

      const successCount = validationResults.filter(r => r.success).length;
      const failureCount = validationResults.length - successCount;

      res.json({
        success: true,
        data: {
          results: validationResults,
          summary: {
            total: queueIds.length,
            successful: successCount,
            failed: failureCount
          }
        },
        message: `Bulk validation completed: ${successCount} successful, ${failureCount} failed`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Bulk validation failed'
      });
    }
  };

  bulkCheckDuplicates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueIds } = req.body;

      if (!queueIds || !Array.isArray(queueIds)) {
        res.status(400).json({
          error: 'queueIds array is required'
        });
        return;
      }

      const results = await Promise.allSettled(
        queueIds.map(queueId => this.financeService.checkForDuplicates(queueId))
      );

      const duplicateResults = results.map((result, index) => ({
        queueId: queueIds[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason?.message : null
      }));

      const duplicatesFound = duplicateResults.filter(r => 
        r.success && r.data?.isDuplicate
      ).length;

      res.json({
        success: true,
        data: {
          results: duplicateResults,
          summary: {
            total: queueIds.length,
            duplicatesFound,
            clean: queueIds.length - duplicatesFound
          }
        },
        message: `Duplicate check completed: ${duplicatesFound} duplicates found`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Bulk duplicate check failed'
      });
    }
  };

  // Statistics and reporting
  getQueueStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { dateFrom, dateTo, groupBy = 'status' } = req.query;

      // This would typically involve more complex aggregation queries
      // For now, returning basic statistics
      const dashboard = await this.financeService.getFinanceDashboard();

      const statistics = {
        summary: dashboard,
        groupBy: groupBy,
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        // Additional statistics would be calculated here
        trends: {
          dailyProcessing: [],
          weeklyTrends: [],
          monthlyTotals: []
        }
      };

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch statistics'
      });
    }
  };

  exportPaymentQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { format = 'csv', ...filterParams } = req.query;

      // Build filters from query parameters
      const filters: PaymentQueueFilters = {};
      if (filterParams.status) filters.status = filterParams.status as any;
      if (filterParams.validationStatus) filters.validationStatus = filterParams.validationStatus as any;
      // ... other filters

      const result = await this.financeService.getPaymentQueue(filters, 1, 10000); // Large page size for export

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = [
          'Queue ID', 'Application ID', 'Beneficiary Name', 'Amount', 
          'Bank Account', 'IFSC Code', 'Status', 'Validation Status', 'Created At'
        ];
        
        const csvRows = result.entries.map(entry => [
          entry.queueId,
          entry.applicationId,
          entry.beneficiaryName,
          entry.approvedAmount,
          entry.bankAccountNumber,
          entry.ifscCode,
          entry.queueStatus,
          entry.validationStatus,
          entry.createdAt.toISOString()
        ]);

        const csvContent = [csvHeaders, ...csvRows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="payment_queue.csv"');
        res.send(csvContent);
      } else {
        // Return JSON format
        res.json({
          success: true,
          data: result,
          format: 'json'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Export failed'
      });
    }
  };

  // Payment Reconciliation Endpoints
  importReconciliationFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fileContent, fileFormat = 'csv', importedBy } = req.body;

      if (!fileContent || !importedBy) {
        res.status(400).json({
          error: 'fileContent and importedBy are required'
        });
        return;
      }

      if (!['csv', 'excel', 'txt'].includes(fileFormat)) {
        res.status(400).json({
          error: 'fileFormat must be csv, excel, or txt'
        });
        return;
      }

      const result = await this.financeService.importReconciliationFile(
        fileContent,
        fileFormat,
        importedBy
      );

      res.json({
        success: true,
        data: result,
        message: `Import completed: ${result.successfulImports} successful, ${result.failedImports} failed`
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to import reconciliation file'
      });
    }
  };

  performAutomaticMatching = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.financeService.performAutomaticMatching();

      res.json({
        success: true,
        data: result,
        message: `Matching completed: ${result.matchedCount} matched, ${result.unmatchedCount} unmatched, ${result.partialMatches} partial`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Automatic matching failed'
      });
    }
  };

  getReconciliationStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId, dateFrom, dateTo, status } = req.query;

      const filters: any = {};
      if (batchId) filters.batchId = batchId as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      if (status) filters.status = status as string;

      const result = await this.financeService.getReconciliationStatus(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch reconciliation status'
      });
    }
  };

  handlePaymentFailure = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueId } = req.params;
      const { failureReason, retryable = true } = req.body;

      if (!failureReason) {
        res.status(400).json({
          error: 'failureReason is required'
        });
        return;
      }

      const result = await this.financeService.handlePaymentFailure(
        queueId,
        failureReason,
        retryable
      );

      res.json({
        success: true,
        data: result,
        message: `Payment failure handled. Next action: ${result.nextAction}`
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to handle payment failure'
      });
    }
  };

  retryFailedPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueIds, processedBy } = req.body;

      if (!processedBy) {
        res.status(400).json({
          error: 'processedBy is required'
        });
        return;
      }

      const result = await this.financeService.retryFailedPayments(queueIds, processedBy);

      res.json({
        success: true,
        data: result,
        message: `Retry completed: ${result.successCount} successful, ${result.failedCount} failed`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to retry payments'
      });
    }
  };
}