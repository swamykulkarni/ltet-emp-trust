import { Request, Response } from 'express';
import { FinanceController } from '../finance.controller';
import { FinanceService } from '../../services/finance.service';

// Mock the service
jest.mock('../../services/finance.service');

describe('FinanceController', () => {
  let financeController: FinanceController;
  let mockFinanceService: jest.Mocked<FinanceService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    financeController = new FinanceController();
    mockFinanceService = new FinanceService() as jest.Mocked<FinanceService>;
    (financeController as any).financeService = mockFinanceService;

    mockRequest = {
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('getDashboard', () => {
    it('should return dashboard summary', async () => {
      const mockDashboard = {
        pendingApprovals: 15,
        pendingValidation: 8,
        readyForProcessing: 12,
        processingToday: 5,
        totalAmountPending: 250000,
        duplicatesDetected: 2,
        failedPayments: 1,
        reconciliationPending: 3
      };

      mockFinanceService.getFinanceDashboard.mockResolvedValue(mockDashboard);

      await financeController.getDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockFinanceService.getFinanceDashboard).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockDashboard
      });
    });

    it('should handle errors', async () => {
      mockFinanceService.getFinanceDashboard.mockRejectedValue(new Error('Database error'));

      await financeController.getDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });
  });

  describe('addToPaymentQueue', () => {
    it('should add application to payment queue', async () => {
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
        queueStatus: 'pending' as const,
        validationStatus: 'pending' as const,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest.params = { applicationId: 'app-123' };
      mockRequest.body = { financeUserId: 'finance-user-123' };

      mockFinanceService.addApprovedApplicationToQueue.mockResolvedValue(mockQueueEntry);

      await financeController.addToPaymentQueue(mockRequest as Request, mockResponse as Response);

      expect(mockFinanceService.addApprovedApplicationToQueue).toHaveBeenCalledWith(
        'app-123',
        'finance-user-123'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockQueueEntry,
        message: 'Application added to payment queue successfully'
      });
    });

    it('should return 400 if financeUserId is missing', async () => {
      mockRequest.params = { applicationId: 'app-123' };
      mockRequest.body = {};

      await financeController.addToPaymentQueue(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'financeUserId is required'
      });
    });
  });

  describe('getPaymentQueue', () => {
    it('should return payment queue with filters', async () => {
      const mockResult = {
        entries: [{
          queueId: 'queue-123',
          applicationId: 'app-123',
          userId: 'user-123',
          schemeId: 'scheme-123',
          approvedAmount: 45000,
          beneficiaryName: 'John Doe',
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          queueStatus: 'pending' as const,
          validationStatus: 'pending' as const,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        total: 1,
        page: 1,
        pageSize: 50
      };

      mockRequest.query = {
        status: 'pending',
        page: '1',
        pageSize: '50'
      };

      mockFinanceService.getPaymentQueue.mockResolvedValue(mockResult);

      await financeController.getPaymentQueue(mockRequest as Request, mockResponse as Response);

      expect(mockFinanceService.getPaymentQueue).toHaveBeenCalledWith(
        { status: 'pending' },
        1,
        50
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });
  });

  describe('createPaymentBatch', () => {
    it('should create payment batch', async () => {
      const mockBatch = {
        batchId: 'batch-123',
        batchName: 'Daily Batch 2024-01-09',
        batchType: 'regular' as const,
        totalAmount: 55000,
        totalCount: 2,
        batchStatus: 'draft' as const,
        createdBy: 'finance-user-123',
        reconciliationStatus: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest.body = {
        batchName: 'Daily Batch 2024-01-09',
        batchType: 'regular',
        createdBy: 'finance-user-123',
        queueIds: ['queue-1', 'queue-2']
      };

      mockFinanceService.createPaymentBatch.mockResolvedValue(mockBatch);

      await financeController.createPaymentBatch(mockRequest as Request, mockResponse as Response);

      expect(mockFinanceService.createPaymentBatch).toHaveBeenCalledWith(
        'Daily Batch 2024-01-09',
        'regular',
        'finance-user-123',
        ['queue-1', 'queue-2']
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockBatch,
        message: 'Payment batch created successfully'
      });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = {
        batchName: 'Test Batch'
        // Missing other required fields
      };

      await financeController.createPaymentBatch(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'batchName, batchType, createdBy, and queueIds (array) are required'
      });
    });
  });

  describe('validateBankDetails', () => {
    it('should validate bank details', async () => {
      const mockValidationResult = {
        isValid: true,
        bankName: 'State Bank of India',
        branchName: 'Main Branch'
      };

      mockRequest.params = { queueId: 'queue-123' };

      mockFinanceService.validateBankDetails.mockResolvedValue(mockValidationResult);

      await financeController.validateBankDetails(mockRequest as Request, mockResponse as Response);

      expect(mockFinanceService.validateBankDetails).toHaveBeenCalledWith('queue-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockValidationResult,
        message: 'Bank details validated successfully'
      });
    });
  });

  describe('exportPaymentQueue', () => {
    it('should export payment queue as CSV', async () => {
      const mockResult = {
        entries: [{
          queueId: 'queue-123',
          applicationId: 'app-123',
          beneficiaryName: 'John Doe',
          approvedAmount: 45000,
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          queueStatus: 'pending' as const,
          validationStatus: 'pending' as const,
          createdAt: new Date('2024-01-09T10:00:00Z')
        }],
        total: 1,
        page: 1,
        pageSize: 10000
      };

      mockRequest.query = { format: 'csv' };

      mockFinanceService.getPaymentQueue.mockResolvedValue(mockResult as any);

      await financeController.exportPaymentQueue(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        'attachment; filename="payment_queue.csv"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('"Queue ID","Application ID","Beneficiary Name"')
      );
    });
  });

  describe('Payment Reconciliation Endpoints', () => {
    describe('importReconciliationFile', () => {
      it('should import reconciliation file successfully', async () => {
        const mockResult = {
          totalRecords: 2,
          successfulImports: 2,
          failedImports: 0,
          errors: []
        };

        mockRequest.body = {
          fileContent: 'bank_reference,amount,transaction_date\nREF001,25000,2024-01-09\nREF002,30000,2024-01-09',
          fileFormat: 'csv',
          importedBy: 'finance-user-123'
        };

        mockFinanceService.importReconciliationFile.mockResolvedValue(mockResult);

        await financeController.importReconciliationFile(mockRequest as Request, mockResponse as Response);

        expect(mockFinanceService.importReconciliationFile).toHaveBeenCalledWith(
          mockRequest.body.fileContent,
          'csv',
          'finance-user-123'
        );
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
          message: 'Import completed: 2 successful, 0 failed'
        });
      });

      it('should return 400 if required fields are missing', async () => {
        mockRequest.body = {
          fileContent: 'some content'
          // Missing importedBy
        };

        await financeController.importReconciliationFile(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'fileContent and importedBy are required'
        });
      });

      it('should return 400 for invalid file format', async () => {
        mockRequest.body = {
          fileContent: 'some content',
          fileFormat: 'invalid',
          importedBy: 'finance-user-123'
        };

        await financeController.importReconciliationFile(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'fileFormat must be csv, excel, or txt'
        });
      });
    });

    describe('performAutomaticMatching', () => {
      it('should perform automatic matching successfully', async () => {
        const mockResult = {
          matchedCount: 5,
          unmatchedCount: 2,
          partialMatches: 1
        };

        mockFinanceService.performAutomaticMatching.mockResolvedValue(mockResult);

        await financeController.performAutomaticMatching(mockRequest as Request, mockResponse as Response);

        expect(mockFinanceService.performAutomaticMatching).toHaveBeenCalled();
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
          message: 'Matching completed: 5 matched, 2 unmatched, 1 partial'
        });
      });

      it('should handle matching errors', async () => {
        mockFinanceService.performAutomaticMatching.mockRejectedValue(new Error('Matching failed'));

        await financeController.performAutomaticMatching(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Matching failed'
        });
      });
    });

    describe('getReconciliationStatus', () => {
      it('should return reconciliation status with filters', async () => {
        const mockResult = {
          reconciliations: [
            {
              reconciliationId: 'recon-1',
              amount: 25000,
              transactionDate: new Date(),
              reconciliationStatus: 'matched' as const,
              matchConfidence: 1.0,
              createdAt: new Date()
            }
          ],
          summary: {
            total: 1,
            matched: 1,
            unmatched: 0,
            partial: 0,
            disputed: 0
          }
        };

        mockRequest.query = {
          batchId: 'batch-123',
          status: 'matched'
        };

        mockFinanceService.getReconciliationStatus.mockResolvedValue(mockResult);

        await financeController.getReconciliationStatus(mockRequest as Request, mockResponse as Response);

        expect(mockFinanceService.getReconciliationStatus).toHaveBeenCalledWith({
          batchId: 'batch-123',
          status: 'matched'
        });
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });
    });

    describe('handlePaymentFailure', () => {
      it('should handle payment failure successfully', async () => {
        const mockResult = {
          updated: true,
          nextAction: 'retry' as const,
          retryScheduled: new Date()
        };

        mockRequest.params = { queueId: 'queue-123' };
        mockRequest.body = {
          failureReason: 'SAP system unavailable',
          retryable: true
        };

        mockFinanceService.handlePaymentFailure.mockResolvedValue(mockResult);

        await financeController.handlePaymentFailure(mockRequest as Request, mockResponse as Response);

        expect(mockFinanceService.handlePaymentFailure).toHaveBeenCalledWith(
          'queue-123',
          'SAP system unavailable',
          true
        );
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
          message: 'Payment failure handled. Next action: retry'
        });
      });

      it('should return 400 if failureReason is missing', async () => {
        mockRequest.params = { queueId: 'queue-123' };
        mockRequest.body = {};

        await financeController.handlePaymentFailure(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'failureReason is required'
        });
      });
    });

    describe('retryFailedPayments', () => {
      it('should retry failed payments successfully', async () => {
        const mockResult = {
          retriedCount: 3,
          successCount: 2,
          failedCount: 1,
          errors: ['queue-3: Connection timeout']
        };

        mockRequest.body = {
          queueIds: ['queue-1', 'queue-2', 'queue-3'],
          processedBy: 'finance-user-123'
        };

        mockFinanceService.retryFailedPayments.mockResolvedValue(mockResult);

        await financeController.retryFailedPayments(mockRequest as Request, mockResponse as Response);

        expect(mockFinanceService.retryFailedPayments).toHaveBeenCalledWith(
          ['queue-1', 'queue-2', 'queue-3'],
          'finance-user-123'
        );
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
          message: 'Retry completed: 2 successful, 1 failed'
        });
      });

      it('should return 400 if processedBy is missing', async () => {
        mockRequest.body = {
          queueIds: ['queue-1']
        };

        await financeController.retryFailedPayments(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'processedBy is required'
        });
      });
    });
  });
});