/**
 * Unit tests for Disaster Recovery Service
 */

import { DisasterRecoveryService, DisasterRecoveryConfiguration } from '../disaster-recovery.service';
import { BackupConfiguration } from '../backup.service';

// Mock dependencies
jest.mock('../backup.service');
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('DisasterRecoveryService', () => {
  let drService: DisasterRecoveryService;
  let mockConfig: DisasterRecoveryConfiguration;

  beforeEach(() => {
    const mockBackupConfig: BackupConfiguration = {
      databaseUrl: 'postgresql://test:test@localhost:5432/test_db',
      databaseName: 'test_db',
      backupStoragePath: '/tmp/test-backups',
      retentionDays: 30,
      maxBackupsToKeep: 50,
      encryptionEnabled: false,
      compressionEnabled: true,
      compressionLevel: 6,
      scheduleEnabled: false,
      cronSchedule: '0 2 * * *',
      notificationEnabled: false,
      notificationEmails: [],
    };

    mockConfig = {
      primaryRegion: 'ap-south-1',
      secondaryRegion: 'ap-southeast-1',
      rtoMinutes: 240,
      rpoMinutes: 60,
      healthCheckInterval: 30000,
      healthCheckTimeout: 10000,
      failureThreshold: 3,
      autoFailover: false,
      manualApprovalRequired: true,
      primaryDatabaseUrl: 'postgresql://primary:test@localhost:5432/test_db',
      secondaryDatabaseUrl: 'postgresql://secondary:test@localhost:5433/test_db',
      primaryServiceEndpoints: ['http://primary-service:3000'],
      secondaryServiceEndpoints: ['http://secondary-service:3000'],
      alertEmails: ['admin@test.com'],
      alertWebhooks: [],
      backupConfig: mockBackupConfig,
    };

    drService = new DisasterRecoveryService(mockConfig);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await drService.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Mock backup service initialization
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;

      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});

      await expect(drService.initialize()).resolves.not.toThrow();
      expect(mockBackupService.initialize).toHaveBeenCalled();
    });

    it('should emit initialized event on successful initialization', async () => {
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;

      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});

      const initializeEventSpy = jest.fn();
      drService.on('initialized', initializeEventSpy);

      await drService.initialize();

      expect(initializeEventSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        currentRegion: 'primary',
      });
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;
      
      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      await drService.initialize();
    });

    it('should perform health checks on all configured endpoints', async () => {
      // Mock fetch for health checks
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      const results = await drService.performHealthCheck();

      expect(results).toHaveLength(2); // 1 service endpoint + 1 database
      expect(results[0].service).toBe('primary-service');
      expect(results[0].status).toBe('healthy');
    });

    it('should detect unhealthy services', async () => {
      // Mock fetch to return error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const results = await drService.performHealthCheck();

      expect(results[0].status).toBe('unhealthy');
      expect(results[0].errorMessage).toBe('Connection refused');
    });

    it('should track consecutive failures', async () => {
      // Mock unhealthy responses
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      // Perform multiple health checks
      await drService.performHealthCheck();
      await drService.performHealthCheck();

      const status = drService.getStatus();
      expect(status.consecutiveFailures).toBe(2);
    });
  });

  describe('failover operations', () => {
    beforeEach(async () => {
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;
      
      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      await drService.initialize();
    });

    it('should prevent concurrent failovers', async () => {
      // Mock failover execution methods
      jest.spyOn(drService as any, 'executeFailoverPlan').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'sendFailoverAlert').mockResolvedValue(undefined);

      // Start first failover (don't await)
      const firstFailover = drService.initiateFailover('Test failover', true);

      // Try to start second failover
      await expect(drService.initiateFailover('Second failover', true))
        .rejects.toThrow('Failover already in progress');

      // Clean up first failover
      await firstFailover;
    });

    it('should emit failover events', async () => {
      // Mock failover execution methods
      jest.spyOn(drService as any, 'executeFailoverPlan').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'sendFailoverAlert').mockResolvedValue(undefined);

      const failoverStartedSpy = jest.fn();
      const failoverCompletedSpy = jest.fn();
      
      drService.on('failover_started', failoverStartedSpy);
      drService.on('failover_completed', failoverCompletedSpy);

      await drService.initiateFailover('Test failover', true);

      expect(failoverStartedSpy).toHaveBeenCalled();
      expect(failoverCompletedSpy).toHaveBeenCalled();
    });

    it('should handle failover failures gracefully', async () => {
      // Mock failover execution to fail
      jest.spyOn(drService as any, 'executeFailoverPlan')
        .mockRejectedValue(new Error('Failover execution failed'));
      jest.spyOn(drService as any, 'sendFailoverAlert').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'rollbackFailover').mockResolvedValue(undefined);

      const failoverFailedSpy = jest.fn();
      drService.on('failover_failed', failoverFailedSpy);

      await expect(drService.initiateFailover('Test failover', true))
        .rejects.toThrow('Failover execution failed');

      expect(failoverFailedSpy).toHaveBeenCalled();
    });

    it('should switch current region after successful failover', async () => {
      // Mock failover execution methods
      jest.spyOn(drService as any, 'executeFailoverPlan').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'sendFailoverAlert').mockResolvedValue(undefined);

      const initialStatus = drService.getStatus();
      expect(initialStatus.currentRegion).toBe('primary');

      await drService.initiateFailover('Test failover', true);

      const finalStatus = drService.getStatus();
      expect(finalStatus.currentRegion).toBe('secondary');
    });
  });

  describe('disaster recovery', () => {
    beforeEach(async () => {
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        restoreFromBackup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;
      
      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      await drService.initialize();
    });

    it('should perform disaster recovery successfully', async () => {
      const mockBackupService = (drService as any).backupService;
      
      // Mock recovery plan creation and execution
      jest.spyOn(drService as any, 'createRecoveryPlan').mockResolvedValue({
        planId: 'test-plan',
        name: 'Test Recovery Plan',
        steps: [],
      });
      jest.spyOn(drService as any, 'executeRecoveryPlan').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'verifyRecovery').mockResolvedValue(undefined);

      const recoveryOptions = {
        backupId: 'test-backup',
        restoreDocuments: true,
        restoreConfiguration: true,
        dryRun: false,
      };

      const recoveryCompletedSpy = jest.fn();
      drService.on('recovery_completed', recoveryCompletedSpy);

      await drService.performDisasterRecovery(recoveryOptions);

      expect(recoveryCompletedSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        options: recoveryOptions,
        recoveryPlan: expect.any(Object),
      });
    });

    it('should handle recovery failures', async () => {
      // Mock recovery to fail
      jest.spyOn(drService as any, 'createRecoveryPlan')
        .mockRejectedValue(new Error('Recovery plan creation failed'));

      const recoveryFailedSpy = jest.fn();
      drService.on('recovery_failed', recoveryFailedSpy);

      const recoveryOptions = {
        backupId: 'test-backup',
        restoreDocuments: true,
        restoreConfiguration: true,
        dryRun: false,
      };

      await expect(drService.performDisasterRecovery(recoveryOptions))
        .rejects.toThrow('Recovery plan creation failed');

      expect(recoveryFailedSpy).toHaveBeenCalled();
    });
  });

  describe('status reporting', () => {
    it('should return current status', () => {
      const status = drService.getStatus();

      expect(status).toEqual({
        currentRegion: 'primary',
        isFailoverInProgress: false,
        consecutiveFailures: 0,
        lastHealthCheck: null,
        healthStatus: 'healthy',
      });
    });

    it('should calculate health status based on recent results', () => {
      // Add some health check results to history
      const healthHistory = [
        { timestamp: new Date(), service: 'test', endpoint: 'test', status: 'healthy' as const, responseTime: 100 },
        { timestamp: new Date(), service: 'test', endpoint: 'test', status: 'unhealthy' as const, responseTime: 0 },
        { timestamp: new Date(), service: 'test', endpoint: 'test', status: 'unhealthy' as const, responseTime: 0 },
        { timestamp: new Date(), service: 'test', endpoint: 'test', status: 'unhealthy' as const, responseTime: 0 },
      ];

      (drService as any).healthHistory = healthHistory;

      const status = drService.getStatus();
      expect(status.healthStatus).toBe('unhealthy');
    });
  });

  describe('failover testing', () => {
    beforeEach(async () => {
      const mockBackupService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      
      (drService as any).backupService = mockBackupService;
      
      // Mock health check methods to avoid actual network calls
      jest.spyOn(drService as any, 'verifyRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'startHealthMonitoring').mockImplementation(() => {});
      
      await drService.initialize();
    });

    it('should test failover procedure without actual failover', async () => {
      // Mock test methods
      jest.spyOn(drService as any, 'checkSecondaryRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'testDatabaseFailover').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'testServiceEndpoints').mockResolvedValue(undefined);

      const result = await drService.testFailover();

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);
      expect(result.steps.every(step => step.success)).toBe(true);
    });

    it('should report test failures', async () => {
      // Mock one test to fail
      jest.spyOn(drService as any, 'checkSecondaryRegionHealth').mockResolvedValue(undefined);
      jest.spyOn(drService as any, 'testDatabaseFailover')
        .mockRejectedValue(new Error('Database test failed'));
      jest.spyOn(drService as any, 'testServiceEndpoints').mockResolvedValue(undefined);

      const result = await drService.testFailover();

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[1].success).toBe(false);
      expect(result.steps[1].error).toBe('Database test failed');
    });
  });

  describe('configuration validation', () => {
    it('should accept valid configuration', () => {
      expect(() => new DisasterRecoveryService(mockConfig)).not.toThrow();
    });

    it('should handle configuration with auto-failover enabled', () => {
      const autoFailoverConfig = {
        ...mockConfig,
        autoFailover: true,
        manualApprovalRequired: false,
      };

      expect(() => new DisasterRecoveryService(autoFailoverConfig)).not.toThrow();
    });
  });
});