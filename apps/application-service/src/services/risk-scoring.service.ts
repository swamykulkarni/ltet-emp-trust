import { Application, User, Scheme } from '@ltet/shared-types';

interface RiskFactors {
  documentQuality: number;
  historicalPattern: number;
  amountRisk: number;
  eligibilityCompliance: number;
  timelineRisk: number;
  userReliability: number;
}

interface RiskScore {
  overallScore: number; // 0-100, where 0 is lowest risk
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  reasons: string[];
  confidence: number;
  autoApprovalEligible: boolean;
}

interface SLABreachPrediction {
  probabilityOfBreach: number; // 0-1
  expectedCompletionDate: Date;
  riskFactors: string[];
  recommendedActions: string[];
}

interface AutoApprovalConfig {
  maxAmount: number;
  maxRiskScore: number;
  requiredDocumentQuality: number;
  blacklistedCategories: string[];
  minimumServiceYears: number;
}

export class RiskScoringService {
  private autoApprovalConfig: AutoApprovalConfig = {
    maxAmount: 50000, // Auto-approve only up to 50k
    maxRiskScore: 25, // Risk score must be below 25
    requiredDocumentQuality: 0.8, // Document quality must be above 80%
    blacklistedCategories: [], // No categories blacklisted by default
    minimumServiceYears: 2 // Minimum 2 years service
  };

