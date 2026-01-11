/**
 * Unit tests for Backup Service
 */

import { BackupService, BackupConfiguration } from '../backup.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockFs = jest.mocked(require('fs/promises'));

describe('BackupService', () => {
  let backupService: BackupService;
  let mockConfig: BackupConfiguration;

  beforeEach(() => {
    mockConfig = {
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

    backupService = new BackupService(mockConfig);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await backupService.cleanup();
  });

  describe('initialization', () => {
    it('should create backup directory on initialization', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await backupService.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        mockConfig.backupStoragePath,
        { recursive: true }
      );
    });

    it('should handle existing backup directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await expect(backupService.initialize()).resolves.not.toThrow();
    });
  });

  describe('backup operations', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      await backupService.initialize();
    });

    it('should prevent concurrent backups', async () => {
      // Mock file operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      // Start first backup (don't await)
      const firstBackup = backupService.createFullBackup();

      // Try to start second backup
      await expect(backupService.createFullBackup()).rejects.toThrow(
        'Backup already in progress'
      );

      // Clean up first backup
      try {
        await firstBackup;
      } catch {
        // Ignore errors from mock backup
      }
    });

    it('should generate unique backup IDs', () => {
      const service1 = new BackupService(mockConfig);
      const service2 = new BackupService(mockConfig);

      const id1 = (service1 as any).generateBackupId();
      const id2 = (service2 as any).generateBackupId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9]{8}$/);
    });
  });

  describe('backup listing', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      await backupService.initialize();
    });

    it('should list backups from metadata files', async () => {
      const mockMetadata = {
        backupId: 'test-backup-1',
        timestamp: new Date(),
        type: 'full',
        size: 1024,
        checksum: 'abc123',
        encrypted: false,
        compressed: true,
        status: 'completed',
        duration: 5000,
        filePath: '/tmp/test-backup-1.tar.gz',
      };

      mockFs.readdir.mockResolvedValue(['test-backup-1.metadata.json'] as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockMetadata));

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].backupId).toBe('test-backup-1');
    });

    it('should return empty array when no backups exist', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(0);
    });

    it('should sort backups by timestamp descending', async () => {
      const oldBackup = {
        backupId: 'old-backup',
        timestamp: new Date('2024-01-01'),
        type: 'full',
        size: 1024,
        checksum: 'abc123',
        encrypted: false,
        compressed: true,
        status: 'completed',
        duration: 5000,
        filePath: '/tmp/old-backup.tar.gz',
      };

      const newBackup = {
        backupId: 'new-backup',
        timestamp: new Date('2024-01-02'),
        type: 'full',
        size: 1024,
        checksum: 'def456',
        encrypted: false,
        compressed: true,
        status: 'completed',
        duration: 5000,
        filePath: '/tmp/new-backup.tar.gz',
      };

      mockFs.readdir.mockResolvedValue([
        'old-backup.metadata.json',
        'new-backup.metadata.json'
      ] as any);

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(oldBackup))
        .mockResolvedValueOnce(JSON.stringify(newBackup));

      const backups = await backupService.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].backupId).toBe('new-backup');
      expect(backups[1].backupId).toBe('old-backup');
    });
  });

  describe('backup statistics', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      await backupService.initialize();
    });

    it('should calculate backup statistics correctly', async () => {
      const backup1 = {
        backupId: 'backup-1',
        timestamp: new Date('2024-01-01'),
        type: 'full',
        size: 1000,
        status: 'completed',
      };

      const backup2 = {
        backupId: 'backup-2',
        timestamp: new Date('2024-01-02'),
        type: 'full',
        size: 2000,
        status: 'completed',
      };

      const backup3 = {
        backupId: 'backup-3',
        timestamp: new Date('2024-01-03'),
        type: 'full',
        size: 1500,
        status: 'failed',
      };

      mockFs.readdir.mockResolvedValue([
        'backup-1.metadata.json',
        'backup-2.metadata.json',
        'backup-3.metadata.json'
      ] as any);

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(backup1))
        .mockResolvedValueOnce(JSON.stringify(backup2))
        .mockResolvedValueOnce(JSON.stringify(backup3));

      const stats = await backupService.getBackupStatistics();

      expect(stats.totalBackups).toBe(3);
      expect(stats.totalSize).toBe(4500);
      expect(stats.successRate).toBe(66.67); // 2 out of 3 successful
      expect(stats.oldestBackup).toEqual(new Date('2024-01-01'));
      expect(stats.newestBackup).toEqual(new Date('2024-01-03'));
    });

    it('should handle empty backup list', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const stats = await backupService.getBackupStatistics();

      expect(stats.totalBackups).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.oldestBackup).toBeNull();
      expect(stats.newestBackup).toBeNull();
    });
  });

  describe('backup integrity verification', () => {
    it('should verify backup integrity with correct checksum', async () => {
      const mockChecksum = 'abc123def456';
      
      // Mock the calculateChecksum method
      jest.spyOn(backupService as any, 'calculateChecksum')
        .mockResolvedValue(mockChecksum);

      const isValid = await backupService.verifyBackupIntegrity(
        '/path/to/backup.tar.gz',
        mockChecksum
      );

      expect(isValid).toBe(true);
    });

    it('should fail verification with incorrect checksum', async () => {
      const expectedChecksum = 'abc123def456';
      const actualChecksum = 'different123';
      
      // Mock the calculateChecksum method
      jest.spyOn(backupService as any, 'calculateChecksum')
        .mockResolvedValue(actualChecksum);

      const isValid = await backupService.verifyBackupIntegrity(
        '/path/to/backup.tar.gz',
        expectedChecksum
      );

      expect(isValid).toBe(false);
    });

    it('should handle checksum calculation errors', async () => {
      // Mock the calculateChecksum method to throw an error
      jest.spyOn(backupService as any, 'calculateChecksum')
        .mockRejectedValue(new Error('Checksum calculation failed'));

      const isValid = await backupService.verifyBackupIntegrity(
        '/path/to/backup.tar.gz',
        'abc123'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('configuration validation', () => {
    it('should accept valid configuration', () => {
      expect(() => new BackupService(mockConfig)).not.toThrow();
    });

    it('should handle missing optional configuration', () => {
      const minimalConfig: BackupConfiguration = {
        databaseUrl: 'postgresql://test:test@localhost:5432/test_db',
        databaseName: 'test_db',
        backupStoragePath: '/tmp/backups',
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

      expect(() => new BackupService(minimalConfig)).not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      await backupService.initialize();
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(backupService.listBackups()).rejects.toThrow('Permission denied');
    });

    it('should handle invalid metadata files', async () => {
      mockFs.readdir.mockResolvedValue(['invalid.metadata.json'] as any);
      mockFs.readFile.mockResolvedValue('invalid json content');

      await expect(backupService.listBackups()).rejects.toThrow();
    });
  });
});