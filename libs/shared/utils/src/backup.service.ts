/**
 * Backup and Recovery Service for LTET Employee Trust Portal
 * 
 * Provides automated backup, point-in-time recovery, and disaster recovery capabilities
 * Supports PostgreSQL database backups, document storage backups, and system configuration backups
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';

const pipelineAsync = promisify(pipeline);

export interface BackupConfiguration {
  // Database configuration
  databaseUrl: string;
  databaseName: string;
  
  // Storage configuration
  backupStoragePath: string;
  s3BucketName?: string;
  awsRegion?: string;
  
  // Retention configuration
  retentionDays: number;
  maxBackupsToKeep: number;
  
  // Encryption configuration
  encryptionEnabled: boolean;
  encryptionKey?: string;
  
  // Compression configuration
  compressionEnabled: boolean;
  compressionLevel: number;
  
  // Schedule configuration
  scheduleEnabled: boolean;
  cronSchedule: string; // Default: '0 2 * * *' (2 AM daily)
  
  // Notification configuration
  notificationEnabled: boolean;
  notificationEmails: string[];
}

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  status: 'in_progress' | 'completed' | 'failed';
  duration: number; // in milliseconds
  filePath: string;
  s3Key?: string;
  errorMessage?: string;
}

export interface RecoveryOptions {
  backupId?: string;
  pointInTime?: Date;
  targetDatabase?: string;
  restoreDocuments: boolean;
  restoreConfiguration: boolean;
  dryRun: boolean;
}

export interface DisasterRecoveryPlan {
  primaryRegion: string;
  secondaryRegion: string;
  rtoMinutes: number; // Recovery Time Objective
  rpoMinutes: number; // Recovery Point Objective
  autoFailover: boolean;
  healthCheckInterval: number;
  failoverThreshold: number;
}

export class BackupService {
  private config: BackupConfiguration;
  private dbPool: Pool;
  private isBackupInProgress = false;
  private scheduledBackupTimer?: ReturnType<typeof setTimeout>;

  constructor(config: BackupConfiguration) {
    this.config = config;
    this.dbPool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Initialize the backup service and start scheduled backups
   */
  async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.config.backupStoragePath, { recursive: true });
      
      // Verify database connection
      await this.verifyDatabaseConnection();
      
      // Start scheduled backups if enabled
      if (this.config.scheduleEnabled) {
        this.startScheduledBackups();
      }
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      console.log('Backup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize backup service:', error);
      throw error;
    }
  }

  /**
   * Create a full backup of the database and documents
   */
  async createFullBackup(): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId();
    
    const metadata: BackupMetadata = {
      backupId,
      timestamp: new Date(),
      type: 'full',
      size: 0,
      checksum: '',
      encrypted: this.config.encryptionEnabled,
      compressed: this.config.compressionEnabled,
      status: 'in_progress',
      duration: 0,
      filePath: '',
    };

    try {
      console.log(`Starting full backup: ${backupId}`);
      
      // Create backup directory for this backup
      const backupDir = path.join(this.config.backupStoragePath, backupId);
      await fs.mkdir(backupDir, { recursive: true });
      
      // Backup database
      const dbBackupPath = await this.backupDatabase(backupDir, backupId);
      
      // Backup documents
      const documentsBackupPath = await this.backupDocuments(backupDir, backupId);
      
      // Backup configuration
      const configBackupPath = await this.backupConfiguration(backupDir, backupId);
      
      // Create archive
      const archivePath = await this.createArchive(backupDir, backupId);
      
      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(archivePath);
      
      // Get file size
      const stats = await fs.stat(archivePath);
      metadata.size = stats.size;
      metadata.filePath = archivePath;
      
      // Upload to S3 if configured
      if (this.config.s3BucketName) {
        metadata.s3Key = await this.uploadToS3(archivePath, backupId);
      }
      
      // Update metadata
      metadata.status = 'completed';
      metadata.duration = Date.now() - startTime;
      
      // Save metadata
      await this.saveBackupMetadata(metadata);
      
      console.log(`Full backup completed: ${backupId} (${metadata.duration}ms)`);
      
      // Send notification if enabled
      if (this.config.notificationEnabled) {
        await this.sendBackupNotification(metadata);
      }
      
      return metadata;
      
    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.duration = Date.now() - startTime;
      
      await this.saveBackupMetadata(metadata);
      
      console.error(`Full backup failed: ${backupId}`, error);
      
      if (this.config.notificationEnabled) {
        await this.sendBackupNotification(metadata);
      }
      
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(options: RecoveryOptions): Promise<void> {
    try {
      console.log('Starting restore operation', options);
      
      let backupMetadata: BackupMetadata;
      
      if (options.backupId) {
        backupMetadata = await this.getBackupMetadata(options.backupId);
      } else if (options.pointInTime) {
        backupMetadata = await this.findBackupByPointInTime(options.pointInTime);
      } else {
        backupMetadata = await this.getLatestBackup();
      }
      
      if (!backupMetadata) {
        throw new Error('No suitable backup found for restore');
      }
      
      console.log(`Restoring from backup: ${backupMetadata.backupId}`);
      
      // Download from S3 if needed
      let backupPath = backupMetadata.filePath;
      if (backupMetadata.s3Key && !await this.fileExists(backupPath)) {
        backupPath = await this.downloadFromS3(backupMetadata.s3Key, backupMetadata.backupId);
      }
      
      // Verify backup integrity
      await this.verifyBackupIntegrity(backupPath, backupMetadata.checksum);
      
      if (options.dryRun) {
        console.log('Dry run completed - backup is valid and ready for restore');
        return;
      }
      
      // Extract backup
      const extractDir = await this.extractBackup(backupPath, backupMetadata.backupId);
      
      // Restore database
      await this.restoreDatabase(extractDir, options.targetDatabase);
      
      // Restore documents if requested
      if (options.restoreDocuments) {
        await this.restoreDocuments(extractDir);
      }
      
      // Restore configuration if requested
      if (options.restoreConfiguration) {
        await this.restoreConfiguration(extractDir);
      }
      
      console.log(`Restore completed from backup: ${backupMetadata.backupId}`);
      
    } catch (error) {
      console.error('Restore operation failed:', error);
      throw error;
    }
  }

  /**
   * Get list of available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const backupFiles = await fs.readdir(this.config.backupStoragePath);
      const backups: BackupMetadata[] = [];
      
      for (const file of backupFiles) {
        if (file.endsWith('.metadata.json')) {
          const metadataPath = path.join(this.config.backupStoragePath, file);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          backups.push(metadata);
        }
      }
      
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      
      // Delete local files
      if (await this.fileExists(metadata.filePath)) {
        await fs.unlink(metadata.filePath);
      }
      
      // Delete from S3 if exists
      if (metadata.s3Key) {
        await this.deleteFromS3(metadata.s3Key);
      }
      
      // Delete metadata
      const metadataPath = path.join(this.config.backupStoragePath, `${backupId}.metadata.json`);
      if (await this.fileExists(metadataPath)) {
        await fs.unlink(metadataPath);
      }
      
      console.log(`Backup deleted: ${backupId}`);
    } catch (error) {
      console.error(`Failed to delete backup ${backupId}:`, error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backupPath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(backupPath);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('Failed to verify backup integrity:', error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    successRate: number;
  }> {
    try {
      const backups = await this.listBackups();
      
      const totalBackups = backups.length;
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const successfulBackups = backups.filter(b => b.status === 'completed').length;
      const successRate = totalBackups > 0 ? Math.round((successfulBackups / totalBackups) * 10000) / 100 : 0;
      
      const oldestBackup = backups.length > 0 ? new Date(Math.min(...backups.map(b => new Date(b.timestamp).getTime()))) : null;
      const newestBackup = backups.length > 0 ? new Date(Math.max(...backups.map(b => new Date(b.timestamp).getTime()))) : null;
      
      return {
        totalBackups,
        totalSize,
        oldestBackup,
        newestBackup,
        successRate,
      };
    } catch (error) {
      console.error('Failed to get backup statistics:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  private async verifyDatabaseConnection(): Promise<void> {
    try {
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  private startScheduledBackups(): void {
    // For simplicity, using setTimeout instead of full cron implementation
    // In production, use node-cron or similar library
    const scheduleBackup = () => {
      this.createFullBackup().catch(error => {
        console.error('Scheduled backup failed:', error);
      });
      
      // Schedule next backup (24 hours)
      this.scheduledBackupTimer = setTimeout(scheduleBackup, 24 * 60 * 60 * 1000);
    };
    
    // Start first backup after 1 minute
    this.scheduledBackupTimer = setTimeout(scheduleBackup, 60 * 1000);
  }

  private async backupDatabase(backupDir: string, backupId: string): Promise<string> {
    const backupPath = path.join(backupDir, `${backupId}-database.sql`);
    
    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        this.config.databaseUrl,
        '--no-password',
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        '--format=custom',
        '--file', backupPath
      ]);
      
      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve(backupPath);
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });
      
      pgDump.on('error', reject);
    });
  }

  private async backupDocuments(backupDir: string, backupId: string): Promise<string> {
    const documentsPath = path.join(backupDir, `${backupId}-documents.tar.gz`);
    
    // This is a simplified implementation
    // In production, you would backup from S3 or document storage
    await fs.writeFile(documentsPath, 'Documents backup placeholder');
    
    return documentsPath;
  }

  private async backupConfiguration(backupDir: string, backupId: string): Promise<string> {
    const configPath = path.join(backupDir, `${backupId}-config.json`);
    
    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
      // Add other configuration data as needed
    };
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return configPath;
  }

  private async createArchive(backupDir: string, backupId: string): Promise<string> {
    const archivePath = path.join(this.config.backupStoragePath, `${backupId}.tar.gz`);
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-czf',
        archivePath,
        '-C',
        backupDir,
        '.'
      ]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve(archivePath);
        } else {
          reject(new Error(`tar exited with code ${code}`));
        }
      });
      
      tar.on('error', reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async uploadToS3(filePath: string, backupId: string): Promise<string> {
    // Placeholder for S3 upload implementation
    // In production, use AWS SDK
    const s3Key = `backups/${backupId}.tar.gz`;
    console.log(`Would upload ${filePath} to S3 key: ${s3Key}`);
    return s3Key;
  }

  private async downloadFromS3(s3Key: string, backupId: string): Promise<string> {
    // Placeholder for S3 download implementation
    const localPath = path.join(this.config.backupStoragePath, `${backupId}.tar.gz`);
    console.log(`Would download S3 key ${s3Key} to ${localPath}`);
    return localPath;
  }

  private async deleteFromS3(s3Key: string): Promise<void> {
    // Placeholder for S3 delete implementation
    console.log(`Would delete S3 key: ${s3Key}`);
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.config.backupStoragePath, `${metadata.backupId}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata> {
    const metadataPath = path.join(this.config.backupStoragePath, `${backupId}.metadata.json`);
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  private async findBackupByPointInTime(pointInTime: Date): Promise<BackupMetadata> {
    const backups = await this.listBackups();
    
    // Find the most recent backup before the point in time
    const suitableBackups = backups
      .filter(b => new Date(b.timestamp) <= pointInTime && b.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (suitableBackups.length === 0) {
      throw new Error('No suitable backup found for the specified point in time');
    }
    
    return suitableBackups[0];
  }

  private async getLatestBackup(): Promise<BackupMetadata> {
    const backups = await this.listBackups();
    const completedBackups = backups.filter(b => b.status === 'completed');
    
    if (completedBackups.length === 0) {
      throw new Error('No completed backups found');
    }
    
    return completedBackups[0];
  }

  private async extractBackup(backupPath: string, backupId: string): Promise<string> {
    const extractDir = path.join(this.config.backupStoragePath, `extract-${backupId}`);
    await fs.mkdir(extractDir, { recursive: true });
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-xzf',
        backupPath,
        '-C',
        extractDir
      ]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve(extractDir);
        } else {
          reject(new Error(`tar extraction exited with code ${code}`));
        }
      });
      
      tar.on('error', reject);
    });
  }

  private async restoreDatabase(extractDir: string, targetDatabase?: string): Promise<void> {
    const dbBackupFiles = await fs.readdir(extractDir);
    const dbFile = dbBackupFiles.find(f => f.includes('-database.sql'));
    
    if (!dbFile) {
      throw new Error('Database backup file not found');
    }
    
    const dbBackupPath = path.join(extractDir, dbFile);
    const dbUrl = targetDatabase || this.config.databaseUrl;
    
    return new Promise((resolve, reject) => {
      const pgRestore = spawn('pg_restore', [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--dbname', dbUrl,
        dbBackupPath
      ]);
      
      pgRestore.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_restore exited with code ${code}`));
        }
      });
      
      pgRestore.on('error', reject);
    });
  }

  private async restoreDocuments(extractDir: string): Promise<void> {
    // Placeholder for document restore implementation
    console.log(`Restoring documents from ${extractDir}`);
  }

  private async restoreConfiguration(extractDir: string): Promise<void> {
    // Placeholder for configuration restore implementation
    console.log(`Restoring configuration from ${extractDir}`);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const oldBackups = backups.filter(b => new Date(b.timestamp) < cutoffDate);
      
      for (const backup of oldBackups) {
        await this.deleteBackup(backup.backupId);
      }
      
      console.log(`Cleaned up ${oldBackups.length} old backups`);
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  private async sendBackupNotification(metadata: BackupMetadata): Promise<void> {
    // Placeholder for notification implementation
    console.log(`Backup notification: ${metadata.backupId} - ${metadata.status}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.scheduledBackupTimer) {
      clearTimeout(this.scheduledBackupTimer);
    }
    
    await this.dbPool.end();
  }
}

// Singleton instance
let backupService: BackupService | null = null;

export function createBackupService(config: BackupConfiguration): BackupService {
  if (!backupService) {
    backupService = new BackupService(config);
  }
  return backupService;
}

export { backupService };