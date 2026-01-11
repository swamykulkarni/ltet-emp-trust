import { Scheme, User } from '@ltet/shared-types';
import { SchemeRepository } from '../repositories/scheme.repository';
import { EligibilityRulesService } from './eligibility-rules.service';

export interface DiscoveryFilter {
  category?: 'medical' | 'education' | 'skill_building';
  deadline?: {
    upcoming?: boolean; // Schemes with deadlines in next 30 days
    days?: number; // Schemes with deadlines in next X days
  };
  ic?: string; // Independent Company filter
  search?: string; // Text search in name and description
  eligibleOnly?: boolean; // Only show eligible schemes for user
  sortBy?: 'name' | 'deadline' | 'category' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SchemeCard {
  schemeId: string;
  name: string;
  category: 'medical' | 'education' | 'skill_building';
  description: string;
  shortDescription: string;
  maxAmount: number;
  deadline: Date;
  daysUntilDeadline: number;
  isEligible: boolean;
  eligibilityReasons?: string[];
  documentCount: number;
  estimatedProcessingTime: string;
  tags: string[];
}

export interface SchemeDetail extends SchemeCard {
  fullDescription: string;
  eligibilityRules: any;
  documentRequirements: any[];
  approvalWorkflow: any;
  faqs: FAQ[];
  relatedSchemes: SchemeCard[];
  applicationStats: {
    totalApplications: number;
    averageProcessingTime: number;
    approvalRate: number;
  };
}

export interface FAQ {
  question: string;
  answer: string;
  category: string;
}

export class SchemeDiscoveryService {
  private schemeRepository: SchemeRepository;
  private eligibilityService: EligibilityRulesService;

  constructor() {
    this.schemeRepository = new SchemeRepository();
    this.eligibilityService = new EligibilityRulesService();
  }

  /**
   * Discovers schemes with advanced filtering and real-time updates
   */
  async discoverSchemes(user: User, filter: DiscoveryFilter = {}): Promise<{
    schemes: SchemeCard[];
    total: number;
    hasMore: boolean;
    filters: {
      categories: Array<{ value: string; count: number }>;
      ics: Array<{ value: string; count: number }>;
      deadlines: Array<{ label: string; count: number }>;
    };
  }> {
    // Get base schemes with filtering
    const baseFilter = {
      category: filter.category,
      status: 'active' as const,
      search: filter.search
    };

    let schemes = await this.schemeRepository.findAll(baseFilter);

    // Apply deadline filtering
    if (filter.deadline) {
      schemes = this.filterByDeadline(schemes, filter.deadline);
    }

    // Apply IC filtering
    if (filter.ic) {
      schemes = this.filterByIC(schemes, filter.ic);
    }

    // Apply eligibility filtering
    if (filter.eligibleOnly) {
      const eligibleSchemes: Scheme[] = [];
      for (const scheme of schemes) {
        const isEligible = await this.eligibilityService.evaluateEligibility(user, scheme);
        if (isEligible) {
          eligibleSchemes.push(scheme);
        }
      }
      schemes = eligibleSchemes;
    }

    // Sort schemes
    schemes = this.sortSchemes(schemes, filter.sortBy, filter.sortOrder);

    // Calculate total before pagination
    const total = schemes.length;

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 20;
    const paginatedSchemes = schemes.slice(offset, offset + limit);

    // Convert to scheme cards
    const schemeCards = await Promise.all(
      paginatedSchemes.map(scheme => this.convertToSchemeCard(scheme, user))
    );

    // Generate filter options
    const filterOptions = await this.generateFilterOptions(schemes);

    return {
      schemes: schemeCards,
      total,
      hasMore: offset + limit < total,
      filters: filterOptions
    };
  }

  /**
   * Gets detailed scheme information with FAQs and related schemes
   */
  async getSchemeDetail(schemeId: string, user: User): Promise<SchemeDetail | null> {
    const scheme = await this.schemeRepository.findById(schemeId);
    if (!scheme) {
      return null;
    }

    // Convert to scheme card first
    const schemeCard = await this.convertToSchemeCard(scheme, user);

    // Get FAQs
    const faqs = await this.getSchemeFAQs(schemeId);

    // Get related schemes
    const relatedSchemes = await this.getRelatedSchemes(scheme, user);

    // Get application statistics
    const applicationStats = await this.getApplicationStats(schemeId);

    return {
      ...schemeCard,
      fullDescription: scheme.description,
      eligibilityRules: scheme.eligibilityRules,
      documentRequirements: scheme.documentRequirements,
      approvalWorkflow: scheme.approvalWorkflow,
      faqs,
      relatedSchemes,
      applicationStats
    };
  }

