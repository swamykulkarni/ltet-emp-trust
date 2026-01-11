import { environment } from '../environments/environment';
import { PaymentQueueEntry } from '../models/finance.model';

export interface SAPPaymentRequest {
  paymentId: string;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  amount: number;
  purpose: string;
  referenceNumber: string;
  employeeId: string;
  schemeId: string;
}

export interface SAPPaymentResponse {
  success: boolean;
  transactionId?: string;
  sapReference?: string;
  error?: string;
  errorCode?: string;
}

export interface SAPBatchRequest {
  batchId: string;
  batchName: string;
  totalAmount: number;
  totalCount: number;
  payments: SAPPaymentRequest[];
  scheduledDate?: Date;
}

export interface SAPBatchResponse {
  success: boolean;
  batchReference?: string;
  processedCount: number;
  failedCount: number;
  totalAmount: number;
  errors: string[];
}

export interface SAPAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  baseUrl: string;
  scope?: string;
}

export interface SAPHealthStatus {
  connected: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export class SAPIntegrationService {
  private authConfig: SAPAuthConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private healthStatus: SAPHealthStatus;
  private retryAttempts = 3;
  private timeoutMs = 30000;

  constructor() {
    this.authConfig = {
      clientId: environment.sap.clientId || '',
      clientSecret: environment.sap.clientSecret || '',
      tokenUrl: environment.sap.tokenUrl || '',
      baseUrl: environment.sap.baseUrl || '',
      scope: environment.sap.scope || 'payment:write'
    };

    this.healthStatus = {
      connected: false,
      lastChecked: new Date()
    };

    // Initialize health monitoring
    this.initializeHealthMonitoring();
  }

  /**
   * Initialize periodic health monitoring
   */
  private initializeHealthMonitoring(): void {
    // Check SAP connectivity every 5 minutes
    setInterval(async () => {
      await this.checkHealth();
    }, 5 * 60 * 1000);

    // Initial health check
    this.checkHealth();
  }

  /**
   * Authenticate with SAP using OAuth2
   */
  private async authenticate(): Promise<boolean> {
    try {
      // Check if current token is still valid
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return true;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.authConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.authConfig.clientId}:${this.authConfig.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: this.authConfig.scope || 'payment:write'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`SAP authentication failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      
      // Set token expiry (subtract 5 minutes for safety)
      const expiresIn = tokenData.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);

      console.log('SAP authentication successful');
      return true;
    } catch (error: any) {
      console.error('SAP authentication error:', error.message);
      return false;
    }
  }

  /**
   * Process single payment through SAP
   */
  async processPayment(paymentRequest: SAPPaymentRequest): Promise<SAPPaymentResponse> {
    let attempt = 0;
    let lastError: string = '';

    while (attempt < this.retryAttempts) {
      try {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return {
            success: false,
            error: 'Failed to authenticate with SAP',
            errorCode: 'AUTH_FAILED'
          };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.authConfig.baseUrl}/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Request-ID': `LTET_${paymentRequest.paymentId}_${Date.now()}`
          },
          body: JSON.stringify({
            payment_id: paymentRequest.paymentId,
            beneficiary: {
              name: paymentRequest.beneficiaryName,
              account_number: paymentRequest.accountNumber,
              ifsc_code: paymentRequest.ifscCode,
              bank_name: paymentRequest.bankName
            },
            amount: paymentRequest.amount,
            currency: 'INR',
            purpose: paymentRequest.purpose,
            reference_number: paymentRequest.referenceNumber,
            employee_id: paymentRequest.employeeId,
            scheme_id: paymentRequest.schemeId,
            payment_mode: 'NEFT'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseData = await response.json();

        if (response.ok) {
          return {
            success: true,
            transactionId: responseData.transaction_id,
            sapReference: responseData.sap_reference
          };
        } else {
          // Check if error is retryable
          const isRetryable = this.isRetryableError(response.status, responseData.error_code);
          if (!isRetryable || attempt === this.retryAttempts - 1) {
            return {
              success: false,
              error: responseData.message || `SAP API error: ${response.status}`,
              errorCode: responseData.error_code
            };
          }
          
          lastError = responseData.message || `SAP API error: ${response.status}`;
        }
      } catch (error: any) {
        lastError = error.message;
        
        // Don't retry on timeout or network errors on final attempt
        if (attempt === this.retryAttempts - 1) {
          return {
            success: false,
            error: `SAP integration failed after ${this.retryAttempts} attempts: ${lastError}`,
            errorCode: 'INTEGRATION_FAILED'
          };
        }
      }

      attempt++;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }

    return {
      success: false,
      error: `SAP integration failed after ${this.retryAttempts} attempts: ${lastError}`,
      errorCode: 'MAX_RETRIES_EXCEEDED'
    };
  }

  /**
   * Process batch payments through SAP
   */
  async processBatchPayments(batchRequest: SAPBatchRequest): Promise<SAPBatchResponse> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return {
          success: false,
          processedCount: 0,
          failedCount: batchRequest.totalCount,
          totalAmount: batchRequest.totalAmount,
          errors: ['Failed to authenticate with SAP']
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs * 2); // Double timeout for batch

      const response = await fetch(`${this.authConfig.baseUrl}/payments/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Request-ID': `LTET_BATCH_${batchRequest.batchId}_${Date.now()}`
        },
        body: JSON.stringify({
          batch_id: batchRequest.batchId,
          batch_name: batchRequest.batchName,
          total_amount: batchRequest.totalAmount,
          total_count: batchRequest.totalCount,
          scheduled_date: batchRequest.scheduledDate?.toISOString(),
          payments: batchRequest.payments.map(payment => ({
            payment_id: payment.paymentId,
            beneficiary: {
              name: payment.beneficiaryName,
              account_number: payment.accountNumber,
              ifsc_code: payment.ifscCode,
              bank_name: payment.bankName
            },
            amount: payment.amount,
            currency: 'INR',
            purpose: payment.purpose,
            reference_number: payment.referenceNumber,
            employee_id: payment.employeeId,
            scheme_id: payment.schemeId,
            payment_mode: 'NEFT'
          }))
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          batchReference: responseData.batch_reference,
          processedCount: responseData.processed_count,
          failedCount: responseData.failed_count,
          totalAmount: responseData.total_amount,
          errors: responseData.errors || []
        };
      } else {
        return {
          success: false,
          processedCount: 0,
          failedCount: batchRequest.totalCount,
          totalAmount: batchRequest.totalAmount,
          errors: [responseData.message || `SAP batch API error: ${response.status}`]
        };
      }
    } catch (error: any) {
      return {
        success: false,
        processedCount: 0,
        failedCount: batchRequest.totalCount,
        totalAmount: batchRequest.totalAmount,
        errors: [`SAP batch integration failed: ${error.message}`]
      };
    }
  }

