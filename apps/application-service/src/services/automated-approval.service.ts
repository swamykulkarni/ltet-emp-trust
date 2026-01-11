import { Application, User, Scheme } from '@ltet/shared-types';
import { RiskScoringService } from './risk-scoring.service';
import { ApplicationRepository } from '../repositories/application.repository';

interface AutoApprovalDecision {
  approved: boolean;
  reason: string;
  riskScore: number;
  conditions?: string[];
  reviewRequired: boolean;
  escalationLevel?: number;
}

interface AutoApprovalRule {
  id: string;
  name: string;
  conditions: {
    maxRiskScore: number;
    maxAmount: number;
    requiredDocuments: string[];
    eligibilityChecks: string[];
    userCriteria: {
      minServiceYears?: number;
      allowedStatuses?: string[];
      allowedICs?: string[];
    };
  };
  actions: {
    autoApprove: boolean;
    approvalAmount?: number; // Can approve partial amount
    conditions?: string[];
    notificationRequired: boolean;
  };
  enabled: boolean;
  priority: number; // Higher number = higher priority
}

export class AutomatedApprovalService {
  private riskScoringService: RiskScoringService;
  private applicationRepository: ApplicationRepository;
  
  // Default auto-approval rules
  private autoApprovalRules: AutoApprovalRule[] = [
    {
      id: 'low-risk-small-amount',
      name: 'Low Risk Small Amount Auto-Approval',
      conditions: {
        maxRiskScore: 20,
        maxAmount: 25000,
        requiredDocuments: ['application_form'],
        eligibilityChecks: ['service_years', 'ic_eligibility'],
        userCriteria: {
          minServiceYears: 1,
          allowedStatuses: ['active', 'retired']
        }
      },
      actions: {
        autoApprove: true,
        notificationRequired: true
      },
      enabled: true,
      priority: 100
    },
    {
      id: 'medical-emergency',
      name: 'Medical Emergency Fast Track',
      conditions: {
        maxRiskScore: 35,
        maxAmount: 50000,
        requiredDocuments: ['medical_certificate', 'bills'],
        eligibilityChecks: ['service_years', 'medical_eligibility'],
        userCriteria: {
          minServiceYears: 0.5,
          allowedStatuses: ['active', 'retired']
        }
      },
      actions: {
        autoApprove: true,
        conditions: ['Subject to post-approval audit'],
        notificationRequired: true
      },
      enabled: true,
      priority: 90
    },
    {
      id: 'education-standard',
      name: 'Standard Education Scheme Auto-Approval',
      conditions: {
        maxRiskScore: 25,
        maxAmount: 75000,
        requiredDocuments: ['fee_receipt', 'admission_letter'],
        eligibilityChecks: ['service_years', 'dependent_age'],
        userCriteria: {
          minServiceYears: 2,
          allowedStatuses: ['active']
        }
      },
      actions: {
        autoApprove: true,
        notificationRequired: true
      },
      enabled: true,
      priority: 80
    }
  ];

  constructor() {
    this.riskScoringService = new RiskScoringService();
    this.applicationRepository = new ApplicationRepository();
  }

  /**
   * Evaluate application for automated approval
   */
  async evaluateForAutoApproval(
    application: Application,
    user: User,
    scheme: Scheme,
    documentAnalysis?: any
  ): Promise<AutoApprovalDecision> {
    try {
      // Calculate risk score first
      const riskAssessment = await this.riskScoringService.calculateRiskScore(
        application,
        user,
        scheme,
        documentAnalysis
      );

      // Check if basic auto-approval criteria are met
      if (!riskAssessment.autoApprovalEligible) {
        return {
          approved: false,
          reason: 'Does not meet basic auto-approval criteria',
          riskScore: riskAssessment.overallScore,
          reviewRequired: true
        };
      }

      // Find applicable auto-approval rules
      const applicableRules = await this.findApplicableRules(
        application,
        user,
        scheme,
        riskAssessment.overallScore
      );

      if (applicableRules.length === 0) {
        return {
          approved: false,
          reason: 'No applicable auto-approval rules found',
          riskScore: riskAssessment.overallScore,
          reviewRequired: true
        };
      }

      // Apply the highest priority rule
      const selectedRule = applicableRules[0];
      
      // Perform final validation checks
      const validationResult = await this.performFinalValidation(
        application,
        user,
        scheme,
        selectedRule
      );

      if (!validationResult.valid) {
        return {
          approved: false,
          reason: validationResult.reason,
          riskScore: riskAssessment.overallScore,
          reviewRequired: true
        };
      }

      // Auto-approve the application
      const approvalDecision: AutoApprovalDecision = {
        approved: true,
        reason: `Auto-approved under rule: ${selectedRule.name}`,
        riskScore: riskAssessment.overallScore,
        conditions: selectedRule.actions.conditions,
        reviewRequired: false
      };

      // Log the auto-approval decision
      await this.logAutoApprovalDecision(application.id, selectedRule, riskAssessment);

      return approvalDecision;

    } catch (error) {
      console.error('Error in auto-approval evaluation:', error);
      
      return {
        approved: false,
        reason: 'Auto-approval evaluation failed - requires manual review',
        riskScore: 100, // Max risk for errors
        reviewRequired: true,
        escalationLevel: 1
      };
    }
  }

