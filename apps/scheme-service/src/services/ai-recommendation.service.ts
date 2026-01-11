import { Scheme, User } from '@ltet/shared-types';
import { SchemeRepository } from '../repositories/scheme.repository';

interface UserProfile {
  userId: string;
  employmentInfo: {
    department: string;
    ic: string;
    serviceYears: number;
    salary: number;
    status: 'active' | 'retired';
  };
  demographics: {
    age: number;
    dependents: Array<{
      relationship: string;
      age: number;
    }>;
  };
  applicationHistory: Array<{
    schemeId: string;
    category: string;
    status: string;
    appliedAt: Date;
    amount: number;
  }>;
  preferences: {
    categories: string[];
    maxAmount: number;
    urgency: 'low' | 'medium' | 'high';
  };
}

interface RecommendationScore {
  schemeId: string;
  score: number;
  reasons: string[];
  confidence: number;
}

interface FeedbackData {
  userId: string;
  schemeId: string;
  action: 'viewed' | 'applied' | 'dismissed' | 'completed';
  timestamp: Date;
  rating?: number; // 1-5 scale
}

export class AIRecommendationService {
  private schemeRepository: SchemeRepository;
  private userProfiles: Map<string, UserProfile> = new Map();
  private feedbackData: FeedbackData[] = [];
  
  // ML model weights (simplified for demonstration)
  private modelWeights = {
    categoryPreference: 0.25,
    eligibilityMatch: 0.30,
    historicalPattern: 0.20,
    amountSuitability: 0.15,
    urgencyMatch: 0.10
  };

  constructor() {
    this.schemeRepository = new SchemeRepository();
  }

  /**
   * Generate personalized scheme recommendations for a user
   */
  async generateRecommendations(userId: string, limit: number = 5): Promise<Scheme[]> {
    try {
      // Get user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Get all eligible schemes
      const eligibleSchemes = await this.getEligibleSchemes(userProfile);
      
      // Score each scheme
      const scoredSchemes = await Promise.all(
        eligibleSchemes.map(async (scheme) => {
          const score = await this.calculateRecommendationScore(userProfile, scheme);
          return { scheme, score };
        })
      );
      
      // Sort by score and return top recommendations
      const recommendations = scoredSchemes
        .sort((a, b) => b.score.score - a.score.score)
        .slice(0, limit)
        .map(item => ({
          ...item.scheme,
          recommendationScore: item.score.score,
          recommendationReasons: item.score.reasons
        }));
      
      // Log recommendation for learning
      await this.logRecommendation(userId, recommendations.map(r => r.id));
      
      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Fallback to basic recommendations
      return this.getFallbackRecommendations(userId, limit);
    }
  }