  /**
   * Calculate comprehensive risk score for an application
   */
  async calculateRiskScore(
    application: Application,
    user: User,
    scheme: Scheme,
    documentAnalysis?: any
  ): Promise<RiskScore> {
    const factors = await this.calculateRiskFactors(
      application,
      user,
      scheme,
      documentAnalysis
    );

    // Calculate weighted overall score
    const weights = {
      documentQuality: 0.25,
      historicalPattern: 0.20,
      amountRisk: 0.20,
      eligibilityCompliance: 0.15,
      timelineRisk: 0.10,
      userReliability: 0.10
    };

    const overallScore = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof RiskFactors]);
    }, 0);

    const riskLevel = this.determineRiskLevel(overallScore);
    const reasons = this.generateRiskReasons(factors, overallScore);
    const confidence = this.calculateConfidence(factors, application);
    const autoApprovalEligible = this.isAutoApprovalEligible(
      overallScore,
      application,
      user,
      scheme
    );

    return {
      overallScore: Math.round(overallScore),
      riskLevel,
      factors,
      reasons,
      confidence,
      autoApprovalEligible
    };
  }

  /**
   * Calculate individual risk factors
   */
  private async calculateRiskFactors(
    application: Application,
    user: User,
    scheme: Scheme,
    documentAnalysis?: any
  ): Promise<RiskFactors> {
    return {
      documentQuality: await this.calculateDocumentQualityRisk(application, documentAnalysis),
      historicalPattern: await this.calculateHistoricalPatternRisk(user, scheme),
      amountRisk: this.calculateAmountRisk(application, scheme, user),
      eligibilityCompliance: await this.calculateEligibilityComplianceRisk(user, scheme),
      timelineRisk: this.calculateTimelineRisk(application, scheme),
      userReliability: await this.calculateUserReliabilityRisk(user)
    };
  }

  /**
   * Calculate document quality risk based on OCR analysis and validation
   */
  private async calculateDocumentQualityRisk(
    application: Application,
    documentAnalysis?: any
  ): Promise<number> {
    if (!application.documents || application.documents.length === 0) {
      return 80; // High risk if no documents
    }

    let totalQualityScore = 0;
    let documentCount = 0;

    for (const doc of application.documents) {
      documentCount++;
      
      // Base score from validation status
      let docScore = 0;
      if (doc.validationStatus === 'validated') {
        docScore = 20; // Low risk for validated docs
      } else if (doc.validationStatus === 'pending') {
        docScore = 50; // Medium risk for pending
      } else {
        docScore = 80; // High risk for failed validation
      }

      // Adjust based on OCR analysis if available
      if (documentAnalysis && documentAnalysis[doc.documentId]) {
        const analysis = documentAnalysis[doc.documentId];
        
        // OCR confidence score
        if (analysis.confidence < 0.7) {
          docScore += 20; // Increase risk for low OCR confidence
        } else if (analysis.confidence > 0.9) {
          docScore -= 10; // Decrease risk for high confidence
        }

        // Data consistency check
        if (analysis.inconsistencies && analysis.inconsistencies.length > 0) {
          docScore += analysis.inconsistencies.length * 10;
        }
      }

      totalQualityScore += Math.min(docScore, 100);
    }

    return totalQualityScore / documentCount;
  }

  /**
   * Calculate risk based on user's historical application patterns
   */
  private async calculateHistoricalPatternRisk(user: User, scheme: Scheme): Promise<number> {
    // TODO: Get user's application history from database
    // For now, return a calculated risk based on available data
    
    const baseRisk = 30; // Default medium-low risk
    
    // Adjust based on user service years
    const serviceYears = this.calculateServiceYears(user);
    if (serviceYears < 1) {
      return baseRisk + 30; // Higher risk for new employees
    } else if (serviceYears > 5) {
      return Math.max(baseRisk - 15, 5); // Lower risk for experienced employees
    }

    return baseRisk;
  }

  /**
   * Calculate risk based on claim amount relative to scheme limits and user profile
   */
  private calculateAmountRisk(application: Application, scheme: Scheme, user: User): number {
    const claimAmount = application.applicationData.claimAmount;
    const maxAmount = scheme.budgetInfo?.maxAmount || scheme.maxAmount;
    
    if (!claimAmount || claimAmount <= 0) {
      return 60; // Medium-high risk for invalid amounts
    }

    // Calculate amount ratio
    const amountRatio = claimAmount / maxAmount;
    
    let risk = 0;
    
    if (amountRatio > 0.9) {
      risk = 70; // High risk for claims near maximum
    } else if (amountRatio > 0.7) {
      risk = 45; // Medium risk
    } else if (amountRatio > 0.5) {
      risk = 25; // Low-medium risk
    } else {
      risk = 10; // Low risk for small claims
    }

    // Adjust based on user salary if available
    if (user.employmentInfo?.salary) {
      const salaryRatio = claimAmount / (user.employmentInfo.salary * 0.1); // 10% of annual salary
      if (salaryRatio > 2) {
        risk += 20; // Increase risk if claim is high relative to salary
      }
    }

    return Math.min(risk, 100);
  }

  /**
   * Calculate risk based on eligibility compliance
   */
  private async calculateEligibilityComplianceRisk(user: User, scheme: Scheme): Promise<number> {
    let risk = 0;
    
    // Service years check
    const serviceYears = this.calculateServiceYears(user);
    if (serviceYears < scheme.eligibilityRules.serviceYears) {
      risk += 40; // High risk if doesn't meet service requirement
    }

    // Salary range check
    if (scheme.eligibilityRules.salaryRange && user.employmentInfo?.salary) {
      const salary = user.employmentInfo.salary;
      if (salary < scheme.eligibilityRules.salaryRange.min || 
          salary > scheme.eligibilityRules.salaryRange.max) {
        risk += 30;
      }
    }

    // IC restrictions check
    if (scheme.eligibilityRules.icRestrictions.length > 0 && 
        user.employmentInfo?.ic &&
        !scheme.eligibilityRules.icRestrictions.includes(user.employmentInfo.ic)) {
      risk += 50; // Very high risk if IC not allowed
    }

    return Math.min(risk, 100);
  }

  /**
   * Calculate timeline-based risk factors
   */
  private calculateTimelineRisk(application: Application, scheme: Scheme): number {
    const now = new Date();
    const schemeEndDate = new Date(scheme.validTo);
    const daysUntilExpiry = Math.ceil((schemeEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let risk = 0;
    
    if (daysUntilExpiry < 7) {
      risk = 60; // High risk for last-minute applications
    } else if (daysUntilExpiry < 30) {
      risk = 30; // Medium risk
    } else {
      risk = 10; // Low risk for early applications
    }

    // Check if application was submitted during peak periods
    const submissionDate = new Date(application.createdAt || now);
    const dayOfMonth = submissionDate.getDate();
    
    // Higher risk for end-of-month submissions (potential rush)
    if (dayOfMonth > 25) {
      risk += 15;
    }

    return Math.min(risk, 100);
  }

  /**
   * Calculate user reliability risk based on past behavior
   */
  private async calculateUserReliabilityRisk(user: User): Promise<number> {
    // TODO: Implement based on user's historical data
    // - Past application success rate
    // - Document resubmission frequency
    // - Compliance with deadlines
    // - Feedback ratings
    
    const baseRisk = 20; // Default low risk
    
    // Adjust based on user status
    if (user.employmentInfo?.status === 'retired') {
      return baseRisk + 10; // Slightly higher risk for retirees
    }
    
    return baseRisk;
  }

  /**
   * Determine risk level based on overall score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 25) return 'low';
    if (score <= 50) return 'medium';
    if (score <= 75) return 'high';
    return 'critical';
  }

  /**
   * Generate human-readable risk reasons
   */
  private generateRiskReasons(factors: RiskFactors, overallScore: number): string[] {
    const reasons: string[] = [];
    
    if (factors.documentQuality > 50) {
      reasons.push('Document quality concerns detected');
    }
    
    if (factors.amountRisk > 60) {
      reasons.push('High claim amount relative to limits');
    }
    
    if (factors.eligibilityCompliance > 40) {
      reasons.push('Potential eligibility compliance issues');
    }
    
    if (factors.historicalPattern > 60) {
      reasons.push('Unfavorable historical pattern');
    }
    
    if (factors.timelineRisk > 50) {
      reasons.push('Timeline-related risk factors');
    }
    
    if (factors.userReliability > 50) {
      reasons.push('User reliability concerns');
    }
    
    if (overallScore <= 25) {
      reasons.push('Low risk profile - suitable for expedited processing');
    }
    
    return reasons.length > 0 ? reasons : ['Standard risk assessment completed'];
  }

  /**
   * Calculate confidence in the risk assessment
   */
  private calculateConfidence(factors: RiskFactors, application: Application): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on available data
    if (application.documents && application.documents.length > 0) {
      confidence += 0.2;
    }
    
    if (application.applicationData.claimAmount > 0) {
      confidence += 0.1;
    }
    
    // Decrease confidence for edge cases
    if (Object.values(factors).some(factor => factor > 90)) {
      confidence -= 0.1;
    }
    
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Determine if application is eligible for auto-approval
   */
  private isAutoApprovalEligible(
    riskScore: number,
    application: Application,
    user: User,
    scheme: Scheme
  ): boolean {
    // Check all auto-approval criteria
    const claimAmount = application.applicationData.claimAmount;
    const serviceYears = this.calculateServiceYears(user);
    
    return (
      riskScore <= this.autoApprovalConfig.maxRiskScore &&
      claimAmount <= this.autoApprovalConfig.maxAmount &&
      serviceYears >= this.autoApprovalConfig.minimumServiceYears &&
      !this.autoApprovalConfig.blacklistedCategories.includes(scheme.category) &&
      application.documents && application.documents.length > 0 &&
      application.documents.every(doc => doc.validationStatus === 'validated')
    );
  }

  /**
   * Predict SLA breach probability
   */
  async predictSLABreach(
    application: Application,
    scheme: Scheme,
    currentWorkload?: number
  ): Promise<SLABreachPrediction> {
    const slaHours = scheme.approvalWorkflow.slaHours;
    const submissionDate = new Date(application.createdAt || new Date());
    const slaDeadline = new Date(submissionDate.getTime() + (slaHours * 60 * 60 * 1000));
    
    const now = new Date();
    const hoursRemaining = Math.max(0, (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    let breachProbability = 0;
    const riskFactors: string[] = [];
    const recommendedActions: string[] = [];
    
    // Calculate probability based on various factors
    
    // Time pressure
    if (hoursRemaining < slaHours * 0.2) { // Less than 20% time remaining
      breachProbability += 0.6;
      riskFactors.push('Critical time pressure - less than 20% of SLA time remaining');
      recommendedActions.push('Escalate immediately to senior approver');
    } else if (hoursRemaining < slaHours * 0.5) { // Less than 50% time remaining
      breachProbability += 0.3;
      riskFactors.push('Time pressure - less than 50% of SLA time remaining');
      recommendedActions.push('Prioritize this application for review');
    }
    
    // Workload factor
    if (currentWorkload && currentWorkload > 10) {
      breachProbability += 0.2;
      riskFactors.push('High approver workload detected');
      recommendedActions.push('Consider load balancing or additional resources');
    }
    
    // Document complexity
    if (application.documents && application.documents.length > 5) {
      breachProbability += 0.1;
      riskFactors.push('High document count may increase review time');
    }
    
    // Amount complexity
    const claimAmount = application.applicationData.claimAmount;
    const maxAmount = scheme.budgetInfo?.maxAmount || scheme.maxAmount;
    if (claimAmount > maxAmount * 0.8) {
      breachProbability += 0.15;
      riskFactors.push('High claim amount requires additional scrutiny');
      recommendedActions.push('Ensure senior approver availability');
    }
    
    // Cap probability at 1.0
    breachProbability = Math.min(breachProbability, 1.0);
    
    // Calculate expected completion date
    const estimatedHoursNeeded = this.estimateProcessingTime(application, scheme);
    const expectedCompletionDate = new Date(now.getTime() + (estimatedHoursNeeded * 60 * 60 * 1000));
    
    // Add default recommendations based on probability
    if (breachProbability > 0.7) {
      recommendedActions.push('Consider auto-approval if risk score is low');
      recommendedActions.push('Alert management of potential SLA breach');
    } else if (breachProbability > 0.4) {
      recommendedActions.push('Monitor closely and provide regular updates');
    }
    
    return {
      probabilityOfBreach: Math.round(breachProbability * 100) / 100,
      expectedCompletionDate,
      riskFactors: riskFactors.length > 0 ? riskFactors : ['No significant risk factors identified'],
      recommendedActions: recommendedActions.length > 0 ? recommendedActions : ['Continue standard processing']
    };
  }

  /**
   * Estimate processing time based on application complexity
   */
  private estimateProcessingTime(application: Application, scheme: Scheme): number {
    let baseHours = 2; // Base processing time
    
    // Add time for document review
    if (application.documents) {
      baseHours += application.documents.length * 0.5;
    }
    
    // Add time for high-value claims
    const claimAmount = application.applicationData.claimAmount;
    const maxAmount = scheme.budgetInfo?.maxAmount || scheme.maxAmount;
    if (claimAmount > maxAmount * 0.5) {
      baseHours += 1;
    }
    
    // Add time for complex schemes
    if (scheme.category === 'medical' && claimAmount > 25000) {
      baseHours += 2; // Medical claims need more review
    }
    
    return baseHours;
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
   * Update auto-approval configuration
   */
  updateAutoApprovalConfig(config: Partial<AutoApprovalConfig>): void {
    this.autoApprovalConfig = { ...this.autoApprovalConfig, ...config };
  }

  /**
   * Get current auto-approval configuration
   */
  getAutoApprovalConfig(): AutoApprovalConfig {
    return { ...this.autoApprovalConfig };
  }

  /**
   * Get risk scoring analytics
   */
  async getRiskScoringAnalytics(): Promise<{
    totalAssessments: number;
    autoApprovalRate: number;
    averageRiskScore: number;
    riskDistribution: Record<string, number>;
    slaBreachPredictionAccuracy: number;
  }> {
    // TODO: Implement analytics calculation from database
    return {
      totalAssessments: 0,
      autoApprovalRate: 0,
      averageRiskScore: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      slaBreachPredictionAccuracy: 0
    };
  }
}