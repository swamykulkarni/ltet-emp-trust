import { FinanceRepository } from '../repositories/finance.repository';
import { ApplicationRepository } from '../repositories/application.repository';
// Note: In a real microservices architecture, this would be an HTTP call to user-service
// For now, we'll create a local interface and mock the implementation
interface IFSCVerificationService {
  verifyIFSC(ifscCode: string): Promise<{
    success: boolean;
    valid: boolean;
    details?: {
      ifsc: string;
      bank: string;
      branch: string;
      address: string;
      city: string;
      state: string;
    };
    error?: string;
  }>;
}
import {
  PaymentQueueEntry,
  PaymentBatch,
  PaymentReconciliation,
  BankValidationResult,
  DuplicateCheckResult,
  BatchProcessingResult,
  FinanceDashboardSummary,
  PaymentQueueFilters,
  BatchFilters,
  PAYMENT_QUEUE_STATUS,
  VALIDATION_STATUS,
  BATCH_STATUS,
  PRIORITY_LEVELS
} from '../models/finance.model';
import { Application } from '../models/application.model';
import { SAPIntegrationService } from './sap-integration.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { IntegrationHealthService } from './integration-health.service';

export class FinanceService {
  private financeRepository: FinanceRepository;
  private applicationRepository: ApplicationRepository;
  private ifscService: IFSCVerificationService;
  private sapService: SAPIntegrationService;
  private paymentGatewayService: PaymentGatewayService;
  private healthService: IntegrationHealthService;

  constructor() {
    this.financeRepository = new FinanceRepository();
    this.applicationRepository = new ApplicationRepository();
    this.ifscService = new MockIFSCVerificationService();
    this.sapService = new SAPIntegrationService();
    this.paymentGatewayService = new PaymentGatewayService();
    this.healthService = new IntegrationHealthService();
  }

  // Payment Queue Management
  async addApprovedApplicationToQueue(applicationId: string, financeUserId: string): Promise<PaymentQueueEntry> {
    // Get the approved application
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.workflow.currentStatus !== 'approved') {
      throw new Error('Application must be approved before adding to payment queue');
    }

    if (!application.paymentInfo?.approvedAmount) {
      throw new Error('Application must have approved amount');
    }

    // Get user bank details (assuming they're stored in the application or user profile)
    const bankDetails = await this.getUserBankDetails(application.userId);
    if (!bankDetails) {
      throw new Error('User bank details not found');
    }

    // Create payment queue entry
    const queueEntry: Omit<PaymentQueueEntry, 'queueId' | 'createdAt' | 'updatedAt'> = {
      applicationId: application.applicationId,
      userId: application.userId,
      schemeId: application.schemeId,
      approvedAmount: application.paymentInfo.approvedAmount,
      beneficiaryName: bankDetails.accountHolderName || application.applicationData.beneficiary,
      bankAccountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      bankName: bankDetails.bankName || '',
      branchName: bankDetails.branchName,
      queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
      validationStatus: VALIDATION_STATUS.PENDING,
      validationDetails: {},
      priorityLevel: this.calculatePriorityLevel(application),
      retryCount: 0
    };

    const createdEntry = await this.financeRepository.addToPaymentQueue(queueEntry);

    // Trigger bank validation asynchronously
    this.validateBankDetailsAsync(createdEntry.queueId);

