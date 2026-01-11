import { FinanceService } from '../finance.service';

describe('Payment Reconciliation Integration', () => {
  let financeService: FinanceService;

  beforeEach(() => {
    financeService = new FinanceService();
  });

  describe('CSV File Processing', () => {
    it('should parse CSV reconciliation file correctly', async () => {
      const csvContent = `bank_reference,transaction_id,amount,transaction_date
REF001,TXN001,25000.50,2024-01-09
REF002,TXN002,30000.00,2024-01-10
REF003,TXN003,15000.75,2024-01-11`;

      // Test the private parseReconciliationFile method
      const parseMethod = (financeService as any).parseReconciliationFile.bind(financeService);
      const records = await parseMethod(csvContent, 'csv');

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({
        rowNumber: 2,
        bankReference: 'REF001',
        transactionId: 'TXN001',
        amount: 25000.50,
        transactionDate: new Date('2024-01-09')
      });
      expect(records[1]).toEqual({
        rowNumber: 3,
        bankReference: 'REF002',
        transactionId: 'TXN002',
        amount: 30000.00,
        transactionDate: new Date('2024-01-10')
      });
      expect(records[2]).toEqual({
        rowNumber: 4,
        bankReference: 'REF003',
        transactionId: 'TXN003',
        amount: 15000.75,
        transactionDate: new Date('2024-01-11')
      });
    });

    it('should handle CSV with additional columns', async () => {
      const csvContent = `bank_reference,transaction_id,amount,transaction_date,status,notes
REF001,TXN001,25000,2024-01-09,SUCCESS,Payment processed
REF002,TXN002,30000,2024-01-10,FAILED,Insufficient funds`;

      const parseMethod = (financeService as any).parseReconciliationFile.bind(financeService);
      const records = await parseMethod(csvContent, 'csv');

      expect(records).toHaveLength(2);
      expect(records[0].additionalData).toEqual({
        status: 'SUCCESS',
        notes: 'Payment processed'
      });
      expect(records[1].additionalData).toEqual({
        status: 'FAILED',
        notes: 'Insufficient funds'
      });
    });
  });

  describe('Record Validation', () => {
    it('should validate valid reconciliation record', async () => {
      const record = {
        rowNumber: 1,
        bankReference: 'REF001',
        transactionId: 'TXN001',
        amount: 25000,
        transactionDate: new Date('2024-01-09')
      };

      const validateMethod = (financeService as any).validateReconciliationRecord.bind(financeService);
      const result = await validateMethod(record);

      expect(result).toEqual({
        bankReference: 'REF001',
        transactionId: 'TXN001',
        amount: 25000,
        transactionDate: new Date('2024-01-09'),
        reconciliationStatus: 'pending',
        matchConfidence: 0
      });
    });

    it('should reject record with invalid amount', async () => {
      const record = {
        rowNumber: 1,
        amount: NaN,
        transactionDate: new Date('2024-01-09')
      };

      const validateMethod = (financeService as any).validateReconciliationRecord.bind(financeService);
      
      await expect(validateMethod(record)).rejects.toThrow('Invalid amount');
    });

    it('should reject record with invalid date', async () => {
      const record = {
        rowNumber: 1,
        amount: 25000,
        transactionDate: new Date('invalid-date')
      };

      const validateMethod = (financeService as any).validateReconciliationRecord.bind(financeService);
      
      await expect(validateMethod(record)).rejects.toThrow('Invalid transaction date');
    });
  });

  describe('Matching Logic', () => {
    it('should identify exact matches', async () => {
      const reconciliation = {
        reconciliationId: 'recon-1',
        amount: 25000,
        transactionDate: new Date('2024-01-09'),
        reconciliationStatus: 'pending' as const,
        matchConfidence: 0,
        createdAt: new Date()
      };

      const queueEntries = [
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
          queueStatus: 'processed' as const,
          validationStatus: 'valid' as const,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          processedAt: new Date('2024-01-09T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock the repository method
      const mockGetPaymentQueueEntries = jest.spyOn((financeService as any).financeRepository, 'getPaymentQueueEntries');
      mockGetPaymentQueueEntries.mockResolvedValue(queueEntries);

      const matchMethod = (financeService as any).matchReconciliationRecord.bind(financeService);
      const result = await matchMethod(reconciliation);

      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBe(1.0);
      expect(result.queueId).toBe('queue-1');
      expect(result.reason).toBe('Exact match on amount and date');

      mockGetPaymentQueueEntries.mockRestore();
    });

    it('should identify partial matches', async () => {
      const reconciliation = {
        reconciliationId: 'recon-1',
        amount: 25000,
        transactionDate: new Date('2024-01-11'), // Different date
        reconciliationStatus: 'pending' as const,
        matchConfidence: 0,
        createdAt: new Date()
      };

      const queueEntries = [
        {
          queueId: 'queue-1',
          applicationId: 'app-1',
          userId: 'user-1',
          schemeId: 'scheme-1',
          approvedAmount: 25000, // Same amount
          beneficiaryName: 'John Doe',
          bankAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          queueStatus: 'processed' as const,
          validationStatus: 'valid' as const,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          processedAt: new Date('2024-01-09T10:00:00Z'), // Different date
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockGetPaymentQueueEntries = jest.spyOn((financeService as any).financeRepository, 'getPaymentQueueEntries');
      mockGetPaymentQueueEntries.mockResolvedValue(queueEntries);

      const matchMethod = (financeService as any).matchReconciliationRecord.bind(financeService);
      const result = await matchMethod(reconciliation);

      expect(result.matchType).toBe('partial');
      expect(result.confidence).toBe(0.7);
      expect(result.queueId).toBe('queue-1');
      expect(result.reason).toBe('Amount match but date mismatch');

      mockGetPaymentQueueEntries.mockRestore();
    });

    it('should identify no matches', async () => {
      const reconciliation = {
        reconciliationId: 'recon-1',
        amount: 99999, // No matching amount
        transactionDate: new Date('2024-01-09'),
        reconciliationStatus: 'pending' as const,
        matchConfidence: 0,
        createdAt: new Date()
      };

      const queueEntries = [
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
          queueStatus: 'processed' as const,
          validationStatus: 'valid' as const,
          validationDetails: {},
          priorityLevel: 2,
          retryCount: 0,
          processedAt: new Date('2024-01-09T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockGetPaymentQueueEntries = jest.spyOn((financeService as any).financeRepository, 'getPaymentQueueEntries');
      mockGetPaymentQueueEntries.mockResolvedValue(queueEntries);

      const matchMethod = (financeService as any).matchReconciliationRecord.bind(financeService);
      const result = await matchMethod(reconciliation);

      expect(result.matchType).toBe('none');
      expect(result.confidence).toBe(0);
      expect(result.queueId).toBeUndefined();
      expect(result.reason).toBe('No matching payment found');

      mockGetPaymentQueueEntries.mockRestore();
    });
  });

  describe('Retry Logic', () => {
    it('should calculate correct retry schedule with exponential backoff', async () => {
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
        queueStatus: 'failed' as const,
        validationStatus: 'valid' as const,
        validationDetails: {},
        priorityLevel: 2,
        retryCount: 1, // First retry
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockGetPaymentQueueEntryById = jest.spyOn((financeService as any).financeRepository, 'getPaymentQueueEntryById');
      const mockUpdatePaymentQueueEntry = jest.spyOn((financeService as any).financeRepository, 'updatePaymentQueueEntry');
      const mockCreatePaymentReconciliation = jest.spyOn((financeService as any).financeRepository, 'createPaymentReconciliation');

      mockGetPaymentQueueEntryById.mockResolvedValue(mockQueueEntry);
      mockUpdatePaymentQueueEntry.mockResolvedValue({ ...mockQueueEntry, retryCount: 2 });
      mockCreatePaymentReconciliation.mockResolvedValue({
        reconciliationId: 'recon-123',
        queueId: 'queue-123',
        amount: 25000,
        transactionDate: new Date(),
        reconciliationStatus: 'disputed',
        matchConfidence: 0,
        createdAt: new Date()
      });

      const result = await financeService.handlePaymentFailure('queue-123', 'Test failure', true);

      expect(result.nextAction).toBe('retry');
      expect(result.retryScheduled).toBeDefined();
      
      // Check that retry is scheduled for 4 hours from now (2^2 = 4 hours for retry count 2)
      const expectedRetryTime = new Date();
      expectedRetryTime.setHours(expectedRetryTime.getHours() + 4);
      
      const actualRetryTime = result.retryScheduled!;
      const timeDifference = Math.abs(actualRetryTime.getTime() - expectedRetryTime.getTime());
      
      // Allow 1 minute tolerance for test execution time
      expect(timeDifference).toBeLessThan(60000);

      mockGetPaymentQueueEntryById.mockRestore();
      mockUpdatePaymentQueueEntry.mockRestore();
      mockCreatePaymentReconciliation.mockRestore();
    });
  });
});