  /**
   * Calculate recommendation score for a scheme based on user profile
   */
  private async calculateRecommendationScore(
    userProfile: UserProfile, 
    scheme: Scheme
  ): Promise<RecommendationScore> {
    const scores = {
      categoryPreference: this.calculateCategoryPreferenceScore(userProfile, scheme),
      eligibilityMatch: this.calculateEligibilityScore(userProfile, scheme),
      historicalPattern: this.calculateHistoricalPatternScore(userProfile, scheme),
      amountSuitability: this.calculateAmountSuitabilityScore(userProfile, scheme),
      urgencyMatch: this.calculateUrgencyScore(userProfile, scheme)
    };

    // Calculate weighted score
    const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + (score * this.modelWeights[key as keyof typeof this.modelWeights]);
    }, 0);

    // Generate reasons for recommendation
    const reasons = this.generateRecommendationReasons(scores, scheme);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(userProfile, scores);

    return {
      schemeId: scheme.id,
      score: Math.round(totalScore * 100) / 100,
      reasons,
      confidence
    };
  }

  /**
   * Calculate category preference score based on user history and preferences
   */
  private calculateCategoryPreferenceScore(userProfile: UserProfile, scheme: Scheme): number {
    // Check explicit preferences
    if (userProfile.preferences.categories.includes(scheme.category)) {
      return 1.0;
    }

    // Check historical application patterns
    const categoryApplications = userProfile.applicationHistory.filter(
      app => app.category === scheme.category
    );
    
    if (categoryApplications.length === 0) {
      return 0.3; // Neutral score for unexplored categories
    }

    // Score based on success rate in this category
    const successfulApplications = categoryApplications.filter(
      app => app.status === 'approved' || app.status === 'disbursed'
    );
    
    return successfulApplications.length / categoryApplications.length;
  }

  /**
   * Calculate eligibility match score
   */
  private calculateEligibilityScore(userProfile: UserProfile, scheme: Scheme): number {
    let score = 1.0;
    
    // Service years check
    if (scheme.eligibilityRules.serviceYears > userProfile.employmentInfo.serviceYears) {
      score *= 0.5; // Reduce score if not meeting service years
    }
    
    // Salary range check
    const salary = userProfile.employmentInfo.salary;
    if (scheme.eligibilityRules.salaryRange) {
      if (salary < scheme.eligibilityRules.salaryRange.min || 
          salary > scheme.eligibilityRules.salaryRange.max) {
        score *= 0.3;
      }
    }
    
    // IC restrictions check
    if (scheme.eligibilityRules.icRestrictions.length > 0 && 
        !scheme.eligibilityRules.icRestrictions.includes(userProfile.employmentInfo.ic)) {
      score *= 0.2;
    }
    
    return score;
  }

  /**
   * Calculate historical pattern score based on similar users
   */
  private calculateHistoricalPatternScore(userProfile: UserProfile, scheme: Scheme): number {
    // Find similar users (same department, similar service years, similar salary range)
    const similarUserApplications = this.feedbackData.filter(feedback => {
      // This would typically query a database of user profiles
      // For now, we'll use a simplified approach
      return feedback.schemeId === scheme.id && 
             feedback.action === 'applied';
    });

    if (similarUserApplications.length === 0) {
      return 0.5; // Neutral score for schemes with no historical data
    }

    // Score based on application success rate among similar users
    return Math.min(similarUserApplications.length / 10, 1.0); // Cap at 1.0
  }

  /**
   * Calculate amount suitability score
   */
  private calculateAmountSuitabilityScore(userProfile: UserProfile, scheme: Scheme): number {
    const maxAmount = scheme.budgetInfo?.maxAmount || scheme.maxAmount;
    const userPreferredMax = userProfile.preferences.maxAmount;
    
    if (maxAmount <= userPreferredMax) {
      return 1.0;
    }
    
    // Gradually decrease score for amounts above preference
    const ratio = userPreferredMax / maxAmount;
    return Math.max(ratio, 0.1);
  }

  /**
   * Calculate urgency match score
   */
  private calculateUrgencyScore(userProfile: UserProfile, scheme: Scheme): number {
    const daysUntilExpiry = Math.ceil(
      (new Date(scheme.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    
    switch (userProfile.preferences.urgency) {
      case 'high':
        return daysUntilExpiry < 30 ? 1.0 : 0.5;
      case 'medium':
        return daysUntilExpiry < 90 ? 1.0 : 0.7;
      case 'low':
        return daysUntilExpiry > 90 ? 1.0 : 0.8;
      default:
        return 0.7;
    }
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateRecommendationReasons(scores: any, scheme: Scheme): string[] {
    const reasons: string[] = [];
    
    if (scores.categoryPreference > 0.7) {
      reasons.push(`Matches your preferred ${scheme.category} category`);
    }
    
    if (scores.eligibilityMatch === 1.0) {
      reasons.push('You meet all eligibility criteria');
    }
    
    if (scores.historicalPattern > 0.6) {
      reasons.push('Popular among employees with similar profiles');
    }
    
    if (scores.amountSuitability > 0.8) {
      reasons.push('Amount range suits your preferences');
    }
    
    if (scores.urgencyMatch > 0.8) {
      reasons.push('Application deadline aligns with your timeline');
    }
    
    return reasons.length > 0 ? reasons : ['Based on your profile and preferences'];
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(userProfile: UserProfile, scores: any): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on available data
    if (userProfile.applicationHistory.length > 0) {
      confidence += 0.2;
    }
    
    if (userProfile.preferences.categories.length > 0) {
      confidence += 0.15;
    }
    
    if (Object.values(scores).every(score => score > 0)) {
      confidence += 0.15;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Record user feedback for machine learning improvement
   */
  async recordFeedback(feedbackData: FeedbackData): Promise<void> {
    this.feedbackData.push(feedbackData);
    
    // Update model weights based on feedback (simplified)
    await this.updateModelWeights(feedbackData);
    
    // Store feedback in database for persistence
    // TODO: Implement database storage
  }

  /**
   * Update ML model weights based on user feedback
   */
  private async updateModelWeights(feedback: FeedbackData): Promise<void> {
    // Simplified learning algorithm
    // In a real implementation, this would use more sophisticated ML techniques
    
    const learningRate = 0.01;
    
    if (feedback.action === 'applied' && feedback.rating && feedback.rating >= 4) {
      // Positive feedback - slightly increase weights that contributed to this recommendation
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key as keyof typeof this.modelWeights] *= (1 + learningRate);
      });
    } else if (feedback.action === 'dismissed' || (feedback.rating && feedback.rating <= 2)) {
      // Negative feedback - slightly decrease weights
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key as keyof typeof this.modelWeights] *= (1 - learningRate);
      });
    }
    
    // Normalize weights to ensure they sum to 1
    const totalWeight = Object.values(this.modelWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(this.modelWeights).forEach(key => {
      this.modelWeights[key as keyof typeof this.modelWeights] /= totalWeight;
    });
  }

  /**
   * Get user profile with enriched data
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!;
    }

    // Build user profile from various sources
    const profile: UserProfile = {
      userId,
      employmentInfo: await this.getEmploymentInfo(userId),
      demographics: await this.getDemographics(userId),
      applicationHistory: await this.getApplicationHistory(userId),
      preferences: await this.getUserPreferences(userId)
    };

    // Cache the profile
    this.userProfiles.set(userId, profile);
    
    return profile;
  }

  /**
   * Get eligible schemes for user
   */
  private async getEligibleSchemes(userProfile: UserProfile): Promise<Scheme[]> {
    const allSchemes = await this.schemeRepository.findAll({ status: 'active' });
    
    return allSchemes.filter(scheme => {
      // Basic eligibility check
      return scheme.eligibilityRules.serviceYears <= userProfile.employmentInfo.serviceYears &&
             (scheme.eligibilityRules.icRestrictions.length === 0 || 
              scheme.eligibilityRules.icRestrictions.includes(userProfile.employmentInfo.ic));
    });
  }

  /**
   * Get fallback recommendations when AI fails
   */
  private async getFallbackRecommendations(userId: string, limit: number): Promise<Scheme[]> {
    const allSchemes = await this.schemeRepository.findAll({ 
      status: 'active',
      limit 
    });
    
    // Return most popular schemes
    return allSchemes.slice(0, limit);
  }

  /**
   * Get employment information from HRMS
   */
  private async getEmploymentInfo(userId: string): Promise<UserProfile['employmentInfo']> {
    // TODO: Integrate with HRMS service
    // For now, return mock data
    return {
      department: 'Engineering',
      ic: 'LTTS',
      serviceYears: 5,
      salary: 800000,
      status: 'active'
    };
  }

  /**
   * Get user demographics
   */
  private async getDemographics(userId: string): Promise<UserProfile['demographics']> {
    // TODO: Get from user service
    return {
      age: 32,
      dependents: [
        { relationship: 'spouse', age: 30 },
        { relationship: 'child', age: 5 }
      ]
    };
  }

  /**
   * Get user application history
   */
  private async getApplicationHistory(userId: string): Promise<UserProfile['applicationHistory']> {
    // TODO: Get from application service
    return [];
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserProfile['preferences']> {
    // TODO: Get from user preferences service
    return {
      categories: ['medical', 'education'],
      maxAmount: 100000,
      urgency: 'medium'
    };
  }

  /**
   * Log recommendation for analytics
   */
  private async logRecommendation(userId: string, schemeIds: string[]): Promise<void> {
    // TODO: Log to analytics service
    console.log(`Recommended schemes ${schemeIds.join(', ')} to user ${userId}`);
  }

  /**
   * Get recommendation analytics
   */
  async getRecommendationAnalytics(): Promise<{
    totalRecommendations: number;
    clickThroughRate: number;
    applicationRate: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    // TODO: Implement analytics calculation
    return {
      totalRecommendations: 0,
      clickThroughRate: 0,
      applicationRate: 0,
      topCategories: []
    };
  }
}