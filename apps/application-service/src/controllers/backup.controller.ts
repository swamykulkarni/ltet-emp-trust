/**
 * Backup Management Controller for LTET Employee Trust Portal
 * 
 * Provides REST API endpoints for backup and recovery operations
 */

import { Request, Response } from 'express';
import { BackupService, BackupConfiguration, RecoveryOptions, BackupMetadata } from '@ltet/shared/utils';
import { DisasterRecoveryService, DisasterRecoveryConfiguration } from '@ltet/shared/utils';

export class BackupController {
  private backupService: BackupService;
  private drService: DisasterRecoveryService;

  constructor() {
    // Initialize backup service with configuration from environment
    const backupConfig: BackupConfiguration = {
      databaseUrl: process.env.DATABASE_URL || '',
      databaseName: process.env.DATABASE_NAME || 'ltet_portal',
      backupStoragePath: process.env.BACKUP_STORAGE_PATH || '/app/backups',
      s3BucketName: process.env.BACKUP_S3_BUCKET,
      awsRegion: process.env.AWS_REGION || 'ap-south-1',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      maxBackupsToKeep: parseInt(process.env.BACKUP_MAX_KEEP || '50'),
      encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
      compressionEnabled: true,
      compressionLevel: 6,
      scheduleEnabled: process.env.BACKUP_SCHEDULE_ENABLED === 'true',
      cronSchedule: process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *',
      notificationEnabled: process.env.BACKUP_NOTIFICATIONS === 'true',
      notificationEmails: (process.env.BACKUP_NOTIFICATION_EMAILS || '').split(',').filter(Boolean),
    };

    // Initialize disaster recovery service
    const drConfig: DisasterRecoveryConfiguration = {
      primaryRegion: process.env.DR_PRIMARY_REGION || 'ap-south-1',
      secondaryRegion: process.env.DR_SECONDARY_REGION || 'ap-southeast-1',
      rtoMinutes: parseInt(process.env.DR_RTO_MINUTES || '240'),
      rpoMinutes: parseInt(process.env.DR_RPO_MINUTES || '60'),
      healthCheckInterval: parseInt(process.env.DR_HEALTH_CHECK_INTERVAL || '30000'),
      healthCheckTimeout: parseInt(process.env.DR_HEALTH_CHECK_TIMEOUT || '10000'),
      failureThreshold: parseInt(process.env.DR_FAILURE_THRESHOLD || '3'),
      autoFailover: process.env.DR_AUTO_FAILOVER === 'true',
      manualApprovalRequired: process.env.DR_MANUAL_APPROVAL === 'true',
      primaryDatabaseUrl: process.env.DATABASE_URL || '',
      secondaryDatabaseUrl: process.env.DR_SECONDARY_DATABASE_URL || '',
      primaryServiceEndpoints: (process.env.DR_PRIMARY_ENDPOINTS || '').split(',').filter(Boolean),
      secondaryServiceEndpoints: (process.env.DR_SECONDARY_ENDPOINTS || '').split(',').filter(Boolean),
      alertEmails: (process.env.DR_ALERT_EMAILS || '').split(',').filter(Boolean),
      alertWebhooks: (process.env.DR_ALERT_WEBHOOKS || '').split(',').filter(Boolean),
      backupConfig,
    };

    this.backupService = new BackupService(backupConfig);
    this.drService = new DisasterRecoveryService(drConfig);
  }

  /**
   * Initialize backup and disaster recovery services
   */
  async initialize(): Promise<void> {
    await this.backupService.initialize();
    await this.drService.initialize();
  }

