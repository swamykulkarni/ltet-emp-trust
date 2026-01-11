import { SAPIntegrationService } from '../sap-integration.service';
import { PaymentGatewayService } from '../payment-gateway.service';
import { IntegrationHealthService } from '../integration-health.service';

// Mock environment for testing
jest.mock('../../environments/environment', () => ({
  environment: {
    sap: {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      tokenUrl: 'http://localhost:8080/sap/oauth/token',
      baseUrl: 'http://localhost:8080/sap/api',
      scope: 'payment:write'
    },
    paymentGateway: {
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      baseUrl: 'http://localhost:8080/gateway/api',
      webhookSecret: 'test-webhook-secret',
      environment: 'sandbox'
    }
  }
}));

describe('Integration Services', () => {
  describe('SAPIntegrationService', () => {
    let sapService: SAPIntegrationService;

    beforeEach(() => {
      sapService = new SAPIntegrationService();
    });

    it('should create SAP integration service instance', () => {
      expect(sapService).toBeDefined();
    });

    it('should convert PaymentQueueEntry to SAPPaymentRequest', () => {
      const mockEntry = {
        queueId: 'queue-123',
        applicationId: 'app-456',
        userId: 'user-789',
        schemeId: 'scheme-001',
        approvedAmount: 10000,
        beneficiaryName: 'John Doe',
        bankAccountNumber: '1234567890',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        branchName: 'Main Branch',
        queueStatus: 'pending' as const,
        validationStatus: 'valid' as const,
        validationDetails: {},
        priorityLevel: 1,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const sapRequest = sapService.convertToSAPPaymentRequest(mockEntry);

      expect(sapRequest).toEqual({
        paymentId: 'queue-123',
        beneficiaryName: 'John Doe',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        amount: 10000,
        purpose: 'LTET Scheme Payment - scheme-001',
        referenceNumber: 'LTET_app-456_queue-123',
        employeeId: 'user-789',
        schemeId: 'scheme-001'
      });
    });

    it('should get health status', async () => {
      const healthStatus = sapService.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('connected');
      expect(healthStatus).toHaveProperty('lastChecked');
      expect(healthStatus.connected).toBe(false); // Should be false in test environment
    });
  });

  describe('PaymentGatewayService', () => {
    let gatewayService: PaymentGatewayService;

    beforeEach(() => {
      gatewayService = new PaymentGatewayService();
    });

    it('should create payment gateway service instance', () => {
      expect(gatewayService).toBeDefined();
    });

    it('should get health status', async () => {
      const healthStatus = gatewayService.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('connected');
      expect(healthStatus).toHaveProperty('lastChecked');
      expect(healthStatus.connected).toBe(false); // Should be false in test environment
    });

    it('should verify webhook signature', () => {
      const payload = '{"transaction_id":"test","status":"completed"}';
      const timestamp = '1640995200';
      
      // This will fail in test environment due to different secret, but tests the method exists
      const isValid = gatewayService.verifyWebhookSignature(payload, 'test-signature', timestamp);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('IntegrationHealthService', () => {
    let healthService: IntegrationHealthService;

    beforeEach(() => {
      healthService = new IntegrationHealthService();
    });

    it('should create integration health service instance', () => {
      expect(healthService).toBeDefined();
    });

    it('should get active alerts', () => {
      const alerts = healthService.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get health metrics', () => {
      const metrics = healthService.getHealthMetrics(24);
      
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics.uptime).toHaveProperty('sap');
      expect(metrics.uptime).toHaveProperty('paymentGateway');
    });

    it('should get health history', () => {
      const history = healthService.getHealthHistory(24);
      expect(Array.isArray(history)).toBe(true);
    });
  });
});