  /**
   * Find applicable auto-approval rules for the application
   */
  private async findApplicableRules(
    application: Application,
    user: User,
    scheme: Scheme,
    riskScore: number
  ): Promise<AutoApprovalRule[]> {
    const applicableRules: AutoApprovalRule[] = [];

    for (const rule of this.autoApprovalRules) {
      if (!rule.enabled) continue;

      // Check risk score
      if (riskScore > rule.conditions.maxRiskScore) continue;

      // Check amount
      if (application.applicationData.claimAmount > rule.conditions.maxAmount) continue;

      // Check user criteria
      if (!this.checkUserCriteria(user, rule.conditions.userCriteria)) continue;

      // Check document requirements
      if (!this.checkDocumentRequirements(application, rule.conditions.requiredDocuments)) continue;

      // Check scheme-specific criteria
      if (!this.checkSchemeCriteria(scheme, rule)) continue;

      applicableRules.push(rule);
    }

    // Sort by priority (highest first)
    return applicableRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if user meets the criteria for a rule
   */
  private checkUserCriteria(user: User, criteria: AutoApprovalRule['conditions']['userCriteria']): boolean {
    // Check minimum service years
    if (criteria.minServiceYears !== undefined) {
      const serviceYears = this.calculateServiceYears(user);
      if (serviceYears < criteria.minServiceYears) return false;
    }

    // Check allowed statuses
    if (criteria.allowedStatuses && user.employmentInfo?.status) {
      if (!criteria.allowedStatuses.includes(user.employmentInfo.status)) return false;
    }

    // Check allowed ICs
    if (criteria.allowedICs && user.employmentInfo?.ic) {
      if (!criteria.allowedICs.includes(user.employmentInfo.ic)) return false;
    }

    return true;
  }

  /**
   * Check if application has required documents
   */
  private checkDocumentRequirements(
    application: Application,
    requiredDocuments: string[]
  ): boolean {
    if (!application.documents || application.documents.length === 0) {
      return requiredDocuments.length === 0;
    }

    const availableDocTypes = application.documents.map(doc => doc.type);
    
    return requiredDocuments.every(reqDoc => 
      availableDocTypes.includes(reqDoc)
    );
  }

  /**
   * Check scheme-specific criteria
   */
  private checkSchemeCriteria(scheme: Scheme, rule: AutoApprovalRule): boolean {
    // Add scheme-specific logic here
    // For example, medical schemes might have different criteria
    
    if (rule.id === 'medical-emergency' && scheme.category !== 'medical') {
      return false;
    }

    if (rule.id === 'education-standard' && scheme.category !== 'education') {
      return false;
    }

    return true;
  }

  /**
   * Perform final validation before auto-approval
   */
  private async performFinalValidation(
    application: Application,
    user: User,
    scheme: Scheme,
    rule: AutoApprovalRule
  ): Promise<{ valid: boolean; reason: string }> {
    // Check if scheme is still active
    const now = new Date();
    if (new Date(scheme.validTo) < now) {
      return { valid: false, reason: 'Scheme has expired' };
    }

    // Check if user is still eligible
    if (user.employmentInfo?.status === 'terminated') {
      return { valid: false, reason: 'User employment has been terminated' };
    }

    // Check for any recent policy changes that might affect approval
    // TODO: Implement policy change checks

    // Check budget availability
    // TODO: Implement budget availability check

    // All validations passed
    return { valid: true, reason: 'All validations passed' };
  }

  /**
   * Execute auto-approval for an application
   */
  async executeAutoApproval(
    applicationId: string,
    decision: AutoApprovalDecision,
    systemUserId: string = 'system-auto-approval'
  ): Promise<boolean> {
    try {
      // Update application status to approved
      const updateData = {
        'workflow.currentStatus': 'approved',
        'workflow.approvalHistory': {
          approverId: systemUserId,
          action: 'approve',
          comments: decision.reason,
          timestamp: new Date(),
          automated: true,
          riskScore: decision.riskScore,
          conditions: decision.conditions
        },
        'paymentInfo.approvedAmount': decision.conditions?.includes('partial') 
          ? Math.floor(decision.riskScore * 0.8) // Example partial approval logic
          : undefined
      };

      await this.applicationRepository.update(applicationId, updateData);

      // Trigger notifications
      await this.sendAutoApprovalNotifications(applicationId, decision);

      // Log for audit
      await this.auditAutoApproval(applicationId, decision, systemUserId);

      return true;
    } catch (error) {
      console.error('Error executing auto-approval:', error);
      return false;
    }
  }

  /**
   * Send notifications for auto-approved applications
   */
  private async sendAutoApprovalNotifications(
    applicationId: string,
    decision: AutoApprovalDecision
  ): Promise<void> {
    // TODO: Integrate with notification service
    console.log(`Auto-approval notification sent for application ${applicationId}`);
  }

  /**
   * Audit auto-approval decision
   */
  private async auditAutoApproval(
    applicationId: string,
    decision: AutoApprovalDecision,
    systemUserId: string
  ): Promise<void> {
    // TODO: Implement audit logging
    console.log(`Auto-approval audit logged for application ${applicationId}`);
  }

  /**
   * Log auto-approval decision for analytics
   */
  private async logAutoApprovalDecision(
    applicationId: string,
    rule: AutoApprovalRule,
    riskAssessment: any
  ): Promise<void> {
    // TODO: Implement decision logging for ML improvement
    console.log(`Auto-approval decision logged: ${applicationId}, rule: ${rule.id}`);
  }

  /**
   * Calculate user's service years
   */
  private calculateServiceYears(user: User): number {
    if (!user.employmentInfo?.joiningDate) {
      return 0;
    }
    
    const joiningDate = new Date(user.employmentInfo.joiningDate);
    const now = new Date();
    const yearsDiff = (now.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    return Math.max(0, yearsDiff);
  }

  /**
   * Add or update auto-approval rule
   */
  addAutoApprovalRule(rule: AutoApprovalRule): void {
    const existingIndex = this.autoApprovalRules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      this.autoApprovalRules[existingIndex] = rule;
    } else {
      this.autoApprovalRules.push(rule);
    }

    // Sort by priority
    this.autoApprovalRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove auto-approval rule
   */
  removeAutoApprovalRule(ruleId: string): boolean {
    const index = this.autoApprovalRules.findIndex(r => r.id === ruleId);
    
    if (index >= 0) {
      this.autoApprovalRules.splice(index, 1);
      return true;
    }
    
    return false;
  }

  /**
   * Get all auto-approval rules
   */
  getAutoApprovalRules(): AutoApprovalRule[] {
    return [...this.autoApprovalRules];
  }

  /**
   * Enable or disable auto-approval rule
   */
  toggleAutoApprovalRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.autoApprovalRules.find(r => r.id === ruleId);
    
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    
    return false;
  }

  /**
   * Get auto-approval statistics
   */
  async getAutoApprovalStatistics(): Promise<{
    totalEvaluations: number;
    autoApprovedCount: number;
    autoApprovalRate: number;
    averageProcessingTime: number;
    ruleUsageStats: Record<string, number>;
    errorRate: number;
  }> {
    // TODO: Implement statistics calculation from database
    return {
      totalEvaluations: 0,
      autoApprovedCount: 0,
      autoApprovalRate: 0,
      averageProcessingTime: 0,
      ruleUsageStats: {},
      errorRate: 0
    };
  }

  /**
   * Simulate auto-approval for testing
   */
  async simulateAutoApproval(
    application: Application,
    user: User,
    scheme: Scheme
  ): Promise<{
    wouldApprove: boolean;
    reason: string;
    riskScore: number;
    applicableRules: string[];
  }> {
    const decision = await this.evaluateForAutoApproval(application, user, scheme);
    const applicableRules = await this.findApplicableRules(
      application,
      user,
      scheme,
      decision.riskScore
    );

    return {
      wouldApprove: decision.approved,
      reason: decision.reason,
      riskScore: decision.riskScore,
      applicableRules: applicableRules.map(rule => rule.name)
    };
  }
}