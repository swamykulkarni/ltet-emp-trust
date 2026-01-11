import { environment } from '../environments/environment';

export interface PaymentGatewayRequest {
  paymentId: string;
  amount: number;
  currency: string;
  beneficiary: {
    name: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  purpose: string;
  referenceNumber: string;
  callbackUrl?: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  transactionId?: string;
  gatewayReference?: string;
  status?: 'initiated' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  errorCode?: string;
}

export interface BankValidationRequest {
  accountNumber: string;
  ifscCode: string;
  beneficiaryName?: string;
}

export interface BankValidationResponse {
  success: boolean;
  valid: boolean;
  bankName?: string;
  branchName?: string;
  accountHolderName?: string;
  error?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  transactionId?: string;
  completedAt?: Date;
  failureReason?: string;
  error?: string;
}

export interface PaymentGatewayConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
}

export interface GatewayHealthStatus {
  connected: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export class PaymentGatewayService {
  private config: PaymentGatewayConfig;
  private healthStatus: GatewayHealthStatus;
  private retryAttempts = 2;
  private timeoutMs = 45000;

  constructor() {
    this.config = {
      apiKey: environment.paymentGateway.apiKey || '',
      secretKey: environment.paymentGateway.secretKey || '',
      baseUrl: environment.paymentGateway.baseUrl || '',
      webhookSecret: environment.paymentGateway.webhookSecret || '',
      environment: (environment.paymentGateway.environment as 'sandbox' | 'production') || 'sandbox'
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
    // Check gateway connectivity every 3 minutes
    setInterval(async () => {
      await this.checkHealth();
    }, 3 * 60 * 1000);

    // Initial health check
    this.checkHealth();
  }

  /**
   * Generate authentication signature
   */
  private generateSignature(payload: string, timestamp: string): string {
    const crypto = require('crypto');
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(message)
      .digest('hex');
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'POST',
    body?: any
  ): Promise<Response> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = body ? JSON.stringify(body) : '';
    const signature = this.generateSignature(payload, timestamp);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'X-Environment': this.config.environment
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Validate bank account details
   */
  async validateBankAccount(request: BankValidationRequest): Promise<BankValidationResponse> {
    let attempt = 0;
    let lastError: string = '';

    while (attempt < this.retryAttempts) {
      try {
        const response = await this.makeRequest('/validate/bank-account', 'POST', {
          account_number: request.accountNumber,
          ifsc_code: request.ifscCode,
          beneficiary_name: request.beneficiaryName
        });

        const responseData = await response.json();

        if (response.ok) {
          return {
            success: true,
            valid: responseData.valid,
            bankName: responseData.bank_name,
            branchName: responseData.branch_name,
            accountHolderName: responseData.account_holder_name
          };
        } else {
          // Check if error is retryable
          const isRetryable = this.isRetryableError(response.status, responseData.error_code);
          if (!isRetryable || attempt === this.retryAttempts - 1) {
            return {
              success: false,
              valid: false,
              error: responseData.message || `Validation API error: ${response.status}`
            };
          }
          
          lastError = responseData.message || `Validation API error: ${response.status}`;
        }
      } catch (error: any) {
        lastError = error.message;
        
        if (attempt === this.retryAttempts - 1) {
          return {
            success: false,
            valid: false,
            error: `Bank validation failed after ${this.retryAttempts} attempts: ${lastError}`
          };
        }
      }

      attempt++;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }

    return {
      success: false,
      valid: false,
      error: `Bank validation failed after ${this.retryAttempts} attempts: ${lastError}`
    };
  }

  /**
   * Initiate payment through gateway
   */
  async initiatePayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    let attempt = 0;
    let lastError: string = '';

    while (attempt < this.retryAttempts) {
      try {
        const response = await this.makeRequest('/payments', 'POST', {
          payment_id: request.paymentId,
          amount: request.amount,
          currency: request.currency,
          beneficiary: {
            name: request.beneficiary.name,
            account_number: request.beneficiary.accountNumber,
            ifsc_code: request.beneficiary.ifscCode,
            bank_name: request.beneficiary.bankName
          },
          purpose: request.purpose,
          reference_number: request.referenceNumber,
          callback_url: request.callbackUrl,
          payment_mode: 'NEFT'
        });

        const responseData = await response.json();

        if (response.ok) {
          return {
            success: true,
            transactionId: responseData.transaction_id,
            gatewayReference: responseData.gateway_reference,
            status: responseData.status
          };
        } else {
          // Check if error is retryable
          const isRetryable = this.isRetryableError(response.status, responseData.error_code);
          if (!isRetryable || attempt === this.retryAttempts - 1) {
            return {
              success: false,
              error: responseData.message || `Payment gateway error: ${response.status}`,
              errorCode: responseData.error_code
            };
          }
          
          lastError = responseData.message || `Payment gateway error: ${response.status}`;
        }
      } catch (error: any) {
        lastError = error.message;
        
        if (attempt === this.retryAttempts - 1) {
          return {
            success: false,
            error: `Payment initiation failed after ${this.retryAttempts} attempts: ${lastError}`,
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
      error: `Payment initiation failed after ${this.retryAttempts} attempts: ${lastError}`,
      errorCode: 'MAX_RETRIES_EXCEEDED'
    };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await this.makeRequest(`/payments/${transactionId}/status`, 'GET');
      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          status: responseData.status,
          transactionId: responseData.transaction_id,
          completedAt: responseData.completed_at ? new Date(responseData.completed_at) : undefined,
          failureReason: responseData.failure_reason
        };
      } else {
        return {
          success: false,
          error: responseData.message || `Status check failed: ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Payment status check failed: ${error.message}`
      };
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(transactionId: string, reason: string): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.makeRequest(`/payments/${transactionId}/cancel`, 'POST', {
        reason
      });

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          transactionId: responseData.transaction_id,
          status: 'cancelled'
        };
      } else {
        return {
          success: false,
          error: responseData.message || `Payment cancellation failed: ${response.status}`,
          errorCode: responseData.error_code
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Payment cancellation failed: ${error.message}`,
        errorCode: 'INTEGRATION_FAILED'
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, timestamp);
      const crypto = require('crypto');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process webhook notification
   */
  async processWebhook(payload: any): Promise<{
    success: boolean;
    transactionId?: string;
    status?: string;
    error?: string;
  }> {
    try {
      const { transaction_id, status, gateway_reference, failure_reason } = payload;

      if (!transaction_id || !status) {
        return {
          success: false,
          error: 'Invalid webhook payload: missing required fields'
        };
      }

      return {
        success: true,
        transactionId: transaction_id,
        status
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Webhook processing failed: ${error.message}`
      };
    }
  }

  /**
   * Check gateway health
   */
  async checkHealth(): Promise<GatewayHealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest('/health', 'GET');
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
  getHealthStatus(): GatewayHealthStatus {
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
    if (errorCode === 'NETWORK_ERROR') return true;
    
    return false;
  }

  /**
   * Get supported banks list
   */
  async getSupportedBanks(): Promise<{
    success: boolean;
    banks?: Array<{ ifscPrefix: string; bankName: string; }>;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest('/banks', 'GET');
      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          banks: responseData.banks
        };
      } else {
        return {
          success: false,
          error: responseData.message || `Failed to get banks: ${response.status}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get supported banks: ${error.message}`
      };
    }
  }
}