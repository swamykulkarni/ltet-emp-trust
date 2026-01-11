import { ApplicationRepository } from '../repositories/application.repository';
import { RiskScoringService } from './risk-scoring.service';
import { AutomatedApprovalService } from './automated-approval.service';
import { 
  Application, 
  ApplicationDraft, 
  ApplicationStatus, 
  ApprovalAction,
  ApprovalHistoryEntry,
  AuditTrailEntry,
  isValidStateTransition 
} from '../models/application.model';

export class ApplicationService {
  private applicationRepository: ApplicationRepository;
  private riskScoringService: RiskScoringService;
  private automatedApprovalService: AutomatedApprovalService;

  constructor() {
    this.applicationRepository = new ApplicationRepository();
    this.riskScoringService = new RiskScoringService();
    this.automatedApprovalService = new AutomatedApprovalService();
  }

  async createApplication(applicationData: {
    userId: string;
    schemeId: string;
    claimAmount: number;
    purpose: string;
    beneficiary: string;
    customFields?: Record<string, any>;
    documents?: any[];
  }): Promise<Application> {
    const application: Omit<Application, 'applicationId' | 'createdAt' | 'updatedAt'> = {
      userId: applicationData.userId,
      schemeId: applicationData.schemeId,
      applicationData: {
        claimAmount: applicationData.claimAmount,
        purpose: applicationData.purpose,
        beneficiary: applicationData.beneficiary,
        customFields: applicationData.customFields || {}
      },
      documents: applicationData.documents || [],
      workflow: {
        currentStatus: 'draft',
        approvalHistory: [],
        slaDeadline: this.calculateSLADeadline(),
        escalationLevel: 0
      },
      auditTrail: [{
        action: 'application_created',
        userId: applicationData.userId,
        timestamp: new Date(),
        details: { status: 'draft' }
      }]
    };

    return await this.applicationRepository.createApplication(application);
  }

  async submitApplication(applicationId: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.userId !== userId) {
      throw new Error('Unauthorized access to application');
    }

    if (!isValidStateTransition(application.workflow.currentStatus, 'submitted')) {
      throw new Error(`Cannot submit application from status: ${application.workflow.currentStatus}`);
    }

