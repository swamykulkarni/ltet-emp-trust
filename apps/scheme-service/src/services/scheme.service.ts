import { Scheme, User, PaginatedResponse } from '@ltet/shared-types';
import { performanceService, cacheService } from '@ltet/shared-utils';
import { SchemeRepository } from '../repositories/scheme.repository';
import { EligibilityRulesService } from './eligibility-rules.service';
import { AIRecommendationService } from './ai-recommendation.service';
import { 
  CreateSchemeRequest, 
  UpdateSchemeRequest, 
  SchemeFilter,
  RuleBuilder,
  SchemeVersion 
} from '../models/scheme.model';

export class SchemeService {
  private schemeRepository: SchemeRepository;
  private eligibilityService: EligibilityRulesService;
  private aiRecommendationService: AIRecommendationService;

  constructor() {
    this.schemeRepository = new SchemeRepository();
    this.eligibilityService = new EligibilityRulesService();
    this.aiRecommendationService = new AIRecommendationService();
  }

  /**
   * Creates a new scheme
   */
  async createScheme(schemeData: CreateSchemeRequest, createdBy: string): Promise<Scheme> {
    // Validate scheme data
    this.validateSchemeData(schemeData);

    // Create the scheme
    const scheme = await this.schemeRepository.create(schemeData, createdBy);
    
    return scheme;
  }

  /**
   * Gets a scheme by ID
   */
  async getSchemeById(schemeId: string): Promise<Scheme | null> {
    return await performanceService.cacheFrequentData(
      `scheme:${schemeId}`,
      async () => {
        return await this.schemeRepository.findById(schemeId);
      },
      { 
        category: 'scheme',
        priority: 'high',
        ttl: 600 // 10 minutes
      }
    );
  }

  /**
   * Gets all schemes with optional filtering
   */
  async getSchemes(filter: SchemeFilter = {}): Promise<Scheme[]> {
    const cacheKey = `schemes:${JSON.stringify(filter)}`;
    
    return await performanceService.cacheFrequentData(
      cacheKey,
      async () => {
        return await this.schemeRepository.findAll(filter);
      },
      { 
        category: 'scheme',
        priority: 'medium',
        ttl: 300 // 5 minutes
      }
    );
  }

  /**
   * Gets schemes filtered by user eligibility
   */
  async getEligibleSchemes(user: User, filter: SchemeFilter = {}): Promise<Scheme[]> {
    // Get all active schemes
    const allSchemes = await this.schemeRepository.findAll({
      ...filter,
      status: 'active'
    });

    // Filter by eligibility
    const eligibleSchemes: Scheme[] = [];
    
    for (const scheme of allSchemes) {
      const isEligible = await this.eligibilityService.evaluateEligibility(user, scheme);
      if (isEligible) {
        eligibleSchemes.push(scheme);
      }
    }

    return eligibleSchemes;
  }

  /**
   * Updates a scheme
   */
  async updateScheme(schemeId: string, updateData: UpdateSchemeRequest): Promise<Scheme | null> {
    // Validate update data
    if (Object.keys(updateData).length === 0) {
      throw new Error('No update data provided');
    }

    const updatedScheme = await this.schemeRepository.update(schemeId, updateData);
    
    // Invalidate related caches
    if (updatedScheme) {
      await performanceService.invalidateCache(`scheme:${schemeId}`, 'scheme');
      await performanceService.invalidateCache('schemes:*', 'scheme');
      await performanceService.invalidateCache('scheme:statistics', 'scheme');
    }
    
    return updatedScheme;
  }

  /**
   * Deletes a scheme
   */
  async deleteScheme(schemeId: string): Promise<boolean> {
    return await this.schemeRepository.delete(schemeId);
  }

  /**
   * Publishes a scheme (changes status from draft to active)
   */
  async publishScheme(schemeId: string): Promise<Scheme | null> {
    const scheme = await this.schemeRepository.findById(schemeId);
    
    if (!scheme) {
      throw new Error('Scheme not found');
    }

    if (scheme.status !== 'draft') {
      throw new Error('Only draft schemes can be published');
    }

    // Validate scheme is complete before publishing
    this.validateSchemeForPublishing(scheme);

    return await this.schemeRepository.publish(schemeId);
  }

  /**
   * Gets scheme versions
   */
  async getSchemeVersions(schemeId: string): Promise<SchemeVersion[]> {
    return await this.schemeRepository.getVersions(schemeId);
  }

  /**
   * Creates a rule builder configuration for a scheme
   */
  async createRuleBuilder(schemeId?: string): Promise<RuleBuilder> {
    let existingRules;
    
    if (schemeId) {
      const scheme = await this.schemeRepository.findById(schemeId);
      existingRules = scheme?.eligibilityRules;
    }

    return this.eligibilityService.createRuleBuilder(existingRules);
  }