    return createdEntry;
  }

  async validateBankDetails(queueId: string): Promise<BankValidationResult> {
    const queueEntry = await this.financeRepository.getPaymentQueueEntryById(queueId);
    if (!queueEntry) {
      throw new Error('Payment queue entry not found');
    }

    // Check cache first
    const cachedResult = await this.financeRepository.getBankValidationCache(
      queueEntry.bankAccountNumber,
      queueEntry.ifscCode
    );

    if (cachedResult && cachedResult.expiresAt > new Date()) {
      const result: BankValidationResult = {
        isValid: cachedResult.isValid,
        bankName: cachedResult.bankName,
        branchName: cachedResult.branchName,
        cached: true
      };

      // Update queue entry with cached result
      await this.updateQueueEntryValidation(queueId, result);
      return result;
    }

    // Perform fresh validation
    try {
      const ifscResult = await this.ifscService.verifyIFSC(queueEntry.ifscCode);
      
      const validationResult: BankValidationResult = {
        isValid: ifscResult.valid,
        bankName: ifscResult.details?.bank,
        branchName: ifscResult.details?.branch,
        error: ifscResult.error,
        cached: false
      };

      // Cache the result
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Cache for 30 days

      await this.financeRepository.setBankValidationCache({
        accountNumber: queueEntry.bankAccountNumber,
        ifscCode: queueEntry.ifscCode,
        validationResult: validationResult,
        isValid: validationResult.isValid,
        bankName: validationResult.bankName,
        branchName: validationResult.branchName,
        expiresAt
      });

      // Update queue entry
      await this.updateQueueEntryValidation(queueId, validationResult);

      return validationResult;
    } catch (error) {
      const errorResult: BankValidationResult = {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };

      await this.updateQueueEntryValidation(queueId, errorResult);
      return errorResult;
    }
  }

  async checkForDuplicates(queueId: string): Promise<DuplicateCheckResult> {
    const queueEntry = await this.financeRepository.getPaymentQueueEntryById(queueId);
    if (!queueEntry) {
      throw new Error('Payment queue entry not found');
    }

    const duplicates = await this.financeRepository.findDuplicates(
      queueEntry.bankAccountNumber,
      queueEntry.ifscCode,
      queueEntry.beneficiaryName
    );

    const isDuplicate = duplicates.length > 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (isDuplicate) {
      const exactMatches = duplicates.filter(d => d.detectionType === 'exact_match');
      const sameAccount = duplicates.filter(d => d.detectionType === 'same_account');
      
      if (exactMatches.length > 0) {
        riskLevel = 'high';
      } else if (sameAccount.length > 0) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      // Create duplicate detection record if not exists
      if (duplicates.length === 0) {
        await this.financeRepository.createDuplicateDetection({
          accountNumber: queueEntry.bankAccountNumber,
          ifscCode: queueEntry.ifscCode,
          beneficiaryName: queueEntry.beneficiaryName,
          userId: queueEntry.userId,
          applicationIds: [queueEntry.applicationId],
          detectionType: 'same_account',
          confidenceScore: 1.0,
          status: 'flagged'
        });
      }

      // Update queue entry status
      await this.financeRepository.updatePaymentQueueEntry(queueId, {
        validationStatus: VALIDATION_STATUS.DUPLICATE,
        validationDetails: {
          duplicateCount: duplicates.length,
          riskLevel,
          duplicateIds: duplicates.map(d => d.detectionId)
        }
      });
    }

    return {
      isDuplicate,
      duplicates,
      riskLevel
    };
  }

  // Batch Processing
  async createPaymentBatch(
    batchName: string,
    batchType: PaymentBatch['batchType'],
    createdBy: string,
    queueIds: string[]
  ): Promise<PaymentBatch> {
    if (queueIds.length === 0) {
      throw new Error('At least one payment queue entry is required');
    }

    // Get all queue entries
    const entries = await Promise.all(
      queueIds.map(id => this.financeRepository.getPaymentQueueEntryById(id))
    );

    const validEntries = entries.filter(entry => 
      entry && entry.validationStatus === VALIDATION_STATUS.VALID
    );

    if (validEntries.length === 0) {
      throw new Error('No valid entries found for batch processing');
    }

    const totalAmount = validEntries.reduce((sum, entry) => sum + entry!.approvedAmount, 0);
    const totalCount = validEntries.length;

    // Create batch
    const batch = await this.financeRepository.createPaymentBatch({
      batchName,
      batchType,
      totalAmount,
      totalCount,
      batchStatus: BATCH_STATUS.DRAFT,
      createdBy,
      reconciliationStatus: 'pending'
    });

    // Update queue entries with batch ID
    await Promise.all(
      validEntries.map(entry =>
        this.financeRepository.updatePaymentQueueEntry(entry!.queueId, {
          batchId: batch.batchId,
          queueStatus: PAYMENT_QUEUE_STATUS.VALIDATED
        })
      )
    );

    return batch;
  }

  async processBatch(batchId: string, processedBy: string): Promise<BatchProcessingResult> {
    const batch = await this.financeRepository.getPaymentBatches({ status: undefined }, 1, 0);
    const targetBatch = batch.find(b => b.batchId === batchId);
    
    if (!targetBatch) {
      throw new Error('Batch not found');
    }

    if (targetBatch.batchStatus !== BATCH_STATUS.READY) {
      throw new Error('Batch must be in ready status for processing');
    }

    // Update batch status to processing
    await this.financeRepository.updatePaymentBatch(batchId, {
      batchStatus: BATCH_STATUS.PROCESSING,
      processedBy,
      processedAt: new Date()
    });

    try {
      // Get all queue entries for this batch
      const queueEntries = await this.financeRepository.getPaymentQueueEntries({
        batchId
      });

      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process each entry
      for (const entry of queueEntries) {
        try {
          // Simulate SAP integration call
          const sapResult = await this.processSAPPayment(entry);
          
          if (sapResult.success) {
            await this.financeRepository.updatePaymentQueueEntry(entry.queueId, {
              queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
              processedAt: new Date(),
              processedBy
            });
            processedCount++;
          } else {
            await this.financeRepository.updatePaymentQueueEntry(entry.queueId, {
              queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
              failureReason: sapResult.error,
              retryCount: entry.retryCount + 1
            });
            failedCount++;
            errors.push(`${entry.queueId}: ${sapResult.error}`);
          }
        } catch (error) {
          await this.financeRepository.updatePaymentQueueEntry(entry.queueId, {
            queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
            failureReason: error instanceof Error ? error.message : 'Processing failed',
            retryCount: entry.retryCount + 1
          });
          failedCount++;
          errors.push(`${entry.queueId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update batch status
      const finalStatus = failedCount === 0 ? BATCH_STATUS.COMPLETED : BATCH_STATUS.FAILED;
      const sapReference = `SAP_${batchId}_${Date.now()}`;

      await this.financeRepository.updatePaymentBatch(batchId, {
        batchStatus: finalStatus,
        sapReference
      });

      return {
        batchId,
        processedCount,
        failedCount,
        totalAmount: targetBatch.totalAmount,
        sapReference,
        errors
      };
    } catch (error) {
      // Update batch status to failed
      await this.financeRepository.updatePaymentBatch(batchId, {
        batchStatus: BATCH_STATUS.FAILED
      });

      throw error;
    }
  }

  // Dashboard and Reporting
  async getFinanceDashboard(): Promise<FinanceDashboardSummary> {
    return await this.financeRepository.getFinanceDashboardSummary();
  }

  async getPaymentQueue(filters: PaymentQueueFilters = {}, page = 1, pageSize = 50): Promise<{
    entries: PaymentQueueEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const offset = (page - 1) * pageSize;
    const entries = await this.financeRepository.getPaymentQueueEntries(filters, pageSize, offset);
    
    // Get total count (simplified - in production, you'd want a separate count query)
    const totalEntries = await this.financeRepository.getPaymentQueueEntries(filters, 10000, 0);
    
    return {
      entries,
      total: totalEntries.length,
      page,
      pageSize
    };
  }

  async getPaymentBatches(filters: BatchFilters = {}, page = 1, pageSize = 20): Promise<{
    batches: PaymentBatch[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const offset = (page - 1) * pageSize;
    const batches = await this.financeRepository.getPaymentBatches(filters, pageSize, offset);
    
    // Get total count (simplified)
    const totalBatches = await this.financeRepository.getPaymentBatches(filters, 1000, 0);
    
    return {
      batches,
      total: totalBatches.length,
      page,
      pageSize
    };
  }

  // Helper methods
  private async validateBankDetailsAsync(queueId: string): Promise<void> {
    try {
      await this.validateBankDetails(queueId);
      await this.checkForDuplicates(queueId);
    } catch (error) {
      console.error(`Async validation failed for queue entry ${queueId}:`, error);
    }
  }

  // Payment Reconciliation Methods
  async importReconciliationFile(
    fileContent: string,
    fileFormat: 'csv' | 'excel' | 'txt',
    importedBy: string
  ): Promise<{
    totalRecords: number;
    successfulImports: number;
    failedImports: number;
    errors: string[];
  }> {
    const reconciliationRecords: Omit<PaymentReconciliation, 'reconciliationId' | 'createdAt'>[] = [];
    const errors: string[] = [];
    let totalRecords = 0;

    try {
      // Parse the file content based on format
      const parsedRecords = await this.parseReconciliationFile(fileContent, fileFormat);
      totalRecords = parsedRecords.length;

      // Validate and process each record
      for (const record of parsedRecords) {
        try {
          const validatedRecord = await this.validateReconciliationRecord(record);
          reconciliationRecords.push(validatedRecord);
        } catch (error) {
          errors.push(`Row ${record.rowNumber}: ${error instanceof Error ? error.message : 'Validation failed'}`);
        }
      }

      // Import valid records to database
      const importResults = await Promise.allSettled(
        reconciliationRecords.map(record => 
          this.financeRepository.createPaymentReconciliation(record)
        )
      );

      const successfulImports = importResults.filter(result => result.status === 'fulfilled').length;
      const failedImports = importResults.length - successfulImports;

      // Add import failures to errors
      importResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          errors.push(`Record ${index + 1}: ${result.reason?.message || 'Import failed'}`);
        }
      });

      // Trigger automatic matching for imported records
      this.performAutomaticMatchingAsync();

      return {
        totalRecords,
        successfulImports,
        failedImports,
        errors
      };
    } catch (error) {
      throw new Error(`Failed to import reconciliation file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async performAutomaticMatching(): Promise<{
    matchedCount: number;
    unmatchedCount: number;
    partialMatches: number;
  }> {
    // Get all pending reconciliation records
    const pendingReconciliations = await this.financeRepository.getPaymentReconciliations({
      status: 'pending'
    });

    let matchedCount = 0;
    let unmatchedCount = 0;
    let partialMatches = 0;

    for (const reconciliation of pendingReconciliations) {
      try {
        const matchResult = await this.matchReconciliationRecord(reconciliation);
        
        if (matchResult.matchType === 'exact') {
          matchedCount++;
          await this.financeRepository.updatePaymentReconciliation(reconciliation.reconciliationId, {
            reconciliationStatus: 'matched',
            matchConfidence: matchResult.confidence,
            queueId: matchResult.queueId,
            batchId: matchResult.batchId,
            reconciledAt: new Date(),
            notes: `Auto-matched: ${matchResult.reason}`
          });

          // Update payment queue status
          if (matchResult.queueId) {
            await this.financeRepository.updatePaymentQueueEntry(matchResult.queueId, {
              queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED
            });
          }
        } else if (matchResult.matchType === 'partial') {
          partialMatches++;
          await this.financeRepository.updatePaymentReconciliation(reconciliation.reconciliationId, {
            reconciliationStatus: 'partial',
            matchConfidence: matchResult.confidence,
            notes: `Partial match: ${matchResult.reason}`
          });
        } else {
          unmatchedCount++;
          await this.financeRepository.updatePaymentReconciliation(reconciliation.reconciliationId, {
            reconciliationStatus: 'unmatched',
            matchConfidence: 0,
            notes: 'No matching payment found'
          });
        }
      } catch (error) {
        console.error(`Failed to match reconciliation record ${reconciliation.reconciliationId}:`, error);
        unmatchedCount++;
      }
    }

    return {
      matchedCount,
      unmatchedCount,
      partialMatches
    };
  }

  async getReconciliationStatus(filters: {
    batchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: PaymentReconciliation['reconciliationStatus'];
  } = {}): Promise<{
    reconciliations: PaymentReconciliation[];
    summary: {
      total: number;
      matched: number;
      unmatched: number;
      partial: number;
      disputed: number;
    };
  }> {
    const reconciliations = await this.financeRepository.getPaymentReconciliations(filters);
    
    const summary = {
      total: reconciliations.length,
      matched: reconciliations.filter(r => r.reconciliationStatus === 'matched').length,
      unmatched: reconciliations.filter(r => r.reconciliationStatus === 'unmatched').length,
      partial: reconciliations.filter(r => r.reconciliationStatus === 'partial').length,
      disputed: reconciliations.filter(r => r.reconciliationStatus === 'disputed').length
    };

    return {
      reconciliations,
      summary
    };
  }

  async handlePaymentFailure(
    queueId: string,
    failureReason: string,
    retryable: boolean = true
  ): Promise<{
    updated: boolean;
    nextAction: 'retry' | 'manual_review' | 'cancelled';
    retryScheduled?: Date;
  }> {
    const queueEntry = await this.financeRepository.getPaymentQueueEntryById(queueId);
    if (!queueEntry) {
      throw new Error('Payment queue entry not found');
    }

    const maxRetries = 3;
    const newRetryCount = queueEntry.retryCount + 1;
    
    let nextAction: 'retry' | 'manual_review' | 'cancelled' = 'manual_review';
    let retryScheduled: Date | undefined;

    if (retryable && newRetryCount <= maxRetries) {
      nextAction = 'retry';
      // Schedule retry with exponential backoff
      retryScheduled = new Date();
      retryScheduled.setHours(retryScheduled.getHours() + Math.pow(2, newRetryCount));
    } else if (newRetryCount > maxRetries) {
      nextAction = 'cancelled';
    }

    // Update queue entry
    const updateData: Partial<PaymentQueueEntry> = {
      queueStatus: nextAction === 'cancelled' ? PAYMENT_QUEUE_STATUS.CANCELLED : PAYMENT_QUEUE_STATUS.FAILED,
      failureReason,
      retryCount: newRetryCount,
      scheduledDate: retryScheduled
    };

    await this.financeRepository.updatePaymentQueueEntry(queueId, updateData);

    // Create reconciliation record for failed payment
    await this.financeRepository.createPaymentReconciliation({
      queueId,
      amount: queueEntry.approvedAmount,
      transactionDate: new Date(),
      reconciliationStatus: 'disputed',
      matchConfidence: 0,
      notes: `Payment failed: ${failureReason}. Retry count: ${newRetryCount}`
    });

    return {
      updated: true,
      nextAction,
      retryScheduled
    };
  }

  async retryFailedPayments(
    queueIds?: string[],
    processedBy?: string
  ): Promise<{
    retriedCount: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  }> {
    let failedEntries: PaymentQueueEntry[];
    
    if (queueIds && queueIds.length > 0) {
      // Retry specific entries
      failedEntries = await Promise.all(
        queueIds.map(id => this.financeRepository.getPaymentQueueEntryById(id))
      ).then(entries => entries.filter(entry => entry !== null) as PaymentQueueEntry[]);
    } else {
      // Retry all scheduled failed payments
      const now = new Date();
      failedEntries = await this.financeRepository.getPaymentQueueEntries({
        status: PAYMENT_QUEUE_STATUS.FAILED
      });
      
      // Filter entries that are scheduled for retry
      failedEntries = failedEntries.filter(entry => 
        entry.scheduledDate && entry.scheduledDate <= now && entry.retryCount < 3
      );
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const entry of failedEntries) {
      try {
        // Reset status to validated for retry
        await this.financeRepository.updatePaymentQueueEntry(entry.queueId, {
          queueStatus: PAYMENT_QUEUE_STATUS.VALIDATED,
          processedBy,
          scheduledDate: undefined
        });

        // Attempt payment processing
        const paymentResult = await this.processSAPPayment(entry);
        
        if (paymentResult.success) {
          await this.financeRepository.updatePaymentQueueEntry(entry.queueId, {
            queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
            processedAt: new Date(),
            failureReason: undefined
          });
          successCount++;
        } else {
          await this.handlePaymentFailure(entry.queueId, paymentResult.error || 'Retry failed', true);
          failedCount++;
          errors.push(`${entry.queueId}: ${paymentResult.error}`);
        }
      } catch (error) {
        await this.handlePaymentFailure(
          entry.queueId, 
          error instanceof Error ? error.message : 'Retry processing failed', 
          true
        );
        failedCount++;
        errors.push(`${entry.queueId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      retriedCount: failedEntries.length,
      successCount,
      failedCount,
      errors
    };
  }

  // Private helper methods for reconciliation
  private async parseReconciliationFile(
    fileContent: string,
    fileFormat: 'csv' | 'excel' | 'txt'
  ): Promise<Array<{
    rowNumber: number;
    bankReference?: string;
    transactionId?: string;
    amount: number;
    transactionDate: Date;
    additionalData?: Record<string, any>;
  }>> {
    const records: Array<any> = [];

    if (fileFormat === 'csv' || fileFormat === 'txt') {
      const lines = fileContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record: any = { rowNumber: i + 1 };
        
        headers.forEach((header, index) => {
          const value = values[index] || '';
          
          switch (header) {
            case 'bank_reference':
            case 'reference':
              record.bankReference = value;
              break;
            case 'transaction_id':
            case 'txn_id':
              record.transactionId = value;
              break;
            case 'amount':
              record.amount = parseFloat(value);
              break;
            case 'transaction_date':
            case 'date':
              record.transactionDate = new Date(value);
              break;
            default:
              if (!record.additionalData) record.additionalData = {};
              record.additionalData[header] = value;
          }
        });
        
        records.push(record);
      }
    }
    // Add Excel parsing logic here if needed
    
    return records;
  }

  private async validateReconciliationRecord(record: any): Promise<Omit<PaymentReconciliation, 'reconciliationId' | 'createdAt'>> {
    if (!record.amount || isNaN(record.amount) || record.amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!record.transactionDate || isNaN(record.transactionDate.getTime())) {
      throw new Error('Invalid transaction date');
    }

    return {
      bankReference: record.bankReference,
      transactionId: record.transactionId,
      amount: record.amount,
      transactionDate: record.transactionDate,
      reconciliationStatus: 'pending',
      matchConfidence: 0,
      notes: record.additionalData ? JSON.stringify(record.additionalData) : undefined
    };
  }

  private async matchReconciliationRecord(reconciliation: PaymentReconciliation): Promise<{
    matchType: 'exact' | 'partial' | 'none';
    confidence: number;
    queueId?: string;
    batchId?: string;
    reason: string;
  }> {
    // Try to match by amount and date first
    const queueEntries = await this.financeRepository.getPaymentQueueEntries({
      status: PAYMENT_QUEUE_STATUS.PROCESSED
    });

    // Exact match: same amount and date within 1 day
    const exactMatches = queueEntries.filter(entry => {
      if (!entry.processedAt) return false;
      
      const amountMatch = Math.abs(entry.approvedAmount - reconciliation.amount) < 0.01;
      const dateMatch = Math.abs(
        entry.processedAt.getTime() - reconciliation.transactionDate.getTime()
      ) < 24 * 60 * 60 * 1000; // 1 day tolerance
      
      return amountMatch && dateMatch;
    });

    if (exactMatches.length === 1) {
      return {
        matchType: 'exact',
        confidence: 1.0,
        queueId: exactMatches[0].queueId,
        batchId: exactMatches[0].batchId,
        reason: 'Exact match on amount and date'
      };
    }

    // Partial match: same amount but different date
    const amountMatches = queueEntries.filter(entry => 
      Math.abs(entry.approvedAmount - reconciliation.amount) < 0.01
    );

    if (amountMatches.length === 1) {
      return {
        matchType: 'partial',
        confidence: 0.7,
        queueId: amountMatches[0].queueId,
        batchId: amountMatches[0].batchId,
        reason: 'Amount match but date mismatch'
      };
    }

    return {
      matchType: 'none',
      confidence: 0,
      reason: 'No matching payment found'
    };
  }

  private async performAutomaticMatchingAsync(): Promise<void> {
    try {
      await this.performAutomaticMatching();
    } catch (error) {
      console.error('Automatic matching failed:', error);
    }
  }

  private async updateQueueEntryValidation(queueId: string, result: BankValidationResult): Promise<void> {
    const validationStatus = result.isValid ? VALIDATION_STATUS.VALID : VALIDATION_STATUS.INVALID;
    
    await this.financeRepository.updatePaymentQueueEntry(queueId, {
      validationStatus,
      validationDetails: {
        bankValidation: result,
        validatedAt: new Date()
      },
      bankName: result.bankName || undefined,
      branchName: result.branchName || undefined
    });
  }

  private calculatePriorityLevel(application: Application): number {
    // Priority calculation logic
    const amount = application.paymentInfo?.approvedAmount || 0;
    
    if (amount > 100000) return PRIORITY_LEVELS.HIGH;
    if (amount > 50000) return PRIORITY_LEVELS.NORMAL;
    return PRIORITY_LEVELS.LOW;
  }

  private async getUserBankDetails(userId: string): Promise<{
    accountNumber: string;
    ifscCode: string;
    bankName?: string;
    branchName?: string;
    accountHolderName?: string;
  } | null> {
    // This would typically fetch from user service or user profile
    // For now, returning a mock implementation
    // In real implementation, this would call user service API
    return {
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
      branchName: 'Main Branch',
      accountHolderName: 'John Doe'
    };
  }

  private async processSAPPayment(entry: PaymentQueueEntry): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      // Convert to SAP payment request
      const sapRequest = this.sapService.convertToSAPPaymentRequest(entry);
      
      // Process payment through SAP
      const result = await this.sapService.processPayment(sapRequest);
      
      if (result.success) {
        return {
          success: true,
          transactionId: result.transactionId
        };
      } else {
        return {
          success: false,
          error: result.error || 'SAP payment processing failed'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'SAP integration failed'
      };
    }
  }

  /**
   * Get integration health status
   */
  async getIntegrationHealth(): Promise<any> {
    return await this.healthService.getCurrentHealth();
  }

  /**
   * Get integration health metrics
   */
  getIntegrationMetrics(hours: number = 24): any {
    return this.healthService.getHealthMetrics(hours);
  }

  /**
   * Test integration connectivity
   */
  async testIntegrationConnectivity(): Promise<any> {
    return await this.healthService.testConnectivity();
  }

  /**
   * Validate bank account using payment gateway
   */
  async validateBankAccountViaGateway(accountNumber: string, ifscCode: string, beneficiaryName?: string): Promise<{
    success: boolean;
    valid: boolean;
    bankName?: string;
    branchName?: string;
    accountHolderName?: string;
    error?: string;
  }> {
    try {
      const result = await this.paymentGatewayService.validateBankAccount({
        accountNumber,
        ifscCode,
        beneficiaryName
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        valid: false,
        error: error.message || 'Bank validation failed'
      };
    }
  }
}

// Mock IFSC Verification Service for local use
// In production, this would be replaced with HTTP calls to user-service
class MockIFSCVerificationService implements IFSCVerificationService {
  async verifyIFSC(ifscCode: string): Promise<{
    success: boolean;
    valid: boolean;
    details?: {
      ifsc: string;
      bank: string;
      branch: string;
      address: string;
      city: string;
      state: string;
    };
    error?: string;
  }> {
    // Basic format validation
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const isValidFormat = ifscRegex.test(ifscCode.toUpperCase());

    if (!isValidFormat) {
      return {
        success: true,
        valid: false,
        error: 'Invalid IFSC code format'
      };
    }

    // Mock bank details based on first 4 characters
    const bankCode = ifscCode.substring(0, 4).toUpperCase();
    const bankNames: Record<string, string> = {
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'AXIS': 'Axis Bank',
      'PUNB': 'Punjab National Bank'
    };

    const bankName = bankNames[bankCode] || `Bank (${bankCode})`;

    return {
      success: true,
      valid: true,
      details: {
        ifsc: ifscCode.toUpperCase(),
        bank: bankName,
        branch: 'Main Branch',
        address: '123 Bank Street',
        city: 'Mumbai',
        state: 'Maharashtra'
      }
    };
  }
}