    // Validate application completeness
    this.validateApplicationForSubmission(application);

    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: 'submitted' as ApplicationStatus,
      slaDeadline: this.calculateSLADeadline()
    };

    const auditEntry: AuditTrailEntry = {
      action: 'application_submitted',
      userId: userId,
      timestamp: new Date(),
      details: { previousStatus: application.workflow.currentStatus }
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to update application');
    }

    // Trigger AI-powered risk assessment and auto-approval evaluation
    await this.evaluateForAutoApproval(updatedApplication);

    return updatedApplication;
  }

  async processApprovalAction(
    applicationId: string, 
    approverId: string, 
    action: ApprovalAction, 
    comments: string
  ): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    let newStatus: ApplicationStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'clarify':
        newStatus = 'submitted'; // Return to submitted for clarification
        break;
      default:
        throw new Error(`Invalid approval action: ${action}`);
    }

    if (!isValidStateTransition(application.workflow.currentStatus, newStatus)) {
      throw new Error(`Cannot transition from ${application.workflow.currentStatus} to ${newStatus}`);
    }

    const approvalEntry: ApprovalHistoryEntry = {
      approverId,
      action,
      comments,
      timestamp: new Date()
    };

    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: newStatus,
      approvalHistory: [...application.workflow.approvalHistory, approvalEntry],
      slaDeadline: action === 'clarify' ? this.calculateSLADeadline() : application.workflow.slaDeadline
    };

    const auditEntry: AuditTrailEntry = {
      action: `application_${action}`,
      userId: approverId,
      timestamp: new Date(),
      details: { 
        previousStatus: application.workflow.currentStatus,
        comments,
        action
      }
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to update application');
    }

    return updatedApplication;
  }

  async getApplicationById(applicationId: string): Promise<Application | null> {
    return await this.applicationRepository.getApplicationById(applicationId);
  }

  async getApplicationsByUserId(userId: string): Promise<Application[]> {
    return await this.applicationRepository.getApplicationsByUserId(userId);
  }

  async getApplicationsByStatus(status: ApplicationStatus): Promise<Application[]> {
    return await this.applicationRepository.getApplicationsByStatus(status);
  }

  // Draft management methods
  async saveDraft(draftData: {
    userId: string;
    schemeId: string;
    applicationData: Partial<Application['applicationData']>;
    documents?: any[];
  }): Promise<ApplicationDraft> {
    const draft: Omit<ApplicationDraft, 'draftId' | 'createdAt' | 'updatedAt'> = {
      userId: draftData.userId,
      schemeId: draftData.schemeId,
      applicationData: draftData.applicationData,
      documents: draftData.documents || []
    };

    return await this.applicationRepository.createDraft(draft);
  }

  async updateDraft(draftId: string, userId: string, updates: {
    applicationData?: Partial<Application['applicationData']>;
    documents?: any[];
  }): Promise<ApplicationDraft> {
    const existingDraft = await this.applicationRepository.getDraftById(draftId);
    if (!existingDraft) {
      throw new Error('Draft not found');
    }

    if (existingDraft.userId !== userId) {
      throw new Error('Unauthorized access to draft');
    }

    const updatedDraft = await this.applicationRepository.updateDraft(draftId, {
      applicationData: updates.applicationData ? 
        { ...existingDraft.applicationData, ...updates.applicationData } : 
        existingDraft.applicationData,
      documents: updates.documents || existingDraft.documents
    });

    if (!updatedDraft) {
      throw new Error('Failed to update draft');
    }

    return updatedDraft;
  }

  async getDraftsByUserId(userId: string): Promise<ApplicationDraft[]> {
    return await this.applicationRepository.getDraftsByUserId(userId);
  }

  async convertDraftToApplication(draftId: string, userId: string): Promise<Application> {
    const draft = await this.applicationRepository.getDraftById(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.userId !== userId) {
      throw new Error('Unauthorized access to draft');
    }

    // Validate draft completeness
    if (!draft.applicationData.claimAmount || !draft.applicationData.purpose || !draft.applicationData.beneficiary) {
      throw new Error('Draft is incomplete. Missing required fields.');
    }

    const application = await this.createApplication({
      userId: draft.userId,
      schemeId: draft.schemeId,
      claimAmount: draft.applicationData.claimAmount!,
      purpose: draft.applicationData.purpose!,
      beneficiary: draft.applicationData.beneficiary!,
      customFields: draft.applicationData.customFields,
      documents: draft.documents
    });

    // Delete the draft after successful conversion
    await this.applicationRepository.deleteDraft(draftId);

    return application;
  }

  async deleteDraft(draftId: string, userId: string): Promise<boolean> {
    const draft = await this.applicationRepository.getDraftById(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.userId !== userId) {
      throw new Error('Unauthorized access to draft');
    }

    return await this.applicationRepository.deleteDraft(draftId);
  }

  // Helper methods
  private calculateSLADeadline(): Date {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 7 days SLA
    return deadline;
  }

  private validateApplicationForSubmission(application: Application): void {
    if (!application.applicationData.claimAmount || application.applicationData.claimAmount <= 0) {
      throw new Error('Valid claim amount is required');
    }

    if (!application.applicationData.purpose?.trim()) {
      throw new Error('Purpose is required');
    }

    if (!application.applicationData.beneficiary?.trim()) {
      throw new Error('Beneficiary is required');
    }

    if (!application.documents || application.documents.length === 0) {
      throw new Error('At least one document is required');
    }

    // Validate all documents are validated
    const invalidDocuments = application.documents.filter(doc => doc.validationStatus !== 'validated');
    if (invalidDocuments.length > 0) {
      throw new Error('All documents must be validated before submission');
    }
  }

  async checkSLAViolations(): Promise<Application[]> {
    const now = new Date();
    const applications = await this.applicationRepository.getApplicationsByStatus('under_review');
    
    return applications.filter(app => 
      app.workflow.slaDeadline < now && 
      app.workflow.escalationLevel < 3 // Max escalation levels
    );
  }

  async escalateApplication(applicationId: string): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const updatedWorkflow = {
      ...application.workflow,
      escalationLevel: application.workflow.escalationLevel + 1,
      slaDeadline: this.calculateSLADeadline() // Reset SLA for escalated level
    };

    const auditEntry: AuditTrailEntry = {
      action: 'application_escalated',
      userId: 'system',
      timestamp: new Date(),
      details: { 
        escalationLevel: updatedWorkflow.escalationLevel,
        reason: 'SLA violation'
      }
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to escalate application');
    }

    return updatedApplication;
  }

  // AI-Powered Risk Scoring and Automated Approval Methods

  /**
   * Evaluate application for automated approval using AI risk scoring
   */
  async evaluateForAutoApproval(application: Application): Promise<void> {
    try {
      // TODO: Get user and scheme data from respective services
      const user = await this.getUserData(application.userId);
      const scheme = await this.getSchemeData(application.schemeId);
      
      if (!user || !scheme) {
        console.log(`Skipping auto-approval evaluation - missing user or scheme data for application ${application.applicationId}`);
        return;
      }

      // Evaluate for auto-approval
      const autoApprovalDecision = await this.automatedApprovalService.evaluateForAutoApproval(
        application,
        user,
        scheme
      );

      // If approved, execute the auto-approval
      if (autoApprovalDecision.approved) {
        await this.automatedApprovalService.executeAutoApproval(
          application.applicationId,
          autoApprovalDecision
        );
        
        console.log(`Application ${application.applicationId} auto-approved: ${autoApprovalDecision.reason}`);
      } else {
        // Log the decision for analytics
        console.log(`Application ${application.applicationId} not auto-approved: ${autoApprovalDecision.reason}`);
        
        // If high risk, escalate immediately
        if (autoApprovalDecision.escalationLevel && autoApprovalDecision.escalationLevel > 0) {
          await this.escalateApplication(application.applicationId);
        }
      }
    } catch (error) {
      console.error(`Error in auto-approval evaluation for application ${application.applicationId}:`, error);
    }
  }

  /**
   * Calculate risk score for an application
   */
  async calculateApplicationRiskScore(
    applicationId: string,
    documentAnalysis?: any
  ): Promise<any> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const user = await this.getUserData(application.userId);
    const scheme = await this.getSchemeData(application.schemeId);

    if (!user || !scheme) {
      throw new Error('Unable to retrieve user or scheme data for risk assessment');
    }

    return await this.riskScoringService.calculateRiskScore(
      application,
      user,
      scheme,
      documentAnalysis
    );
  }

  /**
   * Predict SLA breach probability for an application
   */
  async predictSLABreach(applicationId: string, currentWorkload?: number): Promise<any> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const scheme = await this.getSchemeData(application.schemeId);
    if (!scheme) {
      throw new Error('Unable to retrieve scheme data for SLA prediction');
    }

    return await this.riskScoringService.predictSLABreach(
      application,
      scheme,
      currentWorkload
    );
  }

  /**
   * Get applications at risk of SLA breach
   */
  async getApplicationsAtRiskOfSLABreach(): Promise<Array<{
    application: Application;
    breachPrediction: any;
  }>> {
    const applications = await this.applicationRepository.getApplicationsByStatus('under_review');
    const atRiskApplications = [];

    for (const application of applications) {
      try {
        const breachPrediction = await this.predictSLABreach(application.applicationId);
        
        if (breachPrediction.probabilityOfBreach > 0.5) {
          atRiskApplications.push({
            application,
            breachPrediction
          });
        }
      } catch (error) {
        console.error(`Error predicting SLA breach for application ${application.applicationId}:`, error);
      }
    }

    return atRiskApplications.sort((a, b) => 
      b.breachPrediction.probabilityOfBreach - a.breachPrediction.probabilityOfBreach
    );
  }

  /**
   * Get auto-approval statistics
   */
  async getAutoApprovalStatistics(): Promise<any> {
    return await this.automatedApprovalService.getAutoApprovalStatistics();
  }

  /**
   * Get risk scoring analytics
   */
  async getRiskScoringAnalytics(): Promise<any> {
    return await this.riskScoringService.getRiskScoringAnalytics();
  }

  /**
   * Simulate auto-approval for testing purposes
   */
  async simulateAutoApproval(applicationId: string): Promise<any> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const user = await this.getUserData(application.userId);
    const scheme = await this.getSchemeData(application.schemeId);

    if (!user || !scheme) {
      throw new Error('Unable to retrieve user or scheme data for simulation');
    }

    return await this.automatedApprovalService.simulateAutoApproval(
      application,
      user,
      scheme
    );
  }

  /**
   * Update auto-approval configuration
   */
  updateAutoApprovalConfig(config: any): void {
    this.riskScoringService.updateAutoApprovalConfig(config);
  }

  /**
   * Get auto-approval rules
   */
  getAutoApprovalRules(): any[] {
    return this.automatedApprovalService.getAutoApprovalRules();
  }

  /**
   * Add or update auto-approval rule
   */
  addAutoApprovalRule(rule: any): void {
    this.automatedApprovalService.addAutoApprovalRule(rule);
  }

  /**
   * Remove auto-approval rule
   */
  removeAutoApprovalRule(ruleId: string): boolean {
    return this.automatedApprovalService.removeAutoApprovalRule(ruleId);
  }

  /**
   * Toggle auto-approval rule
   */
  toggleAutoApprovalRule(ruleId: string, enabled: boolean): boolean {
    return this.automatedApprovalService.toggleAutoApprovalRule(ruleId, enabled);
  }

  // Helper methods for AI services

  /**
   * Get user data from user service
   */
  private async getUserData(userId: string): Promise<any> {
    // TODO: Integrate with user service
    // For now, return mock data
    return {
      userId,
      employmentInfo: {
        department: 'Engineering',
        ic: 'LTTS',
        joiningDate: '2020-01-01',
        salary: 800000,
        status: 'active'
      },
      personalInfo: {
        name: 'John Doe',
        email: 'john.doe@lnt.com'
      }
    };
  }

  /**
   * Get scheme data from scheme service
   */
  private async getSchemeData(schemeId: string): Promise<any> {
    // TODO: Integrate with scheme service
    // For now, return mock data
    return {
      id: schemeId,
      name: 'Medical Reimbursement',
      category: 'medical',
      eligibilityRules: {
        serviceYears: 1,
        salaryRange: { min: 0, max: 2000000 },
        icRestrictions: []
      },
      budgetInfo: {
        maxAmount: 100000
      },
      maxAmount: 100000,
      validTo: '2024-12-31',
      approvalWorkflow: {
        slaHours: 72
      }
    };
  }
}