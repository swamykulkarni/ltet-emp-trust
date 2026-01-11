import { Request, Response } from 'express';
import { ApplicationService } from '../services/application.service';
import { ApprovalAction } from '../models/application.model';

export class ApplicationController {
  private applicationService: ApplicationService;

  constructor() {
    this.applicationService = new ApplicationService();
  }

  // Application management endpoints
  createApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, schemeId, claimAmount, purpose, beneficiary, customFields, documents } = req.body;

      if (!userId || !schemeId || !claimAmount || !purpose || !beneficiary) {
        res.status(400).json({
          error: 'Missing required fields: userId, schemeId, claimAmount, purpose, beneficiary'
        });
        return;
      }

      const application = await this.applicationService.createApplication({
        userId,
        schemeId,
        claimAmount,
        purpose,
        beneficiary,
        customFields,
        documents
      });

      res.status(201).json({
        success: true,
        data: application
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const application = await this.applicationService.getApplicationById(id);

      if (!application) {
        res.status(404).json({
          error: 'Application not found'
        });
        return;
      }

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getUserApplications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const applications = await this.applicationService.getApplicationsByUserId(userId);

      res.json({
        success: true,
        data: applications
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  submitApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          error: 'userId is required'
        });
        return;
      }

      const application = await this.applicationService.submitApplication(id, userId);

      res.json({
        success: true,
        data: application,
        message: 'Application submitted successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to submit application'
      });
    }
  };

  // Approval workflow endpoints
  approveApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { approverId, comments } = req.body;

      if (!approverId || !comments) {
        res.status(400).json({
          error: 'approverId and comments are required'
        });
        return;
      }

      const application = await this.applicationService.processApprovalAction(
        id, 
        approverId, 
        'approve', 
        comments
      );

      res.json({
        success: true,
        data: application,
        message: 'Application approved successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to approve application'
      });
    }
  };

  rejectApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { approverId, comments } = req.body;

      if (!approverId || !comments) {
        res.status(400).json({
          error: 'approverId and comments are required'
        });
        return;
      }

      const application = await this.applicationService.processApprovalAction(
        id, 
        approverId, 
        'reject', 
        comments
      );

      res.json({
        success: true,
        data: application,
        message: 'Application rejected'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reject application'
      });
    }
  };

  requestClarification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { approverId, comments } = req.body;

      if (!approverId || !comments) {
        res.status(400).json({
          error: 'approverId and comments are required'
        });
        return;
      }

      const application = await this.applicationService.processApprovalAction(
        id, 
        approverId, 
        'clarify', 
        comments
      );

      res.json({
        success: true,
        data: application,
        message: 'Clarification requested'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to request clarification'
      });
    }
  };

  getApplicationsByStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.params;
      const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed'];
      
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
        });
        return;
      }

      const applications = await this.applicationService.getApplicationsByStatus(status as any);

      res.json({
        success: true,
        data: applications
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  // Draft management endpoints
  saveDraft = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, schemeId, applicationData, documents } = req.body;

      if (!userId || !schemeId) {
        res.status(400).json({
          error: 'userId and schemeId are required'
        });
        return;
      }

      const draft = await this.applicationService.saveDraft({
        userId,
        schemeId,
        applicationData: applicationData || {},
        documents
      });

      res.status(201).json({
        success: true,
        data: draft,
        message: 'Draft saved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save draft'
      });
    }
  };

  updateDraft = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, applicationData, documents } = req.body;

      if (!userId) {
        res.status(400).json({
          error: 'userId is required'
        });
        return;
      }

      const draft = await this.applicationService.updateDraft(id, userId, {
        applicationData,
        documents
      });

      res.json({
        success: true,
        data: draft,
        message: 'Draft updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update draft'
      });
    }
  };

  getUserDrafts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const drafts = await this.applicationService.getDraftsByUserId(userId);

      res.json({
        success: true,
        data: drafts
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  convertDraftToApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          error: 'userId is required'
        });
        return;
      }

      const application = await this.applicationService.convertDraftToApplication(id, userId);

      res.json({
        success: true,
        data: application,
        message: 'Draft converted to application successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to convert draft'
      });
    }
  };

  deleteDraft = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          error: 'userId is required'
        });
        return;
      }

      const deleted = await this.applicationService.deleteDraft(id, userId);

      if (!deleted) {
        res.status(404).json({
          error: 'Draft not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Draft deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete draft'
      });
    }
  };

  // SLA and escalation endpoints
  getSLAViolations = async (req: Request, res: Response): Promise<void> => {
    try {
      const violations = await this.applicationService.checkSLAViolations();

      res.json({
        success: true,
        data: violations,
        count: violations.length
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  escalateApplication = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const application = await this.applicationService.escalateApplication(id);

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

  // AI-Powered Risk Scoring and Automated Approval Endpoints

  calculateRiskScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { documentAnalysis } = req.body;

      const riskScore = await this.applicationService.calculateApplicationRiskScore(
        id,
        documentAnalysis
      );

      res.json({
        success: true,
        data: riskScore,
        message: 'Risk score calculated successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to calculate risk score'
      });
    }
  };

  predictSLABreach = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { currentWorkload } = req.query;

      const prediction = await this.applicationService.predictSLABreach(
        id,
        currentWorkload ? parseInt(currentWorkload as string) : undefined
      );

      res.json({
        success: true,
        data: prediction,
        message: 'SLA breach prediction completed'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to predict SLA breach'
      });
    }
  };

  getApplicationsAtRisk = async (req: Request, res: Response): Promise<void> => {
    try {
      const atRiskApplications = await this.applicationService.getApplicationsAtRiskOfSLABreach();

      res.json({
        success: true,
        data: atRiskApplications,
        count: atRiskApplications.length,
        message: 'At-risk applications retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get at-risk applications'
      });
    }
  };

  simulateAutoApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const simulation = await this.applicationService.simulateAutoApproval(id);

      res.json({
        success: true,
        data: simulation,
        message: 'Auto-approval simulation completed'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to simulate auto-approval'
      });
    }
  };

  getAutoApprovalStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const statistics = await this.applicationService.getAutoApprovalStatistics();

      res.json({
        success: true,
        data: statistics,
        message: 'Auto-approval statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get auto-approval statistics'
      });
    }
  };

  getRiskScoringAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const analytics = await this.applicationService.getRiskScoringAnalytics();

      res.json({
        success: true,
        data: analytics,
        message: 'Risk scoring analytics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get risk scoring analytics'
      });
    }
  };

  // Auto-approval rule management endpoints

  getAutoApprovalRules = async (req: Request, res: Response): Promise<void> => {
    try {
      const rules = this.applicationService.getAutoApprovalRules();

      res.json({
        success: true,
        data: rules,
        message: 'Auto-approval rules retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get auto-approval rules'
      });
    }
  };

  addAutoApprovalRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const rule = req.body;

      if (!rule.id || !rule.name || !rule.conditions || !rule.actions) {
        res.status(400).json({
          error: 'Invalid rule format. Required fields: id, name, conditions, actions'
        });
        return;
      }

      this.applicationService.addAutoApprovalRule(rule);

      res.json({
        success: true,
        message: 'Auto-approval rule added successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add auto-approval rule'
      });
    }
  };

  removeAutoApprovalRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;

      const removed = this.applicationService.removeAutoApprovalRule(ruleId);

      if (!removed) {
        res.status(404).json({
          error: 'Auto-approval rule not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Auto-approval rule removed successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to remove auto-approval rule'
      });
    }
  };

  toggleAutoApprovalRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ruleId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          error: 'enabled field must be a boolean'
        });
        return;
      }

      const updated = this.applicationService.toggleAutoApprovalRule(ruleId, enabled);

      if (!updated) {
        res.status(404).json({
          error: 'Auto-approval rule not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Auto-approval rule ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to toggle auto-approval rule'
      });
    }
  };

  updateAutoApprovalConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = req.body;

      this.applicationService.updateAutoApprovalConfig(config);

      res.json({
        success: true,
        message: 'Auto-approval configuration updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update auto-approval configuration'
      });
    }
  };
}