  /**
   * Create a new backup
   * POST /api/backup/create
   */
  async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'full' } = req.body;

      if (type !== 'full') {
        res.status(400).json({
          success: false,
          error: 'Only full backups are currently supported',
        });
        return;
      }

      const metadata = await this.backupService.createFullBackup();

      res.status(201).json({
        success: true,
        data: {
          backupId: metadata.backupId,
          timestamp: metadata.timestamp,
          size: metadata.size,
          status: metadata.status,
          duration: metadata.duration,
        },
      });
    } catch (error) {
      console.error('Create backup error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup',
      });
    }
  }

  /**
   * List all backups
   * GET /api/backup/list
   */
  async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 20, offset = 0, status } = req.query;

      let backups = await this.backupService.listBackups();

      // Filter by status if provided
      if (status && typeof status === 'string') {
        backups = backups.filter(b => b.status === status);
      }

      // Apply pagination
      const total = backups.length;
      const paginatedBackups = backups.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );

      res.json({
        success: true,
        data: {
          backups: paginatedBackups.map(b => ({
            backupId: b.backupId,
            timestamp: b.timestamp,
            type: b.type,
            size: b.size,
            status: b.status,
            duration: b.duration,
            encrypted: b.encrypted,
            compressed: b.compressed,
          })),
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        },
      });
    } catch (error) {
      console.error('List backups error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list backups',
      });
    }
  }

  /**
   * Get backup details
   * GET /api/backup/:backupId
   */
  async getBackupDetails(req: Request, res: Response): Promise<void> {
    try {
      const { backupId } = req.params;

      const backups = await this.backupService.listBackups();
      const backup = backups.find(b => b.backupId === backupId);

      if (!backup) {
        res.status(404).json({
          success: false,
          error: 'Backup not found',
        });
        return;
      }

      res.json({
        success: true,
        data: backup,
      });
    } catch (error) {
      console.error('Get backup details error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get backup details',
      });
    }
  }

  /**
   * Restore from backup
   * POST /api/backup/restore
   */
  async restoreFromBackup(req: Request, res: Response): Promise<void> {
    try {
      const {
        backupId,
        pointInTime,
        targetDatabase,
        restoreDocuments = true,
        restoreConfiguration = true,
        dryRun = false,
      } = req.body;

      const options: RecoveryOptions = {
        backupId,
        pointInTime: pointInTime ? new Date(pointInTime) : undefined,
        targetDatabase,
        restoreDocuments,
        restoreConfiguration,
        dryRun,
      };

      await this.backupService.restoreFromBackup(options);

      res.json({
        success: true,
        message: dryRun ? 'Dry run completed successfully' : 'Restore completed successfully',
        data: {
          options,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Restore from backup error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore from backup',
      });
    }
  }

  /**
   * Delete a backup
   * DELETE /api/backup/:backupId
   */
  async deleteBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupId } = req.params;

      await this.backupService.deleteBackup(backupId);

      res.json({
        success: true,
        message: 'Backup deleted successfully',
        data: {
          backupId,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Delete backup error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup',
      });
    }
  }

  /**
   * Verify backup integrity
   * POST /api/backup/:backupId/verify
   */
  async verifyBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupId } = req.params;

      const backups = await this.backupService.listBackups();
      const backup = backups.find(b => b.backupId === backupId);

      if (!backup) {
        res.status(404).json({
          success: false,
          error: 'Backup not found',
        });
        return;
      }

      const isValid = await this.backupService.verifyBackupIntegrity(
        backup.filePath,
        backup.checksum
      );

      res.json({
        success: true,
        data: {
          backupId,
          isValid,
          checksum: backup.checksum,
          verifiedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Verify backup error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify backup',
      });
    }
  }

  /**
   * Get backup statistics
   * GET /api/backup/statistics
   */
  async getBackupStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.backupService.getBackupStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get backup statistics error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get backup statistics',
      });
    }
  }

  /**
   * Get disaster recovery status
   * GET /api/backup/dr/status
   */
  async getDRStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.drService.getStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Get DR status error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get DR status',
      });
    }
  }

  /**
   * Initiate manual failover
   * POST /api/backup/dr/failover
   */
  async initiateFailover(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Reason is required for manual failover',
        });
        return;
      }

      const failoverEvent = await this.drService.initiateFailover(reason, true);

      res.json({
        success: true,
        data: failoverEvent,
      });
    } catch (error) {
      console.error('Initiate failover error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate failover',
      });
    }
  }

  /**
   * Test failover procedure
   * POST /api/backup/dr/test-failover
   */
  async testFailover(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.drService.testFailover();

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Test failover error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test failover',
      });
    }
  }

  /**
   * Perform disaster recovery
   * POST /api/backup/dr/recover
   */
  async performDisasterRecovery(req: Request, res: Response): Promise<void> {
    try {
      const {
        backupId,
        pointInTime,
        targetDatabase,
        restoreDocuments = true,
        restoreConfiguration = true,
        dryRun = false,
      } = req.body;

      const options: RecoveryOptions = {
        backupId,
        pointInTime: pointInTime ? new Date(pointInTime) : undefined,
        targetDatabase,
        restoreDocuments,
        restoreConfiguration,
        dryRun,
      };

      await this.drService.performDisasterRecovery(options);

      res.json({
        success: true,
        message: 'Disaster recovery completed successfully',
        data: {
          options,
          recoveredAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Disaster recovery error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform disaster recovery',
      });
    }
  }

  /**
   * Get health history
   * GET /api/backup/dr/health-history
   */
  async getHealthHistory(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50 } = req.query;

      const history = this.drService.getHealthHistory(parseInt(limit as string));

      res.json({
        success: true,
        data: {
          history,
          count: history.length,
        },
      });
    } catch (error) {
      console.error('Get health history error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get health history',
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.backupService.cleanup();
    await this.drService.cleanup();
  }
}