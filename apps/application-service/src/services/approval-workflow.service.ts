import { ApplicationRepository } from '../repositories/application.repository';
import { Application, ApplicationStatus, ApprovalAction } from '../models/application.model';

export interface ApprovalRule {
  schemeCategory: string;
  amountThreshold: number;
  approverRoles: string[];
  slaHours: number;
  escalationRoles: string[];
}

export interface WorkloadBalance {
  approverId: string;
  currentWorkload: number;
  maxCapacity: number;
  specializations: string[];
}

export class ApprovalWorkflowService {
  private applicationRepository: ApplicationRepository;
  
  // Default approval rules - in production, these would come from database
  private approvalRules: ApprovalRule[] = [
    {
      schemeCategory: 'medical',
      amountThreshold: 50000,
      approverRoles: ['approver'],
      slaHours: 72,
      escalationRoles: ['senior_approver', 'head']
    },
    {
      schemeCategory: 'medical',
      amountThreshold: 200000,
      approverRoles: ['senior_approver'],
      slaHours: 120,
      escalationRoles: ['head', 'finance']
    },
    {
      schemeCategory: 'education',
      amountThreshold: 100000,
      approverRoles: ['approver'],
      slaHours: 96,
      escalationRoles: ['senior_approver', 'head']
    },
    {
      schemeCategory: 'education',
      amountThreshold: 500000,
      approverRoles: ['senior_approver', 'head'],
      slaHours: 168,
      escalationRoles: ['finance']
    },
    {
      schemeCategory: 'skill_building',
      amountThreshold: 75000,
      approverRoles: ['approver'],
      slaHours: 48,
      escalationRoles: ['senior_approver']
    }
  ];

  constructor() {
    this.applicationRepository = new ApplicationRepository();
  }

  async assignApprover(applicationId: string): Promise<string> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    // Get scheme details to determine approval rules
    const schemeCategory = await this.getSchemeCategory(application.schemeId);
    const claimAmount = application.applicationData.claimAmount;

    // Find applicable approval rule
    const applicableRule = this.findApplicableRule(schemeCategory, claimAmount);
    if (!applicableRule) {
      throw new Error(`No approval rule found for scheme category: ${schemeCategory}, amount: ${claimAmount}`);
    }

    // Get available approvers with workload balancing
    const availableApprovers = await this.getAvailableApprovers(applicableRule.approverRoles);
    if (availableApprovers.length === 0) {
      throw new Error('No available approvers found');
    }

    // Select approver based on workload balancing
    const selectedApprover = this.selectApproverByWorkload(availableApprovers, schemeCategory);

