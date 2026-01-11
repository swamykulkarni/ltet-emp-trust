import { Request, Response } from 'express';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';

export class ApprovalWorkflowController {
  private approvalWorkflowService: ApprovalWorkflowService;

  constructor() {
    this.approvalWorkflowService = new ApprovalWorkflowService();
  }

  assignApprover = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      
      const approverId = await this.approvalWorkflowService.assignApprover(applicationId);

      res.json({
        success: true,
        data: { approverId },
        message: 'Approver assigned successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to assign approver'
      });
    }
  };

  processConditionalApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { approverId, approvedAmount, conditions } = req.body;

      if (!approverId || !approvedAmount || !conditions) {
        res.status(400).json({
          error: 'approverId, approvedAmount, and conditions are required'
        });
        return;
      }

      if (!Array.isArray(conditions)) {
        res.status(400).json({
          error: 'conditions must be an array'
        });
        return;
      }

      const application = await this.approvalWorkflowService.processConditionalApproval(
        applicationId,
        approverId,
        approvedAmount,
        conditions
      );

      res.json({
        success: true,
        data: application,
        message: 'Conditional approval processed successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to process conditional approval'
      });
    }
  };

  getSLAViolations = async (req: Request, res: Response): Promise<void> => {
    try {
      const violations = await this.approvalWorkflowService.checkSLAViolations();

      res.json({
        success: true,
        data: violations,
        count: violations.length,
        message: `Found ${violations.length} SLA violations`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check SLA violations'
      });
    }
  };

  escalateApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      
      const application = await this.approvalWorkflowService.escalateApplication(applicationId);

      res.json({
        success: true,
        data: application,
        message: 'Application escalated successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to escalate application'
      });
    }
  };

  getApproverWorkload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { approverId } = req.params;
      
      const workload = await this.approvalWorkflowService.getApproverWorkload(approverId);

      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get approver workload'
      });
    }
  };

  bulkEscalateViolations = async (req: Request, res: Response): Promise<void> => {
    try {
      const escalatedApplications = await this.approvalWorkflowService.bulkEscalateViolations();

      res.json({
        success: true,
        data: escalatedApplications,
        count: escalatedApplications.length,
        message: `Escalated ${escalatedApplications.length} applications`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to bulk escalate violations'
      });
    }
  };
}