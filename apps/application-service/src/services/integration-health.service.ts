import { SAPIntegrationService, SAPHealthStatus } from './sap-integration.service';
import { PaymentGatewayService, GatewayHealthStatus } from './payment-gateway.service';

export interface IntegrationHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    sap: SAPHealthStatus & { name: 'SAP Integration' };
    paymentGateway: GatewayHealthStatus & { name: 'Payment Gateway' };
  };
  alerts: HealthAlert[];
}

export interface HealthAlert {
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface HealthMetrics {
  uptime: {
    sap: number; // percentage
    paymentGateway: number; // percentage
  };
  responseTime: {
    sap: number; // average in ms
    paymentGateway: number; // average in ms
  };
  errorRate: {
    sap: number; // percentage
    paymentGateway: number; // percentage
  };
}

export class IntegrationHealthService {
  private sapService: SAPIntegrationService;
  private paymentGatewayService: PaymentGatewayService;
  private alerts: HealthAlert[] = [];
  private healthHistory: IntegrationHealthReport[] = [];
  private maxHistorySize = 1000;
  private alertThresholds = {
    responseTime: 5000, // 5 seconds
    errorRate: 10, // 10%
    uptime: 95 // 95%
  };

  constructor() {
    this.sapService = new SAPIntegrationService();
    this.paymentGatewayService = new PaymentGatewayService();
    
    // Initialize periodic health monitoring
    this.initializeMonitoring();
  }

  /**
   * Initialize periodic health monitoring and alerting
   */
  private initializeMonitoring(): void {
    // Check health every 2 minutes
    setInterval(async () => {
      await this.performHealthCheck();
    }, 2 * 60 * 1000);

    // Generate health report every 15 minutes
    setInterval(async () => {
      const report = await this.generateHealthReport();
      this.storeHealthReport(report);
      await this.processAlerts(report);
    }, 15 * 60 * 1000);

    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);

