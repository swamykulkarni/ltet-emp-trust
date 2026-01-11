import { HRMSService, HRMSEmployeeData, HRMSServiceResult } from './hrms.service';
import { UserRepository } from '../repositories/user.repository';
import { environment } from '../environments/environment';
import cron from 'node-cron';

export interface SyncJobResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export interface HRMSAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
}

export class HRMSIntegrationService {
  private hrmsService: HRMSService;
  private userRepository: UserRepository;
  private authConfig: HRMSAuthConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private syncJobRunning = false;
  private lastSyncTime?: Date;

  constructor(userRepository: UserRepository) {
    this.hrmsService = new HRMSService();
    this.userRepository = userRepository;
    this.authConfig = {
      clientId: environment.hrms.clientId || '',
      clientSecret: environment.hrms.clientSecret || '',
      tokenUrl: environment.hrms.tokenUrl || '',
      scope: environment.hrms.scope || 'employee:read'
    };
    
    this.initializeScheduledJobs();
  }

  /**
   * Initialize scheduled batch synchronization jobs
   */
  private initializeScheduledJobs(): void {
    // Daily sync at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Starting scheduled HRMS batch synchronization...');
      await this.performBatchSync();
    });

    // Weekly full sync on Sundays at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      console.log('Starting scheduled HRMS full synchronization...');
      await this.performFullSync();
    });

    console.log('HRMS integration scheduled jobs initialized');
  }

  /**
   * Authenticate with HRMS API using OAuth2 client credentials flow
   */
  private async authenticate(): Promise<boolean> {
    try {
      // Check if current token is still valid
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return true;
      }

      const response = await fetch(this.authConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.authConfig.clientId}:${this.authConfig.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: this.authConfig.scope || 'employee:read'
        })
      });

      if (!response.ok) {
        console.error(`HRMS authentication failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      
      // Set token expiry (subtract 5 minutes for safety)
      const expiresIn = tokenData.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);

      console.log('HRMS authentication successful');
      return true;
    } catch (error: any) {
      console.error('HRMS authentication error:', error.message);
      return false;
    }
  }

  /**
   * Get authenticated HRMS service instance
   */
  private async getAuthenticatedHRMSService(): Promise<HRMSService | null> {
    const authenticated = await this.authenticate();
    if (!authenticated) {
      return null;
    }

    // Update the HRMS service with the current access token
    (this.hrmsService as any).apiKey = this.accessToken;
    return this.hrmsService;
  }

  /**
   * Real-time employee data lookup with caching
   */
  async lookupEmployeeData(employeeId: string, useCache = true): Promise<HRMSServiceResult<HRMSEmployeeData>> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cachedData = await this.getCachedEmployeeData(employeeId);
        if (cachedData) {
          return {
            success: true,
            data: cachedData
          };
        }
      }

      const hrmsService = await this.getAuthenticatedHRMSService();
      if (!hrmsService) {
        return {
          success: false,
          error: 'Failed to authenticate with HRMS'
        };
      }

      const result = await hrmsService.getEmployeeData(employeeId);
      
      // Cache successful results
      if (result.success && result.data) {
        await this.cacheEmployeeData(employeeId, result.data);
      }

      return result;
    } catch (error: any) {
      console.error(`Error looking up employee ${employeeId}:`, error.message);
      return {
        success: false,
        error: error.message || 'Failed to lookup employee data'
      };
    }
  }

  /**
   * Perform batch synchronization for recently updated employees
   */
  async performBatchSync(): Promise<SyncJobResult> {
    if (this.syncJobRunning) {
      throw new Error('Sync job is already running');
    }

    this.syncJobRunning = true;
    const startTime = new Date();
    const result: SyncJobResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      startTime,
      endTime: new Date()
    };

    try {
      console.log('Starting HRMS batch synchronization...');

      // Get list of employees that need synchronization
      const employeesToSync = await this.getEmployeesForSync();
      result.totalProcessed = employeesToSync.length;

      if (employeesToSync.length === 0) {
        console.log('No employees need synchronization');
        return result;
      }

      const hrmsService = await this.getAuthenticatedHRMSService();
      if (!hrmsService) {
        result.errors.push('Failed to authenticate with HRMS');
        return result;
      }

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < employeesToSync.length; i += batchSize) {
        const batch = employeesToSync.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, hrmsService);
        
        result.successful += batchResult.successful;
        result.failed += batchResult.failed;
        result.errors.push(...batchResult.errors);
      }

      this.lastSyncTime = new Date();
      console.log(`Batch sync completed: ${result.successful} successful, ${result.failed} failed`);

    } catch (error: any) {
      console.error('Batch sync error:', error.message);
      result.errors.push(error.message);
    } finally {
      this.syncJobRunning = false;
      result.endTime = new Date();
    }

    return result;
  }

  /**
   * Perform full synchronization of all employees
   */
  async performFullSync(): Promise<SyncJobResult> {
    if (this.syncJobRunning) {
      throw new Error('Sync job is already running');
    }

    this.syncJobRunning = true;
    const startTime = new Date();
    const result: SyncJobResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      startTime,
      endTime: new Date()
    };

    try {
      console.log('Starting HRMS full synchronization...');

      // Get all employees from local database
      const allEmployees = await this.userRepository.getAllEmployeeIds();
      result.totalProcessed = allEmployees.length;

      const hrmsService = await this.getAuthenticatedHRMSService();
      if (!hrmsService) {
        result.errors.push('Failed to authenticate with HRMS');
        return result;
      }

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < allEmployees.length; i += batchSize) {
        const batch = allEmployees.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, hrmsService);
        
        result.successful += batchResult.successful;
        result.failed += batchResult.failed;
        result.errors.push(...batchResult.errors);
      }

      this.lastSyncTime = new Date();
      console.log(`Full sync completed: ${result.successful} successful, ${result.failed} failed`);

    } catch (error: any) {
      console.error('Full sync error:', error.message);
      result.errors.push(error.message);
    } finally {
      this.syncJobRunning = false;
      result.endTime = new Date();
    }

    return result;
  }

  /**
   * Process a batch of employee IDs
   */
  private async processBatch(employeeIds: string[], hrmsService: HRMSService): Promise<{ successful: number; failed: number; errors: string[] }> {
    const result = { successful: 0, failed: 0, errors: [] as string[] };

    try {
      const batchResult = await hrmsService.syncEmployeeBatch(employeeIds);
      
      if (batchResult.success && batchResult.data) {
        // Update local database with HRMS data
        for (const employeeData of batchResult.data) {
          try {
            await this.updateLocalEmployeeData(employeeData);
            await this.cacheEmployeeData(employeeData.employeeId, employeeData);
            result.successful++;
          } catch (error: any) {
            result.failed++;
            result.errors.push(`Failed to update employee ${employeeData.employeeId}: ${error.message}`);
          }
        }
      } else {
        result.failed += employeeIds.length;
        result.errors.push(batchResult.error || 'Batch sync failed');
      }
    } catch (error: any) {
      result.failed += employeeIds.length;
      result.errors.push(`Batch processing error: ${error.message}`);
    }

    return result;
  }

  /**
   * Get employees that need synchronization
   */
  private async getEmployeesForSync(): Promise<string[]> {
    // Get employees that haven't been synced in the last 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await this.userRepository.getEmployeesNeedingSync(cutoffTime);
  }

  /**
   * Update local employee data with HRMS data
   */
  private async updateLocalEmployeeData(hrmsData: HRMSEmployeeData): Promise<void> {
    await this.userRepository.updateEmployeeFromHRMS(hrmsData);
  }

  /**
   * Cache employee data in Redis
   */
  private async cacheEmployeeData(employeeId: string, data: HRMSEmployeeData): Promise<void> {
    // Implementation would use Redis client to cache data
    // For now, this is a placeholder
    console.log(`Caching employee data for ${employeeId}`);
  }

  /**
   * Get cached employee data from Redis
   */
  private async getCachedEmployeeData(employeeId: string): Promise<HRMSEmployeeData | null> {
    // Implementation would use Redis client to retrieve cached data
    // For now, this is a placeholder
    return null;
  }

  /**
   * Get sync job status
   */
  getSyncStatus(): { running: boolean; lastSyncTime?: Date } {
    return {
      running: this.syncJobRunning,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Manually trigger batch sync
   */
  async triggerBatchSync(): Promise<SyncJobResult> {
    return await this.performBatchSync();
  }

  /**
   * Manually trigger full sync
   */
  async triggerFullSync(): Promise<SyncJobResult> {
    return await this.performFullSync();
  }

  /**
   * Validate HRMS connectivity
   */
  async validateConnectivity(): Promise<{ connected: boolean; error?: string }> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { connected: false, error: 'Authentication failed' };
      }

      // Try a simple API call to validate connectivity
      const testResult = await this.hrmsService.validateEmployee('test');
      return { connected: true };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }
}