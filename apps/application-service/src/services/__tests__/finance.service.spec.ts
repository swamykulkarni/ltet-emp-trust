import { FinanceService } from '../finance.service';
import { FinanceRepository } from '../../repositories/finance.repository';
import { ApplicationRepository } from '../../repositories/application.repository';
import { PAYMENT_QUEUE_STATUS, VALIDATION_STATUS, BATCH_STATUS } from '../../models/finance.model';

// Mock the repositories
jest.mock('../../repositories/finance.repository');
jest.mock('../../repositories/application.repository');

describe('FinanceService', () => {
  let financeService: FinanceService;
  let mockFinanceRepository: jest.Mocked<FinanceRepository>;
  let mockApplicationRepository: jest.Mocked<ApplicationRepository>;

  beforeEach(() => {
    financeService = new FinanceService();
    mockFinanceRepository = new FinanceRepository() as jest.Mocked<FinanceRepository>;
    mockApplicationRepository = new ApplicationRepository() as jest.Mocked<ApplicationRepository>;
    
    (financeService as any).financeRepository = mockFinanceRepository;
    (financeService as any).applicationRepository = mockApplicationRepository;
  });

  describe('addApprovedApplicationToQueue', () => {
    it('should add approved application to payment queue', async () => {
      const mockApplication = {
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        applicationData: {
          claimAmount: 50000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [],
        workflow: {
          currentStatus: 'approved' as const,
          approvalHistory: [],
          slaDeadline: new Date(),
          escalationLevel: 0
        },
        paymentInfo: {
          approvedAmount: 45000,
          paymentStatus: 'pending' as const
        },
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockQueueEntry = {
        queueId: 'queue-123',
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        approvedAmount: 45000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        branchName: 'Main Branch',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.PENDING,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockApplicationRepository.getApplicationById.mockResolvedValue(mockApplication);
      mockFinanceRepository.addToPaymentQueue.mockResolvedValue(mockQueueEntry);

      // Mock getUserBankDetails method
      jest.spyOn(financeService as any, 'getUserBankDetails').mockResolvedValue({
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        branchName: 'Main Branch',
        accountHolderName: 'John Doe'
      });

      // Mock validateBankDetailsAsync to prevent async validation errors
      jest.spyOn(financeService as any, 'validateBankDetailsAsync').mockResolvedValue(undefined);

      const result = await financeService.addApprovedApplicationToQueue('app-123', 'finance-user-123');

      expect(result).toEqual(mockQueueEntry);
      expect(mockFinanceRepository.addToPaymentQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-123',
          userId: 'user-123',
          approvedAmount: 45000,
          queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
          validationStatus: VALIDATION_STATUS.PENDING
        })
      );
    });

    it('should throw error if application is not approved', async () => {
      const mockApplication = {
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        applicationData: {
          claimAmount: 50000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [],
        workflow: {
          currentStatus: 'under_review' as const,
          approvalHistory: [],
          slaDeadline: new Date(),
          escalationLevel: 0
        },
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockApplicationRepository.getApplicationById.mockResolvedValue(mockApplication);

      await expect(
        financeService.addApprovedApplicationToQueue('app-123', 'finance-user-123')
      ).rejects.toThrow('Application must be approved before adding to payment queue');
    });

    it('should throw error if application not found', async () => {
      mockApplicationRepository.getApplicationById.mockResolvedValue(null);

      await expect(
        financeService.addApprovedApplicationToQueue('non-existent', 'finance-user-123')
      ).rejects.toThrow('Application not found');
    });
  });

  describe('validateBankDetails', () => {
    it('should validate bank details successfully', async () => {
      const mockQueueEntry = {
        queueId: 'queue-123',
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        approvedAmount: 45000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: '',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.PENDING,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUpdatedEntry = {
        ...mockQueueEntry,
        validationStatus: VALIDATION_STATUS.VALID,
        bankName: 'State Bank of India',
        branchName: 'Main Branch'
      };

      mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
      mockFinanceRepository.getBankValidationCache.mockResolvedValue(null);
      mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue(mockUpdatedEntry);

      const result = await financeService.validateBankDetails('queue-123');

      expect(result.isValid).toBe(true);
      expect(result.bankName).toBe('State Bank of India');
      expect(mockFinanceRepository.updatePaymentQueueEntry).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          validationStatus: VALIDATION_STATUS.VALID,
          bankName: 'State Bank of India'
        })
      );
    });

    it('should return cached validation result', async () => {
      const mockQueueEntry = {
        queueId: 'queue-123',
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        approvedAmount: 45000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: '',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.PENDING,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCachedResult = {
        cacheId: 'cache-123',
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        validationResult: { isValid: true },
        isValid: true,
        bankName: 'State Bank of India',
        branchName: 'Main Branch',
        validationDate: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
      mockFinanceRepository.getBankValidationCache.mockResolvedValue(mockCachedResult);

      const result = await financeService.validateBankDetails('queue-123');

      expect(result.isValid).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.bankName).toBe('State Bank of India');
    });
  });

  describe('checkForDuplicates', () => {
    it('should detect duplicates and flag them', async () => {
      const mockQueueEntry = {
        queueId: 'queue-123',
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        approvedAmount: 45000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.PENDING,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockDuplicates = [{
        detectionId: 'dup-123',
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        beneficiaryName: 'John Doe',
        userId: 'user-456',
        applicationIds: ['app-456'],
        detectionType: 'exact_match' as const,
        confidenceScore: 1.0,
        status: 'flagged' as const,
        createdAt: new Date()
      }];

      mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
      mockFinanceRepository.findDuplicates.mockResolvedValue(mockDuplicates);
      mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue({
        ...mockQueueEntry,
        validationStatus: VALIDATION_STATUS.DUPLICATE
      });

      const result = await financeService.checkForDuplicates('queue-123');

      expect(result.isDuplicate).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.duplicates).toEqual(mockDuplicates);
      expect(mockFinanceRepository.updatePaymentQueueEntry).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          validationStatus: VALIDATION_STATUS.DUPLICATE
        })
      );
    });

    it('should return no duplicates when none found', async () => {
      const mockQueueEntry = {
        queueId: 'queue-123',
        applicationId: 'app-123',
        userId: 'user-123',
        schemeId: 'scheme-123',
        approvedAmount: 45000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.PENDING,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
      mockFinanceRepository.findDuplicates.mockResolvedValue([]);

      const result = await financeService.checkForDuplicates('queue-123');

      expect(result.isDuplicate).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.duplicates).toEqual([]);
    });
  });

  describe('createPaymentBatch', () => {
    it('should create payment batch with valid entries', async () => {
      const mockQueueEntries = [
        {
          queueId: 'queue-1',
          applicationId: 'app-1',
          userId: 'user-1',
          schemeId: 'scheme-1',
          approvedAmount: 25000,
          beneficiaryName: 'John Doe',
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
          validationStatus: VALIDATION_STATUS.VALID,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          queueId: 'queue-2',
          applicationId: 'app-2',
          userId: 'user-2',
          schemeId: 'scheme-2',
          approvedAmount: 30000,
          beneficiaryName: 'Jane Smith',
          bankAccountNumber: '0987654321',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank',
          queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
          validationStatus: VALIDATION_STATUS.VALID,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockBatch = {
        batchId: 'batch-123',
        batchName: 'Daily Batch 2024-01-09',
        batchType: 'regular' as const,
        totalAmount: 55000,
        totalCount: 2,
        batchStatus: BATCH_STATUS.DRAFT,
        createdBy: 'finance-user-123',
        reconciliationStatus: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockFinanceRepository.getPaymentQueueEntryById
        .mockResolvedValueOnce(mockQueueEntries[0])
        .mockResolvedValueOnce(mockQueueEntries[1]);
      mockFinanceRepository.createPaymentBatch.mockResolvedValue(mockBatch);
      mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue(mockQueueEntries[0]);

      const result = await financeService.createPaymentBatch(
        'Daily Batch 2024-01-09',
        'regular',
        'finance-user-123',
        ['queue-1', 'queue-2']
      );

      expect(result).toEqual(mockBatch);
      expect(mockFinanceRepository.createPaymentBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          batchName: 'Daily Batch 2024-01-09',
          batchType: 'regular',
          totalAmount: 55000,
          totalCount: 2,
          batchStatus: BATCH_STATUS.DRAFT
        })
      );
    });

    it('should throw error if no valid entries found', async () => {
      const mockInvalidEntry = {
        queueId: 'queue-1',
        applicationId: 'app-1',
        userId: 'user-1',
        schemeId: 'scheme-1',
        approvedAmount: 25000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        queueStatus: PAYMENT_QUEUE_STATUS.PENDING,
        validationStatus: VALIDATION_STATUS.INVALID,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockInvalidEntry);

      await expect(
        financeService.createPaymentBatch(
          'Test Batch',
          'regular',
          'finance-user-123',
          ['queue-1']
        )
      ).rejects.toThrow('No valid entries found for batch processing');
    });
  });

  describe('getFinanceDashboard', () => {
    it('should return dashboard summary', async () => {
      const mockSummary = {
        pendingApprovals: 15,
        pendingValidation: 8,
        readyForProcessing: 12,
        processingToday: 5,
        totalAmountPending: 250000,
        duplicatesDetected: 2,
        failedPayments: 1,
        reconciliationPending: 3
      };

      mockFinanceRepository.getFinanceDashboardSummary.mockResolvedValue(mockSummary);

      const result = await financeService.getFinanceDashboard();

      expect(result).toEqual(mockSummary);
      expect(mockFinanceRepository.getFinanceDashboardSummary).toHaveBeenCalled();
    });
  });

  describe('Payment Reconciliation', () => {
    describe('importReconciliationFile', () => {
      it('should import CSV reconciliation file successfully', async () => {
        const csvContent = `bank_reference,transaction_id,amount,transaction_date
REF001,TXN001,25000,2024-01-09
REF002,TXN002,30000,2024-01-09`;

        mockFinanceRepository.createPaymentReconciliation.mockResolvedValue({
          reconciliationId: 'recon-123',
          bankReference: 'REF001',
          transactionId: 'TXN001',
          amount: 25000,
          transactionDate: new Date('2024-01-09'),
          reconciliationStatus: 'pending',
          matchConfidence: 0,
          createdAt: new Date()
        });

        // Mock performAutomaticMatchingAsync to prevent async matching errors
        jest.spyOn(financeService as any, 'performAutomaticMatchingAsync').mockResolvedValue(undefined);

        const result = await financeService.importReconciliationFile(
          csvContent,
          'csv',
          'finance-user-123'
        );

        expect(result.totalRecords).toBe(2);
        expect(result.successfulImports).toBe(2);
        expect(result.failedImports).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockFinanceRepository.createPaymentReconciliation).toHaveBeenCalledTimes(2);
      });

      it('should handle invalid CSV data', async () => {
        const csvContent = `bank_reference,transaction_id,amount,transaction_date
REF001,TXN001,invalid_amount,2024-01-09
REF002,TXN002,30000,invalid_date`;

        // Mock the repository to reject invalid records
        mockFinanceRepository.createPaymentReconciliation.mockRejectedValue(new Error('Invalid data'));

        const result = await financeService.importReconciliationFile(
          csvContent,
          'csv',
          'finance-user-123'
        );

        expect(result.totalRecords).toBe(2);
        expect(result.successfulImports).toBe(0);
        expect(result.failedImports).toBe(0); // No records make it to the import stage due to validation errors
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('Invalid amount');
        expect(result.errors[1]).toContain('Invalid transaction date');
      });
    });

    describe('performAutomaticMatching', () => {
      it('should match reconciliation records with payment queue entries', async () => {
        const mockReconciliations = [
          {
            reconciliationId: 'recon-1',
            amount: 25000,
            transactionDate: new Date('2024-01-09'),
            reconciliationStatus: 'pending' as const,
            matchConfidence: 0,
            createdAt: new Date()
          }
        ];

        const mockQueueEntries = [
          {
            queueId: 'queue-1',
            applicationId: 'app-1',
            userId: 'user-1',
            schemeId: 'scheme-1',
            approvedAmount: 25000,
            beneficiaryName: 'John Doe',
            bankAccountNumber: '1234567890',
            ifscCode: 'SBIN0001234',
            bankName: 'State Bank of India',
            queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
            validationStatus: VALIDATION_STATUS.VALID,
            validationDetails: {},
            priorityLevel: 2,
            retryCount: 0,
            processedAt: new Date('2024-01-09'),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        mockFinanceRepository.getPaymentReconciliations.mockResolvedValue(mockReconciliations);
        mockFinanceRepository.getPaymentQueueEntries.mockResolvedValue(mockQueueEntries);
        mockFinanceRepository.updatePaymentReconciliation.mockResolvedValue({
          ...mockReconciliations[0],
          reconciliationStatus: 'matched',
          matchConfidence: 1.0
        });
        mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue(mockQueueEntries[0]);

        const result = await financeService.performAutomaticMatching();

        expect(result.matchedCount).toBe(1);
        expect(result.unmatchedCount).toBe(0);
        expect(result.partialMatches).toBe(0);
        expect(mockFinanceRepository.updatePaymentReconciliation).toHaveBeenCalledWith(
          'recon-1',
          expect.objectContaining({
            reconciliationStatus: 'matched',
            matchConfidence: 1.0,
            queueId: 'queue-1'
          })
        );
      });

      it('should handle partial matches', async () => {
        const mockReconciliations = [
          {
            reconciliationId: 'recon-1',
            amount: 25000,
            transactionDate: new Date('2024-01-10'), // Different date
            reconciliationStatus: 'pending' as const,
            matchConfidence: 0,
            createdAt: new Date()
          }
        ];

        const mockQueueEntries = [
          {
            queueId: 'queue-1',
            applicationId: 'app-1',
            userId: 'user-1',
            schemeId: 'scheme-1',
            approvedAmount: 25000,
            beneficiaryName: 'John Doe',
            bankAccountNumber: '1234567890',
            ifscCode: 'SBIN0001234',
            bankName: 'State Bank of India',
            queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
            validationStatus: VALIDATION_STATUS.VALID,
            validationDetails: {},
            priorityLevel: 2,
            retryCount: 0,
            processedAt: new Date('2024-01-09'), // Different date
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        mockFinanceRepository.getPaymentReconciliations.mockResolvedValue(mockReconciliations);
        mockFinanceRepository.getPaymentQueueEntries.mockResolvedValue(mockQueueEntries);
        mockFinanceRepository.updatePaymentReconciliation.mockResolvedValue({
          ...mockReconciliations[0],
          reconciliationStatus: 'partial',
          matchConfidence: 0.7
        });

        const result = await financeService.performAutomaticMatching();

        expect(result.matchedCount).toBe(0);
        expect(result.unmatchedCount).toBe(0);
        expect(result.partialMatches).toBe(1);
        expect(mockFinanceRepository.updatePaymentReconciliation).toHaveBeenCalledWith(
          'recon-1',
          expect.objectContaining({
            reconciliationStatus: 'partial',
            matchConfidence: 0.7
          })
        );
      });
    });

    describe('handlePaymentFailure', () => {
      it('should handle payment failure with retry', async () => {
        const mockQueueEntry = {
          queueId: 'queue-123',
          applicationId: 'app-123',
          userId: 'user-123',
          schemeId: 'scheme-123',
          approvedAmount: 25000,
          beneficiaryName: 'John Doe',
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
          validationStatus: VALIDATION_STATUS.VALID,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
        mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue({
          ...mockQueueEntry,
          queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
          retryCount: 2
        });
        mockFinanceRepository.createPaymentReconciliation.mockResolvedValue({
          reconciliationId: 'recon-123',
          queueId: 'queue-123',
          amount: 25000,
          transactionDate: new Date(),
          reconciliationStatus: 'disputed',
          matchConfidence: 0,
          createdAt: new Date()
        });

        const result = await financeService.handlePaymentFailure(
          'queue-123',
          'SAP system unavailable',
          true
        );

        expect(result.updated).toBe(true);
        expect(result.nextAction).toBe('retry');
        expect(result.retryScheduled).toBeDefined();
        expect(mockFinanceRepository.updatePaymentQueueEntry).toHaveBeenCalledWith(
          'queue-123',
          expect.objectContaining({
            queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
            failureReason: 'SAP system unavailable',
            retryCount: 2
          })
        );
      });

      it('should cancel payment after max retries', async () => {
        const mockQueueEntry = {
          queueId: 'queue-123',
          applicationId: 'app-123',
          userId: 'user-123',
          schemeId: 'scheme-123',
          approvedAmount: 25000,
          beneficiaryName: 'John Doe',
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
          validationStatus: VALIDATION_STATUS.VALID,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 3, // Max retries reached
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockFinanceRepository.getPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
        mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue({
          ...mockQueueEntry,
          queueStatus: PAYMENT_QUEUE_STATUS.CANCELLED,
          retryCount: 4
        });
        mockFinanceRepository.createPaymentReconciliation.mockResolvedValue({
          reconciliationId: 'recon-123',
          queueId: 'queue-123',
          amount: 25000,
          transactionDate: new Date(),
          reconciliationStatus: 'disputed',
          matchConfidence: 0,
          createdAt: new Date()
        });

        const result = await financeService.handlePaymentFailure(
          'queue-123',
          'Persistent failure',
          true
        );

        expect(result.updated).toBe(true);
        expect(result.nextAction).toBe('cancelled');
        expect(result.retryScheduled).toBeUndefined();
        expect(mockFinanceRepository.updatePaymentQueueEntry).toHaveBeenCalledWith(
          'queue-123',
          expect.objectContaining({
            queueStatus: PAYMENT_QUEUE_STATUS.CANCELLED,
            retryCount: 4
          })
        );
      });
    });

    describe('retryFailedPayments', () => {
      it('should retry failed payments successfully', async () => {
        const mockFailedEntries = [
          {
            queueId: 'queue-1',
            applicationId: 'app-1',
            userId: 'user-1',
            schemeId: 'scheme-1',
            approvedAmount: 25000,
            beneficiaryName: 'John Doe',
            bankAccountNumber: '1234567890',
            ifscCode: 'SBIN0001234',
            bankName: 'State Bank of India',
            queueStatus: PAYMENT_QUEUE_STATUS.FAILED,
            validationStatus: VALIDATION_STATUS.VALID,
            validationDetails: {},
            priorityLevel: 2,
            retryCount: 1,
            scheduledDate: new Date(Date.now() - 60000), // 1 minute ago
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        mockFinanceRepository.getPaymentQueueEntries.mockResolvedValue(mockFailedEntries);
        mockFinanceRepository.updatePaymentQueueEntry.mockResolvedValue(mockFailedEntries[0]);

        // Mock successful SAP payment
        jest.spyOn(financeService as any, 'processSAPPayment').mockResolvedValue({
          success: true,
          transactionId: 'TXN_123'
        });

        const result = await financeService.retryFailedPayments(undefined, 'finance-user-123');

        expect(result.retriedCount).toBe(1);
        expect(result.successCount).toBe(1);
        expect(result.failedCount).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockFinanceRepository.updatePaymentQueueEntry).toHaveBeenCalledWith(
          'queue-1',
          expect.objectContaining({
            queueStatus: PAYMENT_QUEUE_STATUS.PROCESSED,
            processedAt: expect.any(Date)
          })
        );
      });
    });

    describe('getReconciliationStatus', () => {
      it('should return reconciliation status with summary', async () => {
        const mockReconciliations = [
          {
            reconciliationId: 'recon-1',
            amount: 25000,
            transactionDate: new Date(),
            reconciliationStatus: 'matched' as const,
            matchConfidence: 1.0,
            createdAt: new Date()
          },
          {
            reconciliationId: 'recon-2',
            amount: 30000,
            transactionDate: new Date(),
            reconciliationStatus: 'unmatched' as const,
            matchConfidence: 0,
            createdAt: new Date()
          },
          {
            reconciliationId: 'recon-3',
            amount: 15000,
            transactionDate: new Date(),
            reconciliationStatus: 'partial' as const,
            matchConfidence: 0.7,
            createdAt: new Date()
          }
        ];

        mockFinanceRepository.getPaymentReconciliations.mockResolvedValue(mockReconciliations);

        const result = await financeService.getReconciliationStatus();

        expect(result.reconciliations).toEqual(mockReconciliations);
        expect(result.summary).toEqual({
          total: 3,
          matched: 1,
          unmatched: 1,
          partial: 1,
          disputed: 0
        });
      });
    });
  });
});