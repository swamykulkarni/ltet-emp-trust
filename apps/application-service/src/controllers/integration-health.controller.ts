import { Request, Response } from 'express';
import { IntegrationHealthService } from '../services/integration-health.service';

export class IntegrationHealthController {
  private healthService: IntegrationHealthService;

  constructor() {
    this.healthService = new IntegrationHealthService();
  }

  /**
   * Get current integration health status
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.healthService.getCurrentHealth();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error: any) {
      console.error('Error getting health status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status'
      });
    }
  }

  /**
   * Get health metrics over time
   */
  async getHealthMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { hours = '24' } = req.query;
      const hoursNum = parseInt(hours as string, 10);
      
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) { // Max 1 week
        res.status(400).json({
          success: false,
          error: 'Hours must be a number between 1 and 168'
        });
        return;
      }

      const metrics = this.healthService.getHealthMetrics(hoursNum);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      console.error('Error getting health metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health metrics'
      });
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = this.healthService.getActiveAlerts();
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error: any) {
      console.error('Error getting active alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active alerts'
      });
    }
  }

  /**
   * Get all alerts (including resolved)
   */
  async getAllAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '100' } = req.query;
      const limitNum = parseInt(limit as string, 10);
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        res.status(400).json({
          success: false,
          error: 'Limit must be a number between 1 and 1000'
        });
        return;
      }

      const alerts = this.healthService.getAllAlerts(limitNum);
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error: any) {
      console.error('Error getting all alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts'
      });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertIndex } = req.params;
      const index = parseInt(alertIndex, 10);
      
      if (isNaN(index) || index < 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid alert index'
        });
        return;
      }

      const resolved = this.healthService.resolveAlert(index);
      
      if (resolved) {
        res.json({
          success: true,
          message: 'Alert resolved successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert'
      });
    }
  }

  /**
   * Get health history
   */
  async getHealthHistory(req: Request, res: Response): Promise<void> {
    try {
      const { hours = '24' } = req.query;
      const hoursNum = parseInt(hours as string, 10);
      
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) { // Max 1 week
        res.status(400).json({
          success: false,
          error: 'Hours must be a number between 1 and 168'
        });
        return;
      }

      const history = this.healthService.getHealthHistory(hoursNum);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      console.error('Error getting health history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health history'
      });
    }
  }

  /**
   * Test integration connectivity
   */
  async testConnectivity(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.healthService.testConnectivity();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error testing connectivity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test connectivity'
      });
    }
  }
}