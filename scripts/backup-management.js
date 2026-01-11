#!/usr/bin/env node

/**
 * Backup Management CLI for LTET Employee Trust Portal
 * 
 * Provides command-line interface for backup and disaster recovery operations
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ltet_user:ltet_password@localhost:5432/ltet_portal',
  BACKUP_DIR: process.env.BACKUP_DIR || './backups',
  S3_BUCKET: process.env.BACKUP_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
};

class BackupCLI {
  constructor() {
    this.backupDir = CONFIG.BACKUP_DIR;
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error.message);
      process.exit(1);
    }
  }

  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 5);
    return `backup-${timestamp}-${random}`;
  }

  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        ...options,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (!options.silent) {
          process.stdout.write(data);
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (!options.silent) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  async createDatabaseBackup(backupId) {
    console.log('Creating database backup...');
    
    const backupFile = path.join(this.backupDir, `${backupId}-database.sql`);
    
    try {
      await this.executeCommand('pg_dump', [
        CONFIG.DATABASE_URL,
        '--no-password',
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        '--format=custom',
        '--file', backupFile
      ]);
      
      console.log(`Database backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('Database backup failed:', error.message);
      throw error;
    }
  }

  async createDocumentBackup(backupId) {
    console.log('Creating document backup...');
    
    const documentsDir = process.env.DOCUMENTS_DIR || './storage/documents';
    const backupFile = path.join(this.backupDir, `${backupId}-documents.tar.gz`);
    
    try {
      // Check if documents directory exists
      try {
        await fs.access(documentsDir);
      } catch {
        console.log('Documents directory not found, creating empty backup');
        await fs.writeFile(backupFile, '');
        return backupFile;
      }

      await this.executeCommand('tar', [
        '-czf', backupFile,
        '-C', path.dirname(documentsDir),
        path.basename(documentsDir)
      ]);
      
      console.log(`Document backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('Document backup failed:', error.message);
      throw error;
    }
  }

  async createConfigBackup(backupId) {
    console.log('Creating configuration backup...');
    
    const configFile = path.join(this.backupDir, `${backupId}-config.json`);
    
    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      backupId,
      databaseUrl: CONFIG.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Mask credentials
      s3Bucket: CONFIG.S3_BUCKET,
      awsRegion: CONFIG.AWS_REGION,
    };
    
    try {
      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      console.log(`Configuration backup created: ${configFile}`);
      return configFile;
    } catch (error) {
      console.error('Configuration backup failed:', error.message);
      throw error;
    }
  }

  async createArchive(backupId, files) {
    console.log('Creating backup archive...');
    
    const archiveFile = path.join(this.backupDir, `${backupId}.tar.gz`);
    
    try {
      const args = ['-czf', archiveFile];
      
      for (const file of files) {
        args.push('-C', path.dirname(file), path.basename(file));
      }
      
      await this.executeCommand('tar', args);
      
      console.log(`Backup archive created: ${archiveFile}`);
      return archiveFile;
    } catch (error) {
      console.error('Archive creation failed:', error.message);
      throw error;
    }
  }

  async calculateChecksum(filePath) {
    try {
      const { stdout } = await this.executeCommand('sha256sum', [filePath], { silent: true });
      return stdout.split(' ')[0];
    } catch (error) {
      console.error('Checksum calculation failed:', error.message);
      throw error;
    }
  }

  async saveMetadata(backupId, metadata) {
    const metadataFile = path.join(this.backupDir, `${backupId}.metadata.json`);
    
    try {
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
      console.log(`Metadata saved: ${metadataFile}`);
    } catch (error) {
      console.error('Failed to save metadata:', error.message);
      throw error;
    }
  }

  async uploadToS3(filePath, backupId) {
    if (!CONFIG.S3_BUCKET) {
      console.log('S3 bucket not configured, skipping upload');
      return null;
    }

    console.log('Uploading to S3...');
    
    const s3Key = `backups/${backupId}.tar.gz`;
    
    try {
      await this.executeCommand('aws', [
        's3', 'cp',
        filePath,
        `s3://${CONFIG.S3_BUCKET}/${s3Key}`,
        '--region', CONFIG.AWS_REGION
      ]);
      
      console.log(`Uploaded to S3: s3://${CONFIG.S3_BUCKET}/${s3Key}`);
      return s3Key;
    } catch (error) {
      console.error('S3 upload failed:', error.message);
      throw error;
    }
  }

  async createFullBackup() {
    const backupId = this.generateBackupId();
    const startTime = Date.now();
    
    console.log(`Starting full backup: ${backupId}`);
    
    try {
      await this.ensureBackupDirectory();
      
      // Create individual backups
      const dbBackupFile = await this.createDatabaseBackup(backupId);
      const docBackupFile = await this.createDocumentBackup(backupId);
      const configBackupFile = await this.createConfigBackup(backupId);
      
      // Create archive
      const archiveFile = await this.createArchive(backupId, [
        dbBackupFile,
        docBackupFile,
        configBackupFile
      ]);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(archiveFile);
      
      // Get file size
      const stats = await fs.stat(archiveFile);
      
      // Upload to S3 if configured
      const s3Key = await this.uploadToS3(archiveFile, backupId);
      
      // Create metadata
      const metadata = {
        backupId,
        timestamp: new Date().toISOString(),
        type: 'full',
        size: stats.size,
        checksum,
        encrypted: false,
        compressed: true,
        status: 'completed',
        duration: Date.now() - startTime,
        filePath: archiveFile,
        s3Key,
      };
      
      await this.saveMetadata(backupId, metadata);
      
      // Clean up individual files
      await fs.unlink(dbBackupFile);
      await fs.unlink(docBackupFile);
      await fs.unlink(configBackupFile);
      
      console.log(`\nBackup completed successfully!`);
      console.log(`Backup ID: ${backupId}`);
      console.log(`Duration: ${metadata.duration}ms`);
      console.log(`Size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Checksum: ${checksum}`);
      
      return metadata;
      
    } catch (error) {
      console.error(`\nBackup failed: ${error.message}`);
      process.exit(1);
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
      
      if (metadataFiles.length === 0) {
        console.log('No backups found');
        return;
      }
      
      console.log('\nAvailable Backups:');
      console.log('==================');
      
      for (const file of metadataFiles) {
        const metadataPath = path.join(this.backupDir, file);
        const content = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(content);
        
        console.log(`\nBackup ID: ${metadata.backupId}`);
        console.log(`Timestamp: ${metadata.timestamp}`);
        console.log(`Type: ${metadata.type}`);
        console.log(`Size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Status: ${metadata.status}`);
        console.log(`Duration: ${metadata.duration}ms`);
        if (metadata.s3Key) {
          console.log(`S3 Key: ${metadata.s3Key}`);
        }
      }
      
    } catch (error) {
      console.error('Failed to list backups:', error.message);
      process.exit(1);
    }
  }

  async restoreFromBackup(backupId) {
    console.log(`Starting restore from backup: ${backupId}`);
    
    try {
      // Find backup metadata
      const metadataFile = path.join(this.backupDir, `${backupId}.metadata.json`);
      
      try {
        await fs.access(metadataFile);
      } catch {
        console.error(`Backup not found: ${backupId}`);
        process.exit(1);
      }
      
      const content = await fs.readFile(metadataFile, 'utf-8');
      const metadata = JSON.parse(content);
      
      // Check if backup file exists locally
      let backupFile = metadata.filePath;
      
      try {
        await fs.access(backupFile);
      } catch {
        if (metadata.s3Key) {
          console.log('Downloading backup from S3...');
          backupFile = path.join(this.backupDir, `${backupId}.tar.gz`);
          
          await this.executeCommand('aws', [
            's3', 'cp',
            `s3://${CONFIG.S3_BUCKET}/${metadata.s3Key}`,
            backupFile,
            '--region', CONFIG.AWS_REGION
          ]);
        } else {
          console.error('Backup file not found locally and no S3 key available');
          process.exit(1);
        }
      }
      
      // Verify checksum
      console.log('Verifying backup integrity...');
      const actualChecksum = await this.calculateChecksum(backupFile);
      
      if (actualChecksum !== metadata.checksum) {
        console.error('Backup integrity check failed!');
        console.error(`Expected: ${metadata.checksum}`);
        console.error(`Actual: ${actualChecksum}`);
        process.exit(1);
      }
      
      console.log('Backup integrity verified');
      
      // Extract backup
      const extractDir = path.join(this.backupDir, `extract-${backupId}`);
      await fs.mkdir(extractDir, { recursive: true });
      
      console.log('Extracting backup...');
      await this.executeCommand('tar', [
        '-xzf', backupFile,
        '-C', extractDir
      ]);
      
      // Restore database
      console.log('Restoring database...');
      const dbFiles = await fs.readdir(extractDir);
      const dbFile = dbFiles.find(f => f.includes('-database.sql'));
      
      if (dbFile) {
        const dbBackupPath = path.join(extractDir, dbFile);
        
        await this.executeCommand('pg_restore', [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--dbname', CONFIG.DATABASE_URL,
          dbBackupPath
        ]);
        
        console.log('Database restored successfully');
      } else {
        console.warn('Database backup file not found in archive');
      }
      
      // Clean up extraction directory
      await this.executeCommand('rm', ['-rf', extractDir]);
      
      console.log(`\nRestore completed successfully from backup: ${backupId}`);
      
    } catch (error) {
      console.error(`Restore failed: ${error.message}`);
      process.exit(1);
    }
  }

  async cleanupOldBackups() {
    console.log('Cleaning up old backups...');
    
    try {
      const files = await fs.readdir(this.backupDir);
      const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CONFIG.RETENTION_DAYS);
      
      let deletedCount = 0;
      
      for (const file of metadataFiles) {
        const metadataPath = path.join(this.backupDir, file);
        const content = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(content);
        
        const backupDate = new Date(metadata.timestamp);
        
        if (backupDate < cutoffDate) {
          console.log(`Deleting old backup: ${metadata.backupId}`);
          
          // Delete local files
          try {
            await fs.unlink(metadata.filePath);
          } catch {
            // File might not exist
          }
          
          try {
            await fs.unlink(metadataPath);
          } catch {
            // File might not exist
          }
          
          // Delete from S3 if exists
          if (metadata.s3Key && CONFIG.S3_BUCKET) {
            try {
              await this.executeCommand('aws', [
                's3', 'rm',
                `s3://${CONFIG.S3_BUCKET}/${metadata.s3Key}`,
                '--region', CONFIG.AWS_REGION
              ], { silent: true });
            } catch {
              // S3 deletion might fail, continue
            }
          }
          
          deletedCount++;
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old backups`);
      
    } catch (error) {
      console.error('Cleanup failed:', error.message);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
LTET Backup Management CLI

Usage: node backup-management.js <command> [options]

Commands:
  create              Create a new full backup
  list                List all available backups
  restore <backupId>  Restore from a specific backup
  cleanup             Remove old backups based on retention policy
  help                Show this help message

Environment Variables:
  DATABASE_URL              PostgreSQL connection string
  BACKUP_DIR               Directory to store backups (default: ./backups)
  BACKUP_S3_BUCKET         S3 bucket for backup storage (optional)
  AWS_REGION               AWS region (default: ap-south-1)
  BACKUP_RETENTION_DAYS    Days to keep backups (default: 30)
  DOCUMENTS_DIR            Directory containing documents to backup

Examples:
  node backup-management.js create
  node backup-management.js list
  node backup-management.js restore backup-2024-01-09T10-30-00-000Z-abc123
  node backup-management.js cleanup
`);
  }
}

// Main execution
async function main() {
  const cli = new BackupCLI();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'create':
      await cli.createFullBackup();
      break;
    
    case 'list':
      await cli.listBackups();
      break;
    
    case 'restore':
      if (args.length === 0) {
        console.error('Error: Backup ID required for restore command');
        process.exit(1);
      }
      await cli.restoreFromBackup(args[0]);
      break;
    
    case 'cleanup':
      await cli.cleanupOldBackups();
      break;
    
    case 'help':
    case '--help':
    case '-h':
      cli.showHelp();
      break;
    
    default:
      console.error(`Error: Unknown command '${command}'`);
      cli.showHelp();
      process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('CLI Error:', error.message);
    process.exit(1);
  });
}

module.exports = BackupCLI;