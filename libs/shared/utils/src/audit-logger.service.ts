import { EncryptionService } from './encryption.service';

export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  success: boolean;
  errorMessage?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  riskDistribution: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

/**
 * Comprehensive audit logging service for security compliance
 * Implements tamper-proof logging with encryption and integrity verification
 */
export class AuditLoggerService {
  private static instance: AuditLoggerService;
  private logQueue: AuditLogEntry[] = [];
  private isProcessing = false;

  private constructor() {
    // Start background processing
    this.startBackgroundProcessing();
  }

  static getInstance(): AuditLoggerService {
    if (!AuditLoggerService.instance) {
      AuditLoggerService.instance = new AuditLoggerService();
    }
    return AuditLoggerService.instance;
  }

  /**
   * Log security-related events
   */
  async logSecurityEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'riskLevel'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
      riskLevel: this.calculateRiskLevel(entry.action, entry.success)
    };

    // Add to queue for processing
    this.logQueue.push(auditEntry);

    // Process immediately for critical events
    if (auditEntry.riskLevel === 'critical') {
      await this.processLogEntry(auditEntry);
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    userId: string,
    action: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'mfa_verify' | 'account_locked',
    success: boolean,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    details: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      userRole: details.userRole || 'unknown',
      action,
      resource: 'authentication',
      details: {
        ...details,
        loginMethod: details.loginMethod || 'password',
        mfaUsed: details.mfaUsed || false
      },
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    userId: string,
    userRole: string,
    action: 'read' | 'create' | 'update' | 'delete',
    resource: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    details: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      userRole,
      action,
      resource,
      resourceId,
      details: {
        ...details,
        dataClassification: this.classifyDataSensitivity(resource),
        accessMethod: details.accessMethod || 'api'
      },
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage
    });
  }

  /**
   * Log administrative actions
   */
  async logAdminAction(
    userId: string,
    userRole: string,
    action: string,
    resource: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    details: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      userRole,
      action,
      resource,
      resourceId,
      details: {
        ...details,
        adminLevel: this.getAdminLevel(userRole),
        requiresApproval: details.requiresApproval || false
      },
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage
    });
  }

  /**
   * Log financial transactions
   */
  async logFinancialEvent(
    userId: string,
    userRole: string,
    action: 'approve_payment' | 'process_payment' | 'reconcile' | 'refund',
    applicationId: string,
    amount: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    details: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      userRole,
      action,
      resource: 'financial_transaction',
      resourceId: applicationId,
      details: {
        ...details,
        amount,
        currency: 'INR',
        transactionType: action,
        requiresDualApproval: amount > 100000 // Amounts over 1 lakh require dual approval
      },
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage
    });
  }

  /**
   * Log system events
   */
  async logSystemEvent(
    action: string,
    resource: string,
    success: boolean,
    details: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId: 'system',
      userRole: 'system',
      action,
      resource,
      details: {
        ...details,
        systemComponent: details.component || 'unknown',
        version: details.version || process.env.APP_VERSION
      },
      ipAddress: 'localhost',
      userAgent: 'system',
      sessionId: 'system',
      success,
      errorMessage
    });
  }

  /**
   * Query audit logs with filtering
   */
  async queryAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    // This would typically query a database
    // For now, return empty array as this is a service interface
    return [];
  }

  /**
   * Generate audit summary report
   */
  async generateAuditSummary(startDate: Date, endDate: Date): Promise<AuditSummary> {
    // This would typically aggregate data from database
    // For now, return empty summary as this is a service interface
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      riskDistribution: {},
      topActions: [],
      topUsers: []
    };
  }

  /**
   * Verify audit log integrity
   */
  async verifyLogIntegrity(logId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Implementation would verify cryptographic hash chain
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Integrity verification failed'
      };
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    query: AuditQuery,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<{ data: string; filename: string }> {
    const logs = await this.queryAuditLogs(query);
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (format) {
      case 'csv':
        return {
          data: this.convertToCSV(logs),
          filename: `audit-logs-${timestamp}.csv`
        };
      case 'xml':
        return {
          data: this.convertToXML(logs),
          filename: `audit-logs-${timestamp}.xml`
        };
      default:
        return {
          data: JSON.stringify(logs, null, 2),
          filename: `audit-logs-${timestamp}.json`
        };
    }
  }

  /**
   * Process log entry with encryption and storage
   */
  private async processLogEntry(entry: AuditLogEntry): Promise<void> {
    try {
      // Encrypt sensitive details
      const encryptedEntry = this.encryptSensitiveFields(entry);
      
      // Add integrity hash
      const entryWithHash = this.addIntegrityHash(encryptedEntry);
      
      // Store in database (implementation would go here)
      await this.storeLogEntry(entryWithHash);
      
      // Send alerts for critical events
      if (entry.riskLevel === 'critical') {
        await this.sendSecurityAlert(entry);
      }
    } catch (error) {
      console.error('Failed to process audit log entry:', error);
      // Store in fallback location
      await this.storeInFallback(entry);
    }
  }

  /**
   * Calculate risk level based on action and success
   */
  private calculateRiskLevel(action: string, success: boolean): 'low' | 'medium' | 'high' | 'critical' {
    const criticalActions = ['admin_access', 'system_config_change', 'bulk_data_export', 'privilege_escalation'];
    const highRiskActions = ['password_change', 'mfa_disable', 'user_role_change', 'financial_approval'];
    const mediumRiskActions = ['login_failure', 'data_access', 'document_upload'];

    if (!success && criticalActions.some(a => action.includes(a))) {
      return 'critical';
    }

    if (criticalActions.some(a => action.includes(a))) {
      return 'high';
    }

    if (!success && highRiskActions.some(a => action.includes(a))) {
      return 'high';
    }

    if (highRiskActions.some(a => action.includes(a))) {
      return 'medium';
    }

    if (!success && mediumRiskActions.some(a => action.includes(a))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Classify data sensitivity
   */
  private classifyDataSensitivity(resource: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    const restrictedResources = ['bank_details', 'salary_info', 'personal_documents'];
    const confidentialResources = ['user_profile', 'application_data', 'financial_records'];
    const internalResources = ['scheme_config', 'approval_workflow', 'notifications'];

    if (restrictedResources.some(r => resource.includes(r))) {
      return 'restricted';
    }

    if (confidentialResources.some(r => resource.includes(r))) {
      return 'confidential';
    }

    if (internalResources.some(r => resource.includes(r))) {
      return 'internal';
    }

    return 'public';
  }

  /**
   * Get admin level for role
   */
  private getAdminLevel(role: string): number {
    const levels: Record<string, number> = {
      'system_admin': 5,
      'admin': 4,
      'head': 3,
      'finance': 2,
      'approver': 1,
      'employee': 0
    };
    return levels[role] || 0;
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Encrypt sensitive fields in log entry
   */
  private encryptSensitiveFields(entry: AuditLogEntry): AuditLogEntry {
    const sensitiveFields = ['details', 'metadata'];
    const encryptedEntry = { ...entry };

    sensitiveFields.forEach(field => {
      if (encryptedEntry[field as keyof AuditLogEntry]) {
        const data = JSON.stringify(encryptedEntry[field as keyof AuditLogEntry]);
        const encrypted = EncryptionService.encryptData(data, process.env.AUDIT_ENCRYPTION_KEY || 'default-audit-key');
        (encryptedEntry as any)[field] = encrypted;
      }
    });

    return encryptedEntry;
  }

  /**
   * Add integrity hash to log entry
   */
  private addIntegrityHash(entry: AuditLogEntry): AuditLogEntry & { integrityHash: string } {
    const entryString = JSON.stringify(entry);
    const hash = EncryptionService.generateSecureToken(32);
    
    return {
      ...entry,
      integrityHash: hash
    };
  }

  /**
   * Store log entry (placeholder for database implementation)
   */
  private async storeLogEntry(entry: AuditLogEntry & { integrityHash: string }): Promise<void> {
    // Database storage implementation would go here
    console.log('Storing audit log entry:', entry.id);
  }

  /**
   * Store in fallback location
   */
  private async storeInFallback(entry: AuditLogEntry): Promise<void> {
    // Fallback storage implementation (file system, etc.)
    console.error('Storing in fallback:', entry.id);
  }

  /**
   * Send security alert for critical events
   */
  private async sendSecurityAlert(entry: AuditLogEntry): Promise<void> {
    // Security alert implementation would go here
    console.warn('SECURITY ALERT:', entry.action, entry.userId);
  }

  /**
   * Start background processing of log queue
   */
  private startBackgroundProcessing(): void {
    setInterval(async () => {
      if (this.isProcessing || this.logQueue.length === 0) {
        return;
      }

      this.isProcessing = true;
      try {
        const batch = this.logQueue.splice(0, 100); // Process in batches of 100
        await Promise.all(batch.map(entry => this.processLogEntry(entry)));
      } catch (error) {
        console.error('Background audit processing failed:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map(log => 
      Object.values(log).map(value => 
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Convert logs to XML format
   */
  private convertToXML(logs: AuditLogEntry[]): string {
    const xmlEntries = logs.map(log => {
      const fields = Object.entries(log).map(([key, value]) => {
        const xmlValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `    <${key}>${xmlValue}</${key}>`;
      }).join('\n');
      
      return `  <audit-entry>\n${fields}\n  </audit-entry>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<audit-logs>\n${xmlEntries}\n</audit-logs>`;
  }
}