  /**
   * Get payment status from SAP
   */
  async getPaymentStatus(transactionId: string): Promise<{
    success: boolean;
    status?: 'pending' | 'processed' | 'failed' | 'cancelled';
    error?: string;
  }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return {
          success: false,
          error: 'Failed to authenticate with SAP'
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.authConfig.baseUrl}/payments/${transactionId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          status: data.status
        };
      } else {
        return {
          success: false,
          error: `Failed to get payment status: ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `SAP status check failed: ${error.message}`
      };
    }
  }

  /**
   * Check SAP system health
   */
  async checkHealth(): Promise<SAPHealthStatus> {
    const startTime = Date.now();
    
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        this.healthStatus = {
          connected: false,
          lastChecked: new Date(),
          error: 'Authentication failed'
        };
        return this.healthStatus;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for health check

      const response = await fetch(`${this.authConfig.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        this.healthStatus = {
          connected: true,
          responseTime,
          lastChecked: new Date()
        };
      } else {
        this.healthStatus = {
          connected: false,
          responseTime,
          lastChecked: new Date(),
          error: `Health check failed: ${response.status}`
        };
      }
    } catch (error: any) {
      this.healthStatus = {
        connected: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
    }

    return this.healthStatus;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): SAPHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(statusCode: number, errorCode?: string): boolean {
    // Retry on server errors and specific client errors
    if (statusCode >= 500) return true;
    if (statusCode === 429) return true; // Rate limiting
    if (errorCode === 'TEMPORARY_UNAVAILABLE') return true;
    if (errorCode === 'TIMEOUT') return true;
    
    return false;
  }

  /**
   * Convert PaymentQueueEntry to SAPPaymentRequest
   */
  convertToSAPPaymentRequest(entry: PaymentQueueEntry): SAPPaymentRequest {
    return {
      paymentId: entry.queueId,
      beneficiaryName: entry.beneficiaryName,
      accountNumber: entry.bankAccountNumber,
      ifscCode: entry.ifscCode,
      bankName: entry.bankName,
      amount: entry.approvedAmount,
      purpose: `LTET Scheme Payment - ${entry.schemeId}`,
      referenceNumber: `LTET_${entry.applicationId}_${entry.queueId}`,
      employeeId: entry.userId, // Using userId as employeeId
      schemeId: entry.schemeId
    };
  }
}