  /**
   * Updates scheme eligibility rules using rule builder
   */
  async updateEligibilityRules(schemeId: string, ruleBuilder: RuleBuilder): Promise<Scheme | null> {
    // Validate rule builder
    const validation = this.eligibilityService.validateRuleBuilder(ruleBuilder);
    if (!validation.valid) {
      throw new Error(`Invalid rules: ${validation.errors.join(', ')}`);
    }

    // Convert rule builder to eligibility rules
    const eligibilityRules = this.eligibilityService.buildEligibilityRules(ruleBuilder);

    // Update the scheme
    return await this.schemeRepository.update(schemeId, { eligibilityRules });
  }

  /**
   * Gets available rule types for the visual builder
   */
  getAvailableRuleTypes() {
    return this.eligibilityService.getAvailableRuleTypes();
  }

  /**
   * Checks if a user is eligible for a specific scheme
   */
  async checkEligibility(userId: string, schemeId: string): Promise<{ eligible: boolean; reasons?: string[] }> {
    const scheme = await this.schemeRepository.findById(schemeId);
    if (!scheme) {
      throw new Error('Scheme not found');
    }

    // TODO: Get user from user service
    // For now, we'll return a placeholder
    return {
      eligible: true,
      reasons: []
    };
  }

  /**
   * Gets scheme statistics
   */
  async getSchemeStatistics(): Promise<{
    total: number;
    active: number;
    draft: number;
    inactive: number;
    byCategory: Record<string, number>;
  }> {
    return await performanceService.cacheFrequentData(
      'scheme:statistics',
      async () => {
        const allSchemes = await this.schemeRepository.findAll();
        
        const stats = {
          total: allSchemes.length,
          active: 0,
          draft: 0,
          inactive: 0,
          byCategory: {} as Record<string, number>
        };

        allSchemes.forEach(scheme => {
          // Count by status
          if (scheme.status === 'active') {
            stats.active++;
          } else if (scheme.status === 'draft') {
            stats.draft++;
          } else if (scheme.status === 'inactive') {
            stats.inactive++;
          }

          // Count by category
          if (!stats.byCategory[scheme.category]) {
            stats.byCategory[scheme.category] = 0;
          }
          stats.byCategory[scheme.category]++;
        });

        return stats;
      },
      { 
        category: 'scheme',
        priority: 'low',
        ttl: 900 // 15 minutes
      }
    );
  }

  /**
   * Get AI-powered scheme recommendations for a user
   */
  async getSchemeRecommendations(userId: string, limit: number = 5): Promise<Scheme[]> {
    return await this.aiRecommendationService.generateRecommendations(userId, limit);
  }

  /**
   * Record user feedback on recommendations for ML improvement
   */
  async recordRecommendationFeedback(
    userId: string, 
    schemeId: string, 
    action: 'viewed' | 'applied' | 'dismissed' | 'completed',
    rating?: number
  ): Promise<void> {
    await this.aiRecommendationService.recordFeedback({
      userId,
      schemeId,
      action,
      timestamp: new Date(),
      rating
    });
  }

  /**
   * Get recommendation analytics for admin dashboard
   */
  async getRecommendationAnalytics(): Promise<{
    totalRecommendations: number;
    clickThroughRate: number;
    applicationRate: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    return await this.aiRecommendationService.getRecommendationAnalytics();
  }

  private validateSchemeData(schemeData: CreateSchemeRequest): void {
    if (!schemeData.name || schemeData.name.trim().length === 0) {
      throw new Error('Scheme name is required');
    }

    if (!schemeData.description || schemeData.description.trim().length === 0) {
      throw new Error('Scheme description is required');
    }

    if (!['medical', 'education', 'skill_building'].includes(schemeData.category)) {
      throw new Error('Invalid scheme category');
    }

    if (new Date(schemeData.validFrom) >= new Date(schemeData.validTo)) {
      throw new Error('Valid from date must be before valid to date');
    }

    if (!schemeData.budgetInfo.maxAmount || schemeData.budgetInfo.maxAmount <= 0) {
      throw new Error('Budget max amount must be greater than 0');
    }

    if (!schemeData.approvalWorkflow.slaHours || schemeData.approvalWorkflow.slaHours <= 0) {
      throw new Error('SLA hours must be greater than 0');
    }
  }

  private validateSchemeForPublishing(scheme: Scheme): void {
    if (!scheme.documentRequirements || scheme.documentRequirements.length === 0) {
      throw new Error('Scheme must have at least one document requirement before publishing');
    }

    if (!scheme.approvalWorkflow.levels || scheme.approvalWorkflow.levels.length === 0) {
      throw new Error('Scheme must have approval workflow levels before publishing');
    }

    if (new Date(scheme.validFrom) <= new Date()) {
      throw new Error('Scheme valid from date must be in the future');
    }
  }
}