import pool from '../database/connection';
import {
  PaymentQueueEntry,
  PaymentBatch,
  BankValidationCache,
  DuplicateDetection,
  PaymentReconciliation,
  PaymentQueueFilters,
  BatchFilters,
  FinanceDashboardSummary
} from '../models/finance.model';

export class FinanceRepository {
  // Payment Queue Operations
  async addToPaymentQueue(entry: Omit<PaymentQueueEntry, 'queueId' | 'createdAt' | 'updatedAt'>): Promise<PaymentQueueEntry> {
    const query = `
      INSERT INTO finance.payment_queue (
        application_id, user_id, scheme_id, approved_amount, beneficiary_name,
        bank_account_number, ifsc_code, bank_name, branch_name, queue_status,
        validation_status, validation_details, batch_id, priority_level,
        scheduled_date, processed_by, processed_at, failure_reason, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      entry.applicationId,
      entry.userId,
      entry.schemeId,
      entry.approvedAmount,
      entry.beneficiaryName,
      entry.bankAccountNumber,
      entry.ifscCode,
      entry.bankName,
      entry.branchName,
      entry.queueStatus,
      entry.validationStatus,
      JSON.stringify(entry.validationDetails),
      entry.batchId,
      entry.priorityLevel,
      entry.scheduledDate,
      entry.processedBy,
      entry.processedAt,
      entry.failureReason,
      entry.retryCount
    ];

    const result = await pool.query(query, values);
    return this.mapPaymentQueueRow(result.rows[0]);
  }

  async getPaymentQueueEntries(filters: PaymentQueueFilters = {}, limit = 100, offset = 0): Promise<PaymentQueueEntry[]> {
    let query = `
      SELECT pq.*, a.application_data, u.name as user_name, s.name as scheme_name
      FROM finance.payment_queue pq
      LEFT JOIN applications.applications a ON pq.application_id = a.application_id
      LEFT JOIN users.users u ON pq.user_id = u.user_id
      LEFT JOIN schemes.schemes s ON pq.scheme_id = s.scheme_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramCount = 0;

    if (filters.status) {
      query += ` AND pq.queue_status = $${++paramCount}`;
      values.push(filters.status);
    }

    if (filters.validationStatus) {
      query += ` AND pq.validation_status = $${++paramCount}`;
      values.push(filters.validationStatus);
    }

    if (filters.batchId) {
      query += ` AND pq.batch_id = $${++paramCount}`;
      values.push(filters.batchId);
    }

    if (filters.dateFrom) {
      query += ` AND pq.created_at >= $${++paramCount}`;
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND pq.created_at <= $${++paramCount}`;
      values.push(filters.dateTo);
    }

    if (filters.amountMin) {
      query += ` AND pq.approved_amount >= $${++paramCount}`;
      values.push(filters.amountMin);
    }

    if (filters.amountMax) {
      query += ` AND pq.approved_amount <= $${++paramCount}`;
      values.push(filters.amountMax);
    }

    if (filters.priorityLevel) {
      query += ` AND pq.priority_level = $${++paramCount}`;
      values.push(filters.priorityLevel);
    }

    if (filters.schemeId) {
      query += ` AND pq.scheme_id = $${++paramCount}`;
      values.push(filters.schemeId);
    }

    query += ` ORDER BY pq.priority_level DESC, pq.created_at ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(this.mapPaymentQueueRow);
  }

  async updatePaymentQueueEntry(queueId: string, updates: Partial<PaymentQueueEntry>): Promise<PaymentQueueEntry | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'queueId' && key !== 'createdAt') {
        const dbColumn = this.camelToSnakeCase(key);
        if (key === 'validationDetails') {
          setClause.push(`${dbColumn} = $${++paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${dbColumn} = $${++paramCount}`);
          values.push(value);
        }
      }
    });

    if (setClause.length === 0) {
      return null;
    }

    const query = `
      UPDATE finance.payment_queue 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE queue_id = $${++paramCount}
      RETURNING *
    `;
    values.push(queueId);

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this.mapPaymentQueueRow(result.rows[0]) : null;
  }

  async getPaymentQueueEntryById(queueId: string): Promise<PaymentQueueEntry | null> {
    const query = `
      SELECT pq.*, a.application_data, u.name as user_name, s.name as scheme_name
      FROM finance.payment_queue pq
      LEFT JOIN applications.applications a ON pq.application_id = a.application_id
      LEFT JOIN users.users u ON pq.user_id = u.user_id
      LEFT JOIN schemes.schemes s ON pq.scheme_id = s.scheme_id
      WHERE pq.queue_id = $1
    `;

    const result = await pool.query(query, [queueId]);
    return result.rows.length > 0 ? this.mapPaymentQueueRow(result.rows[0]) : null;
  }

  // Payment Batch Operations
  async createPaymentBatch(batch: Omit<PaymentBatch, 'batchId' | 'createdAt' | 'updatedAt'>): Promise<PaymentBatch> {
    const query = `
      INSERT INTO finance.payment_batches (
        batch_name, batch_type, total_amount, total_count, batch_status,
        created_by, approved_by, processed_by, scheduled_date, processed_at,
        sap_reference, reconciliation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      batch.batchName,
      batch.batchType,
      batch.totalAmount,
      batch.totalCount,
      batch.batchStatus,
      batch.createdBy,
      batch.approvedBy,
      batch.processedBy,
      batch.scheduledDate,
      batch.processedAt,
      batch.sapReference,
      batch.reconciliationStatus
    ];

    const result = await pool.query(query, values);
    return this.mapPaymentBatchRow(result.rows[0]);
  }

  async getPaymentBatches(filters: BatchFilters = {}, limit = 50, offset = 0): Promise<PaymentBatch[]> {
    let query = `
      SELECT pb.*, u.name as created_by_name
      FROM finance.payment_batches pb
      LEFT JOIN users.users u ON pb.created_by = u.user_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramCount = 0;

    if (filters.status) {
      query += ` AND pb.batch_status = $${++paramCount}`;
      values.push(filters.status);
    }

    if (filters.batchType) {
      query += ` AND pb.batch_type = $${++paramCount}`;
      values.push(filters.batchType);
    }

    if (filters.createdBy) {
      query += ` AND pb.created_by = $${++paramCount}`;
      values.push(filters.createdBy);
    }

    if (filters.dateFrom) {
      query += ` AND pb.created_at >= $${++paramCount}`;
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND pb.created_at <= $${++paramCount}`;
      values.push(filters.dateTo);
    }

    query += ` ORDER BY pb.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(this.mapPaymentBatchRow);
  }

  async updatePaymentBatch(batchId: string, updates: Partial<PaymentBatch>): Promise<PaymentBatch | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'batchId' && key !== 'createdAt') {
        const dbColumn = this.camelToSnakeCase(key);
        setClause.push(`${dbColumn} = $${++paramCount}`);
        values.push(value);
      }
    });

    if (setClause.length === 0) {
      return null;
    }

    const query = `
      UPDATE finance.payment_batches 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE batch_id = $${++paramCount}
      RETURNING *
    `;
    values.push(batchId);

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this.mapPaymentBatchRow(result.rows[0]) : null;
  }

  // Bank Validation Cache Operations
  async getBankValidationCache(accountNumber: string, ifscCode: string): Promise<BankValidationCache | null> {
    const query = `
      SELECT * FROM finance.bank_validation_cache 
      WHERE account_number = $1 AND ifsc_code = $2 AND expires_at > NOW()
    `;

    const result = await pool.query(query, [accountNumber, ifscCode]);
    return result.rows.length > 0 ? this.mapBankValidationCacheRow(result.rows[0]) : null;
  }

  async setBankValidationCache(cache: Omit<BankValidationCache, 'cacheId' | 'validationDate'>): Promise<BankValidationCache> {
    const query = `
      INSERT INTO finance.bank_validation_cache (
        account_number, ifsc_code, validation_result, is_valid, bank_name, branch_name, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (account_number, ifsc_code) 
      DO UPDATE SET 
        validation_result = EXCLUDED.validation_result,
        is_valid = EXCLUDED.is_valid,
        bank_name = EXCLUDED.bank_name,
        branch_name = EXCLUDED.branch_name,
        validation_date = NOW(),
        expires_at = EXCLUDED.expires_at
      RETURNING *
    `;

    const values = [
      cache.accountNumber,
      cache.ifscCode,
      JSON.stringify(cache.validationResult),
      cache.isValid,
      cache.bankName,
      cache.branchName,
      cache.expiresAt
    ];

    const result = await pool.query(query, values);
    return this.mapBankValidationCacheRow(result.rows[0]);
  }

  // Duplicate Detection Operations
  async createDuplicateDetection(detection: Omit<DuplicateDetection, 'detectionId' | 'createdAt'>): Promise<DuplicateDetection> {
    const query = `
      INSERT INTO finance.duplicate_detection (
        account_number, ifsc_code, beneficiary_name, user_id, application_ids,
        detection_type, confidence_score, status, reviewed_by, reviewed_at, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      detection.accountNumber,
      detection.ifscCode,
      detection.beneficiaryName,
      detection.userId,
      detection.applicationIds,
      detection.detectionType,
      detection.confidenceScore,
      detection.status,
      detection.reviewedBy,
      detection.reviewedAt,
      detection.notes
    ];

    const result = await pool.query(query, values);
    return this.mapDuplicateDetectionRow(result.rows[0]);
  }

  async findDuplicates(accountNumber: string, ifscCode: string, beneficiaryName: string): Promise<DuplicateDetection[]> {
    const query = `
      SELECT * FROM finance.duplicate_detection 
      WHERE (account_number = $1 AND ifsc_code = $2) 
         OR (account_number = $1 AND SIMILARITY(beneficiary_name, $3) > 0.8)
      ORDER BY confidence_score DESC
    `;

    const result = await pool.query(query, [accountNumber, ifscCode, beneficiaryName]);
    return result.rows.map(this.mapDuplicateDetectionRow);
  }

  // Dashboard Summary
  async getFinanceDashboardSummary(): Promise<FinanceDashboardSummary> {
    const query = `
      SELECT 
        COUNT(CASE WHEN queue_status = 'pending' THEN 1 END) as pending_approvals,
        COUNT(CASE WHEN validation_status = 'pending' THEN 1 END) as pending_validation,
        COUNT(CASE WHEN queue_status = 'validated' THEN 1 END) as ready_for_processing,
        COUNT(CASE WHEN queue_status = 'processed' AND DATE(processed_at) = CURRENT_DATE THEN 1 END) as processing_today,
        COALESCE(SUM(CASE WHEN queue_status IN ('pending', 'validated') THEN approved_amount END), 0) as total_amount_pending,
        COUNT(CASE WHEN validation_status = 'duplicate' THEN 1 END) as duplicates_detected,
        COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as failed_payments,
        (SELECT COUNT(*) FROM finance.payment_reconciliation WHERE reconciliation_status = 'pending') as reconciliation_pending
      FROM finance.payment_queue
    `;

    const result = await pool.query(query);
    const row = result.rows[0];

    return {
      pendingApprovals: parseInt(row.pending_approvals) || 0,
      pendingValidation: parseInt(row.pending_validation) || 0,
      readyForProcessing: parseInt(row.ready_for_processing) || 0,
      processingToday: parseInt(row.processing_today) || 0,
      totalAmountPending: parseFloat(row.total_amount_pending) || 0,
      duplicatesDetected: parseInt(row.duplicates_detected) || 0,
      failedPayments: parseInt(row.failed_payments) || 0,
      reconciliationPending: parseInt(row.reconciliation_pending) || 0
    };
  }

  // Payment Reconciliation Operations
  async createPaymentReconciliation(reconciliation: Omit<PaymentReconciliation, 'reconciliationId' | 'createdAt'>): Promise<PaymentReconciliation> {
    const query = `
      INSERT INTO finance.payment_reconciliation (
        batch_id, queue_id, bank_reference, transaction_id, amount, transaction_date,
        reconciliation_status, match_confidence, reconciled_by, reconciled_at, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      reconciliation.batchId,
      reconciliation.queueId,
      reconciliation.bankReference,
      reconciliation.transactionId,
      reconciliation.amount,
      reconciliation.transactionDate,
      reconciliation.reconciliationStatus,
      reconciliation.matchConfidence,
      reconciliation.reconciledBy,
      reconciliation.reconciledAt,
      reconciliation.notes
    ];

    const result = await pool.query(query, values);
    return this.mapPaymentReconciliationRow(result.rows[0]);
  }

  async getPaymentReconciliations(filters: {
    batchId?: string;
    queueId?: string;
    status?: PaymentReconciliation['reconciliationStatus'];
    dateFrom?: Date;
    dateTo?: Date;
  } = {}, limit = 100, offset = 0): Promise<PaymentReconciliation[]> {
    let query = `
      SELECT pr.*, pb.batch_name, pq.beneficiary_name, pq.bank_account_number
      FROM finance.payment_reconciliation pr
      LEFT JOIN finance.payment_batches pb ON pr.batch_id = pb.batch_id
      LEFT JOIN finance.payment_queue pq ON pr.queue_id = pq.queue_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramCount = 0;

    if (filters.batchId) {
      query += ` AND pr.batch_id = $${++paramCount}`;
      values.push(filters.batchId);
    }

    if (filters.queueId) {
      query += ` AND pr.queue_id = $${++paramCount}`;
      values.push(filters.queueId);
    }

    if (filters.status) {
      query += ` AND pr.reconciliation_status = $${++paramCount}`;
      values.push(filters.status);
    }

    if (filters.dateFrom) {
      query += ` AND pr.transaction_date >= $${++paramCount}`;
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND pr.transaction_date <= $${++paramCount}`;
      values.push(filters.dateTo);
    }

    query += ` ORDER BY pr.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(this.mapPaymentReconciliationRow);
  }

  async updatePaymentReconciliation(reconciliationId: string, updates: Partial<PaymentReconciliation>): Promise<PaymentReconciliation | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'reconciliationId' && key !== 'createdAt') {
        const dbColumn = this.camelToSnakeCase(key);
        setClause.push(`${dbColumn} = $${++paramCount}`);
        values.push(value);
      }
    });

    if (setClause.length === 0) {
      return null;
    }

    const query = `
      UPDATE finance.payment_reconciliation 
      SET ${setClause.join(', ')}
      WHERE reconciliation_id = $${++paramCount}
      RETURNING *
    `;
    values.push(reconciliationId);

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this.mapPaymentReconciliationRow(result.rows[0]) : null;
  }

  async getPaymentReconciliationById(reconciliationId: string): Promise<PaymentReconciliation | null> {
    const query = `
      SELECT pr.*, pb.batch_name, pq.beneficiary_name, pq.bank_account_number
      FROM finance.payment_reconciliation pr
      LEFT JOIN finance.payment_batches pb ON pr.batch_id = pb.batch_id
      LEFT JOIN finance.payment_queue pq ON pr.queue_id = pq.queue_id
      WHERE pr.reconciliation_id = $1
    `;

    const result = await pool.query(query, [reconciliationId]);
    return result.rows.length > 0 ? this.mapPaymentReconciliationRow(result.rows[0]) : null;
  }

  // Helper methods for mapping database rows to models
  private mapPaymentQueueRow(row: any): PaymentQueueEntry {
    return {
      queueId: row.queue_id,
      applicationId: row.application_id,
      userId: row.user_id,
      schemeId: row.scheme_id,
      approvedAmount: parseFloat(row.approved_amount),
      beneficiaryName: row.beneficiary_name,
      bankAccountNumber: row.bank_account_number,
      ifscCode: row.ifsc_code,
      bankName: row.bank_name,
      branchName: row.branch_name,
      queueStatus: row.queue_status,
      validationStatus: row.validation_status,
      validationDetails: row.validation_details || {},
      batchId: row.batch_id,
      priorityLevel: row.priority_level,
      scheduledDate: row.scheduled_date,
      processedBy: row.processed_by,
      processedAt: row.processed_at,
      failureReason: row.failure_reason,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapPaymentBatchRow(row: any): PaymentBatch {
    return {
      batchId: row.batch_id,
      batchName: row.batch_name,
      batchType: row.batch_type,
      totalAmount: parseFloat(row.total_amount),
      totalCount: row.total_count,
      batchStatus: row.batch_status,
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      processedBy: row.processed_by,
      scheduledDate: row.scheduled_date,
      processedAt: row.processed_at,
      sapReference: row.sap_reference,
      reconciliationStatus: row.reconciliation_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapBankValidationCacheRow(row: any): BankValidationCache {
    return {
      cacheId: row.cache_id,
      accountNumber: row.account_number,
      ifscCode: row.ifsc_code,
      validationResult: row.validation_result,
      isValid: row.is_valid,
      bankName: row.bank_name,
      branchName: row.branch_name,
      validationDate: row.validation_date,
      expiresAt: row.expires_at
    };
  }

  private mapDuplicateDetectionRow(row: any): DuplicateDetection {
    return {
      detectionId: row.detection_id,
      accountNumber: row.account_number,
      ifscCode: row.ifsc_code,
      beneficiaryName: row.beneficiary_name,
      userId: row.user_id,
      applicationIds: row.application_ids,
      detectionType: row.detection_type,
      confidenceScore: parseFloat(row.confidence_score),
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  private mapPaymentReconciliationRow(row: any): PaymentReconciliation {
    return {
      reconciliationId: row.reconciliation_id,
      batchId: row.batch_id,
      queueId: row.queue_id,
      bankReference: row.bank_reference,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      transactionDate: row.transaction_date,
      reconciliationStatus: row.reconciliation_status,
      matchConfidence: parseFloat(row.match_confidence),
      reconciledBy: row.reconciled_by,
      reconciledAt: row.reconciled_at,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}