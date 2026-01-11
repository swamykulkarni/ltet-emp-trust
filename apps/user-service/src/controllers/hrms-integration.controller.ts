import { Request, Response } from 'express';
import { HRMSIntegrationService } from '../services/hrms-integration.service';
import { UserRepository } from '../repositories/user.repository';

export class HRMSIntegrationController {
  private hrmsIntegrationService: HRMSIntegrationService;

  constructor() {
    const userRepository = new UserRepository();
    this.hrmsIntegrationService = new HRMSIntegrationService(userRepository);
  }

  /**
   * Get employee data from HRMS
   */
  async getEmployeeData(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = req.params;
      const { useCache = 'true' } = req.query;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          error: 'Employee ID is required'
        });
        return;
      }

      const result = await this.hrmsIntegrationService.lookupEmployeeData(
        employeeId,
        useCache === 'true'
      );

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      console.error('Error in getEmployeeData:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Trigger batch synchronization
   */
  async triggerBatchSync(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.hrmsIntegrationService.triggerBatchSync();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error in triggerBatchSync:', error);
      
      if (error.message.includes('already running')) {
        res.status(409).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to trigger batch sync'
        });
      }
    }
  }

  /**
   * Trigger full synchronization
   */
  async triggerFullSync(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.hrmsIntegrationService.triggerFullSync();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error in triggerFullSync:', error);
      
      if (error.message.includes('already running')) {
        res.status(409).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to trigger full sync'
        });
      }
    }
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.hrmsIntegrationService.getSyncStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error: any) {
      console.error('Error in getSyncStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status'
      });
    }
  }

  /**
   * Validate HRMS connectivity
   */
  async validateConnectivity(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.hrmsIntegrationService.validateConnectivity();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error in validateConnectivity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate connectivity'
      });
    }
  }
}