  /**
   * Gets real-time scheme updates for active filters
   */
  async getSchemeUpdates(lastUpdateTime: Date, filter: DiscoveryFilter = {}): Promise<{
    newSchemes: SchemeCard[];
    updatedSchemes: SchemeCard[];
    removedSchemeIds: string[];
  }> {
    // This would typically use database change streams or event sourcing
    // For now, we'll implement a simple timestamp-based approach
    
    const baseFilter = {
      category: filter.category,
      status: 'active' as const,
      search: filter.search
    };

    const allSchemes = await this.schemeRepository.findAll(baseFilter);
    
    const newSchemes: Scheme[] = [];
    const updatedSchemes: Scheme[] = [];
    
    allSchemes.forEach(scheme => {
      // Assuming we have created_at and updated_at fields
      const createdAt = new Date(scheme.validFrom); // Placeholder
      const updatedAt = new Date(scheme.validTo); // Placeholder
      
      if (createdAt > lastUpdateTime) {
        newSchemes.push(scheme);
      } else if (updatedAt > lastUpdateTime) {
        updatedSchemes.push(scheme);
      }
    });

    // For removed schemes, we'd need to track deletions
    const removedSchemeIds: string[] = [];

    return {
      newSchemes: await Promise.all(newSchemes.map(s => this.convertToSchemeCard(s, {} as User))),
      updatedSchemes: await Promise.all(updatedSchemes.map(s => this.convertToSchemeCard(s, {} as User))),
      removedSchemeIds
    };
  }

  /**
   * Gets scheme recommendations based on user profile and behavior
   */
  async getSchemeRecommendations(user: User, limit: number = 5): Promise<SchemeCard[]> {
    // Get all eligible schemes
    const eligibleSchemes = await this.schemeRepository.findAll({ status: 'active' });
    const recommendations: Array<{ scheme: Scheme; score: number }> = [];

    for (const scheme of eligibleSchemes) {
      const isEligible = await this.eligibilityService.evaluateEligibility(user, scheme);
      if (isEligible) {
        const score = this.calculateRecommendationScore(user, scheme);
        recommendations.push({ scheme, score });
      }
    }

    // Sort by score and take top recommendations
    recommendations.sort((a, b) => b.score - a.score);
    const topRecommendations = recommendations.slice(0, limit);

    return Promise.all(
      topRecommendations.map(({ scheme }) => this.convertToSchemeCard(scheme, user))
    );
  }

  private filterByDeadline(schemes: Scheme[], deadlineFilter: DiscoveryFilter['deadline']): Scheme[] {
    if (!deadlineFilter) return schemes;

    const now = new Date();
    const targetDays = deadlineFilter.days || (deadlineFilter.upcoming ? 30 : 0);
    const targetDate = new Date(now.getTime() + targetDays * 24 * 60 * 60 * 1000);

    return schemes.filter(scheme => {
      const deadline = new Date(scheme.validTo);
      return deadline <= targetDate && deadline >= now;
    });
  }

  private filterByIC(schemes: Scheme[], ic: string): Scheme[] {
    return schemes.filter(scheme => {
      const icRestrictions = scheme.eligibilityRules.icRestrictions;
      return !icRestrictions || icRestrictions.length === 0 || icRestrictions.includes(ic);
    });
  }