    // Update application status and assign approver
    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: 'under_review' as ApplicationStatus,
      slaDeadline: this.calculateSLADeadline(applicableRule.slaHours),
      escalationLevel: 0
    };

    await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, {
        action: 'approver_assigned',
        userId: 'system',
        timestamp: new Date(),
        details: { 
          approverId: selectedApprover,
          rule: applicableRule,
          workloadBalance: true
        }
      }]
    });

    return selectedApprover;
  }

  async processConditionalApproval(
    applicationId: string, 
    approverId: string, 
    approvedAmount: number, 
    conditions: string[]
  ): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.workflow.currentStatus !== 'under_review') {
      throw new Error('Application is not in review status');
    }

    // Validate approved amount doesn't exceed claim amount
    if (approvedAmount > application.applicationData.claimAmount) {
      throw new Error('Approved amount cannot exceed claimed amount');
    }

    // Check if approver has authority for this amount
    const schemeCategory = await this.getSchemeCategory(application.schemeId);
    const hasAuthority = await this.validateApproverAuthority(approverId, schemeCategory, approvedAmount);
    if (!hasAuthority) {
      throw new Error('Approver does not have authority for this amount');
    }

    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: 'approved' as ApplicationStatus,
      approvalHistory: [...application.workflow.approvalHistory, {
        approverId,
        action: 'approve' as ApprovalAction,
        comments: `Conditional approval: ${conditions.join(', ')}. Approved amount: ${approvedAmount}`,
        timestamp: new Date()
      }]
    };

    const paymentInfo = {
      approvedAmount,
      paymentStatus: 'pending' as const,
      conditions
    };

    const auditEntry = {
      action: 'conditional_approval',
      userId: approverId,
      timestamp: new Date(),
      details: {
        originalAmount: application.applicationData.claimAmount,
        approvedAmount,
        conditions,
        previousStatus: application.workflow.currentStatus
      }
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      paymentInfo,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to update application');
    }

    return updatedApplication;
  }

  async checkSLAViolations(): Promise<Application[]> {
    const applications = await this.applicationRepository.getApplicationsByStatus('under_review');
    const now = new Date();
    
    return applications.filter(app => {
      return app.workflow.slaDeadline < now && app.workflow.escalationLevel < 3;
    });
  }

  async escalateApplication(applicationId: string): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const schemeCategory = await this.getSchemeCategory(application.schemeId);
    const claimAmount = application.applicationData.claimAmount;
    const currentEscalationLevel = application.workflow.escalationLevel;

    // Find escalation rule
    const applicableRule = this.findApplicableRule(schemeCategory, claimAmount);
    if (!applicableRule || currentEscalationLevel >= applicableRule.escalationRoles.length) {
      throw new Error('Maximum escalation level reached');
    }

    // Get escalation approver
    const escalationRole = applicableRule.escalationRoles[currentEscalationLevel];
    const escalationApprovers = await this.getAvailableApprovers([escalationRole]);
    
    if (escalationApprovers.length === 0) {
      throw new Error(`No available escalation approvers found for role: ${escalationRole}`);
    }

    const selectedEscalationApprover = this.selectApproverByWorkload(escalationApprovers, schemeCategory);

    const updatedWorkflow = {
      ...application.workflow,
      escalationLevel: currentEscalationLevel + 1,
      slaDeadline: this.calculateSLADeadline(applicableRule.slaHours) // Reset SLA for escalated level
    };

    const auditEntry = {
      action: 'application_escalated',
      userId: 'system',
      timestamp: new Date(),
      details: {
        escalationLevel: updatedWorkflow.escalationLevel,
        escalationApprover: selectedEscalationApprover,
        reason: 'SLA violation',
        previousSLA: application.workflow.slaDeadline
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

  async getApproverWorkload(approverId: string): Promise<WorkloadBalance> {
    // In production, this would query the database for current workload
    // For now, return mock data
    const activeApplications = await this.applicationRepository.getApplicationsByStatus('under_review');
    const approverApplications = activeApplications.filter(app => 
      app.workflow.approvalHistory.some(h => h.approverId === approverId)
    );

    return {
      approverId,
      currentWorkload: approverApplications.length,
      maxCapacity: 20, // Default capacity
      specializations: ['medical', 'education'] // Default specializations
    };
  }

  async bulkEscalateViolations(): Promise<Application[]> {
    const violations = await this.checkSLAViolations();
    const escalatedApplications: Application[] = [];

    for (const application of violations) {
      try {
        const escalated = await this.escalateApplication(application.applicationId);
        escalatedApplications.push(escalated);
      } catch (error) {
        console.error(`Failed to escalate application ${application.applicationId}:`, error);
      }
    }

    return escalatedApplications;
  }

  // Private helper methods
  private findApplicableRule(schemeCategory: string, amount: number): ApprovalRule | null {
    // Find the rule with the highest threshold that the amount exceeds
    const applicableRules = this.approvalRules
      .filter(rule => rule.schemeCategory === schemeCategory && amount >= rule.amountThreshold)
      .sort((a, b) => b.amountThreshold - a.amountThreshold);

    return applicableRules.length > 0 ? applicableRules[0] : null;
  }

  private async getAvailableApprovers(roles: string[]): Promise<string[]> {
    // In production, this would query the user service for available approvers
    // For now, return mock approver IDs
    const mockApprovers: Record<string, string[]> = {
      'approver': ['approver-1', 'approver-2', 'approver-3'],
      'senior_approver': ['senior-approver-1', 'senior-approver-2'],
      'head': ['head-1'],
      'finance': ['finance-1', 'finance-2']
    };

    const availableApprovers: string[] = [];
    for (const role of roles) {
      if (mockApprovers[role]) {
        availableApprovers.push(...mockApprovers[role]);
      }
    }

    return availableApprovers;
  }

  private selectApproverByWorkload(approvers: string[], schemeCategory: string): string {
    // Simple round-robin selection for now
    // In production, this would consider actual workload and specializations
    return approvers[Math.floor(Math.random() * approvers.length)];
  }

  private calculateSLADeadline(hours: number): Date {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    return deadline;
  }

  private async getSchemeCategory(schemeId: string): Promise<string> {
    // In production, this would query the scheme service
    // For now, return mock category based on scheme ID pattern
    if (schemeId.includes('medical')) return 'medical';
    if (schemeId.includes('education')) return 'education';
    if (schemeId.includes('skill')) return 'skill_building';
    return 'medical'; // Default
  }

  private async validateApproverAuthority(approverId: string, schemeCategory: string, amount: number): Promise<boolean> {
    // In production, this would check the approver's role and authority limits
    // For now, return true for simplicity
    return true;
  }
}