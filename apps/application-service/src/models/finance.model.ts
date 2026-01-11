export interface PaymentQueueEntry {
  queueId: string;
  applicationId: string;
  userId: string;
  schemeId: string;
  approvedAmount: number;
  beneficiaryName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  queueStatus: 'pending' | 'validated' | 'processed' | 'failed' | 'cancelled';
  validationStatus: 'pending' | 'valid' | 'invalid' | 'duplicate';
  validationDetails: Record<string, any>;
  batchId?: string;
  priorityLevel: number;
  scheduledDate?: Date;
  processedBy?: string;
  processedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentBatch {
  batchId: string;
  batchName: string;
  batchType: 'regular' | 'urgent' | 'manual';
  totalAmount: number;
  totalCount: number;
  batchStatus: 'draft' | 'ready' | 'processing' | 'completed' | 'failed';
  createdBy: string;
  approvedBy?: string;
  processedBy?: string;
  scheduledDate?: Date;
  processedAt?: Date;
  sapReference?: string;
  reconciliationStatus: 'pending' | 'matched' | 'unmatched' | 'partial';
  createdAt: Date;
  updatedAt: Date;
}

export interface BankValidationCache {
  cacheId: string;
  accountNumber: string;
  ifscCode: string;
  validationResult: Record<string, any>;
  isValid: boolean;
  bankName?: string;
  branchName?: string;
  validationDate: Date;
  expiresAt: Date;
}

export interface DuplicateDetection {
  detectionId: string;
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  userId: string;
  applicationIds: string[];
  detectionType: 'exact_match' | 'similar_name' | 'same_account';
  confidenceScore: number;
  status: 'flagged' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface PaymentReconciliation {
  reconciliationId: string;
  batchId?: string;
  queueId?: string;
  bankReference?: string;
  transactionId?: string;
  amount: number;
  transactionDate: Date;
  reconciliationStatus: 'pending' | 'matched' | 'unmatched' | 'partial' | 'disputed';
  matchConfidence: number;
  reconciledBy?: string;
  reconciledAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface BankValidationResult {
  isValid: boolean;
  bankName?: string;
  branchName?: string;
  accountHolderName?: string;
  error?: string;
  cached?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicates: DuplicateDetection[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BatchProcessingResult {
  batchId: string;
  processedCount: number;
  failedCount: number;
  totalAmount: number;
  sapReference?: string;
  errors: string[];
}

// Finance dashboard summary interfaces
export interface FinanceDashboardSummary {
  pendingApprovals: number;
  pendingValidation: number;
  readyForProcessing: number;
  processingToday: number;
  totalAmountPending: number;
  duplicatesDetected: number;
  failedPayments: number;
  reconciliationPending: number;
}

export interface PaymentQueueFilters {
  status?: PaymentQueueEntry['queueStatus'];
  validationStatus?: PaymentQueueEntry['validationStatus'];
  batchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  priorityLevel?: number;
  schemeId?: string;
}

export interface BatchFilters {
  status?: PaymentBatch['batchStatus'];
  batchType?: PaymentBatch['batchType'];
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Validation and processing constants
export const PAYMENT_QUEUE_STATUS = {
  PENDING: 'pending' as const,
  VALIDATED: 'validated' as const,
  PROCESSED: 'processed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const
};

export const VALIDATION_STATUS = {
  PENDING: 'pending' as const,
  VALID: 'valid' as const,
  INVALID: 'invalid' as const,
  DUPLICATE: 'duplicate' as const
};

export const BATCH_STATUS = {
  DRAFT: 'draft' as const,
  READY: 'ready' as const,
  PROCESSING: 'processing' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const
};

export const PRIORITY_LEVELS = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
} as const;