    // Initial health check
    this.performHealthCheck();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<IntegrationHealthReport> {
    const timestamp = new Date();
    
    // Get health status from all services
    const sapHealth = await this.sapService.checkHealth();
    const gatewayHealth = await this.paymentGatewayService.checkHealth();

    // Determine overall health
    const overall = this.calculateOverallHealth(sapHealth, gatewayHealth);

    const report: IntegrationHealthReport = {
      overall,
      timestamp,
      services: {
        sap: { ...sapHealth, name: 'SAP Integration' },
        paymentGateway: { ...gatewayHealth, name: 'Payment Gateway' }
      },
      alerts: this.getActiveAlerts()
    };

    return report;
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<IntegrationHealthReport> {
    return await this.performHealthCheck();
  }

  /**
   * Get current health status
   */
  async getCurrentHealth(): Promise<IntegrationHealthReport> {
    return await this.performHealthCheck();
  }

  /**
   * Get health metrics over time
   */
  getHealthMetrics(hours: number = 24): HealthMetrics {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantReports = this.healthHistory.filter(report => report.timestamp >= cutoffTime);

    if (relevantReports.length === 0) {
      return {
        uptime: { sap: 0, paymentGateway: 0 },
        responseTime: { sap: 0, paymentGateway: 0 },
        errorRate: { sap: 0, paymentGateway: 0 }
      };
    }

    // Calculate uptime
    const sapUptime = (relevantReports.filter(r => r.services.sap.connected).length / relevantReports.length) * 100;
    const gatewayUptime = (relevantReports.filter(r => r.services.paymentGateway.connected).length / relevantReports.length) * 100;

    // Calculate average response times
    const sapResponseTimes = relevantReports
      .filter(r => r.services.sap.responseTime)
      .map(r => r.services.sap.responseTime!);
    const gatewayResponseTimes = relevantReports
      .filter(r => r.services.paymentGateway.responseTime)
      .map(r => r.services.paymentGateway.responseTime!);

    const avgSapResponseTime = sapResponseTimes.length > 0 
      ? sapResponseTimes.reduce((a, b) => a + b, 0) / sapResponseTimes.length 
      : 0;
    const avgGatewayResponseTime = gatewayResponseTimes.length > 0 
      ? gatewayResponseTimes.reduce((a, b) => a + b, 0) / gatewayResponseTimes.length 
      : 0;

    // Calculate error rates
    const sapErrorRate = ((relevantReports.length - relevantReports.filter(r => r.services.sap.connected).length) / relevantReports.length) * 100;
    const gatewayErrorRate = ((relevantReports.length - relevantReports.filter(r => r.services.paymentGateway.connected).length) / relevantReports.length) * 100;

    return {
      uptime: {
        sap: sapUptime,
        paymentGateway: gatewayUptime
      },
      responseTime: {
        sap: avgSapResponseTime,
        paymentGateway: avgGatewayResponseTime
      },
      errorRate: {
        sap: sapErrorRate,
        paymentGateway: gatewayErrorRate
      }
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(limit: number = 100): HealthAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertIndex: number): boolean {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      this.alerts[alertIndex].resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Get health history
   */
  getHealthHistory(hours: number = 24): IntegrationHealthReport[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthHistory
      .filter(report => report.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(sapHealth: SAPHealthStatus, gatewayHealth: GatewayHealthStatus): 'healthy' | 'degraded' | 'unhealthy' {
    const connectedServices = [sapHealth.connected, gatewayHealth.connected].filter(Boolean).length;
    const totalServices = 2;

    if (connectedServices === totalServices) {
      // Check response times
      const slowServices = [
        sapHealth.responseTime && sapHealth.responseTime > this.alertThresholds.responseTime,
        gatewayHealth.responseTime && gatewayHealth.responseTime > this.alertThresholds.responseTime
      ].filter(Boolean).length;

      return slowServices > 0 ? 'degraded' : 'healthy';
    } else if (connectedServices > 0) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Store health report in history
   */
  private storeHealthReport(report: IntegrationHealthReport): void {
    this.healthHistory.push(report);
    
    // Keep only the most recent reports
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Process alerts based on health report
   */
  private async processAlerts(report: IntegrationHealthReport): Promise<void> {
    // Check SAP service
    if (!report.services.sap.connected) {
      this.createAlert('SAP Integration', 'critical', `SAP service is down: ${report.services.sap.error}`);
    } else if (report.services.sap.responseTime && report.services.sap.responseTime > this.alertThresholds.responseTime) {
      this.createAlert('SAP Integration', 'medium', `SAP service response time is high: ${report.services.sap.responseTime}ms`);
    }

    // Check Payment Gateway service
    if (!report.services.paymentGateway.connected) {
      this.createAlert('Payment Gateway', 'critical', `Payment Gateway service is down: ${report.services.paymentGateway.error}`);
    } else if (report.services.paymentGateway.responseTime && report.services.paymentGateway.responseTime > this.alertThresholds.responseTime) {
      this.createAlert('Payment Gateway', 'medium', `Payment Gateway response time is high: ${report.services.paymentGateway.responseTime}ms`);
    }

    // Check overall system health
    if (report.overall === 'unhealthy') {
      this.createAlert('System', 'critical', 'All integration services are down');
    } else if (report.overall === 'degraded') {
      this.createAlert('System', 'high', 'Some integration services are experiencing issues');
    }

    // Send notifications for critical alerts
    await this.sendCriticalAlertNotifications();
  }

  /**
   * Create new alert
   */
  private createAlert(service: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved && 
      alert.service === service && 
      alert.message === message
    );

    if (!existingAlert) {
      this.alerts.push({
        service,
        severity,
        message,
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  /**
   * Send notifications for critical alerts
   */
  private async sendCriticalAlertNotifications(): Promise<void> {
    const criticalAlerts = this.alerts.filter(alert => 
      !alert.resolved && 
      alert.severity === 'critical' &&
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000 // Only recent alerts
    );

    for (const alert of criticalAlerts) {
      try {
        // In a real implementation, this would send notifications via email, SMS, or Slack
        console.error(`CRITICAL ALERT: ${alert.service} - ${alert.message}`);
        
        // TODO: Integrate with notification service
        // await notificationService.sendCriticalAlert(alert);
      } catch (error) {
        console.error('Failed to send critical alert notification:', error);
      }
    }
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || alert.timestamp >= cutoffTime
    );
  }

  /**
   * Test integration connectivity
   */
  async testConnectivity(): Promise<{
    sap: { success: boolean; error?: string };
    paymentGateway: { success: boolean; error?: string };
  }> {
    const sapTest = await this.sapService.checkHealth();
    const gatewayTest = await this.paymentGatewayService.checkHealth();

    return {
      sap: {
        success: sapTest.connected,
        error: sapTest.error
      },
      paymentGateway: {
        success: gatewayTest.connected,
        error: gatewayTest.error
      }
    };
  }
}