  private sortSchemes(schemes: Scheme[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Scheme[] {
    const sorted = [...schemes];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'deadline':
          comparison = new Date(a.validTo).getTime() - new Date(b.validTo).getTime();
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'created_at':
        default:
          comparison = new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  private async convertToSchemeCard(scheme: Scheme, user: User): Promise<SchemeCard> {
    const deadline = new Date(scheme.validTo);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check eligibility
    const isEligible = await this.eligibilityService.evaluateEligibility(user, scheme);

    // Generate tags
    const tags = this.generateSchemeTags(scheme);

    // Calculate estimated processing time
    const estimatedProcessingTime = this.calculateProcessingTime(scheme);

    return {
      schemeId: scheme.schemeId,
      name: scheme.name,
      category: scheme.category,
      description: scheme.description,
      shortDescription: this.truncateDescription(scheme.description, 150),
      maxAmount: scheme.budgetInfo.maxAmount,
      deadline,
      daysUntilDeadline,
      isEligible,
      documentCount: scheme.documentRequirements.length,
      estimatedProcessingTime,
      tags
    };
  }

  private async generateFilterOptions(schemes: Scheme[]): Promise<{
    categories: Array<{ value: string; count: number }>;
    ics: Array<{ value: string; count: number }>;
    deadlines: Array<{ label: string; count: number }>;
  }> {
    const categories = new Map<string, number>();
    const ics = new Map<string, number>();
    const deadlines = new Map<string, number>();

    schemes.forEach(scheme => {
      // Count categories
      categories.set(scheme.category, (categories.get(scheme.category) || 0) + 1);

      // Count ICs
      const icRestrictions = scheme.eligibilityRules.icRestrictions || [];
      if (icRestrictions.length === 0) {
        ics.set('All ICs', (ics.get('All ICs') || 0) + 1);
      } else {
        icRestrictions.forEach((ic: string) => {
          ics.set(ic, (ics.get(ic) || 0) + 1);
        });
      }

      // Count deadlines
      const deadline = new Date(scheme.validTo);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline <= 7) {
        deadlines.set('This Week', (deadlines.get('This Week') || 0) + 1);
      } else if (daysUntilDeadline <= 30) {
        deadlines.set('This Month', (deadlines.get('This Month') || 0) + 1);
      } else if (daysUntilDeadline <= 90) {
        deadlines.set('Next 3 Months', (deadlines.get('Next 3 Months') || 0) + 1);
      }
    });

    return {
      categories: Array.from(categories.entries()).map(([value, count]) => ({ value, count })),
      ics: Array.from(ics.entries()).map(([value, count]) => ({ value, count })),
      deadlines: Array.from(deadlines.entries()).map(([label, count]) => ({ label, count }))
    };
  }

  private async getSchemeFAQs(schemeId: string): Promise<FAQ[]> {
    // This would typically come from a database
    // For now, return some default FAQs
    return [
      {
        question: 'What documents are required for this scheme?',
        answer: 'Please refer to the document requirements section for a complete list of required documents.',
        category: 'Documents'
      },
      {
        question: 'How long does the approval process take?',
        answer: 'The typical approval process takes 5-7 business days, depending on the complexity of your application.',
        category: 'Process'
      },
      {
        question: 'Can I apply for multiple schemes simultaneously?',
        answer: 'Yes, you can apply for multiple schemes as long as you meet the eligibility criteria for each.',
        category: 'Eligibility'
      }
    ];
  }

  private async getRelatedSchemes(scheme: Scheme, user: User): Promise<SchemeCard[]> {
    // Find schemes in the same category
    const relatedSchemes = await this.schemeRepository.findAll({
      category: scheme.category,
      status: 'active'
    });

    // Filter out the current scheme and limit to 3
    const filtered = relatedSchemes
      .filter(s => s.schemeId !== scheme.schemeId)
      .slice(0, 3);

    return Promise.all(
      filtered.map(s => this.convertToSchemeCard(s, user))
    );
  }

  private async getApplicationStats(schemeId: string): Promise<{
    totalApplications: number;
    averageProcessingTime: number;
    approvalRate: number;
  }> {
    // This would typically come from the application service
    // For now, return mock data
    return {
      totalApplications: 150,
      averageProcessingTime: 5.2,
      approvalRate: 0.85
    };
  }

  private calculateRecommendationScore(user: User, scheme: Scheme): number {
    let score = 0;

    // Base score for eligibility
    score += 10;

    // Bonus for matching IC
    if (!scheme.eligibilityRules.icRestrictions || 
        scheme.eligibilityRules.icRestrictions.includes(user.employmentInfo.ic)) {
      score += 5;
    }

    // Bonus for approaching deadline
    const deadline = new Date(scheme.validTo);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline <= 30) {
      score += 3;
    }

    // Bonus for high budget schemes
    if (scheme.budgetInfo.maxAmount > 50000) {
      score += 2;
    }

    return score;
  }

  private generateSchemeTags(scheme: Scheme): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(scheme.category);

    // Add deadline urgency tag
    const deadline = new Date(scheme.validTo);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDeadline <= 7) {
      tags.push('Urgent');
    } else if (daysUntilDeadline <= 30) {
      tags.push('Deadline Soon');
    }

    // Add amount tag
    if (scheme.budgetInfo.maxAmount >= 100000) {
      tags.push('High Value');
    }

    // Add document complexity tag
    if (scheme.documentRequirements.length <= 2) {
      tags.push('Simple Application');
    } else if (scheme.documentRequirements.length >= 5) {
      tags.push('Detailed Application');
    }

    return tags;
  }

  private calculateProcessingTime(scheme: Scheme): string {
    const slaHours = scheme.approvalWorkflow.slaHours;
    const days = Math.ceil(slaHours / 24);
    
    if (days === 1) {
      return '1 day';
    } else if (days <= 7) {
      return `${days} days`;
    } else {
      const weeks = Math.ceil(days / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
  }

  private truncateDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }
    
    return description.substring(0, maxLength).trim() + '...';
  }
}