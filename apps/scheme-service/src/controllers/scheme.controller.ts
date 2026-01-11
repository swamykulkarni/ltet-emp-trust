import { Request, Response } from 'express';
import { SchemeService } from '../services/scheme.service';
import { CreateSchemeRequest, UpdateSchemeRequest, SchemeFilter } from '../models/scheme.model';
import { ApiResponse } from '@ltet/shared-types';

export class SchemeController {
  private schemeService: SchemeService;

  constructor() {
    this.schemeService = new SchemeService();
  }

  /**
   * Create a new scheme
   */
  createScheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const schemeData: CreateSchemeRequest = req.body;
      const createdBy = req.user?.userId || 'system'; // TODO: Get from auth middleware

      const scheme = await this.schemeService.createScheme(schemeData, createdBy);

      const response: ApiResponse<typeof scheme> = {
        success: true,
        data: scheme,
        message: 'Scheme created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scheme'
      };

      res.status(400).json(response);
    }
  };

  /**
   * Get scheme by ID
   */
  getSchemeById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const scheme = await this.schemeService.getSchemeById(schemeId);

      if (!scheme) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof scheme> = {
        success: true,
        data: scheme
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get all schemes with filtering
   */
  getSchemes = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: SchemeFilter = {
        category: req.query.category as any,
        status: req.query.status as any,
        search: req.query.search as string,
        icRestrictions: req.query.ic ? [req.query.ic as string] : undefined
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof SchemeFilter] === undefined) {
          delete filter[key as keyof SchemeFilter];
        }
      });

      const schemes = await this.schemeService.getSchemes(filter);

      const response: ApiResponse<typeof schemes> = {
        success: true,
        data: schemes
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get schemes'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get eligible schemes for a user
   */
  getEligibleSchemes = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user; // TODO: Get from auth middleware
      if (!user) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'User not authenticated'
        };
        res.status(401).json(response);
        return;
      }

      const filter: SchemeFilter = {
        category: req.query.category as any,
        search: req.query.search as string
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof SchemeFilter] === undefined) {
          delete filter[key as keyof SchemeFilter];
        }
      });

      const schemes = await this.schemeService.getEligibleSchemes(user, filter);

      const response: ApiResponse<typeof schemes> = {
        success: true,
        data: schemes
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get eligible schemes'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Update a scheme
   */
  updateScheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const updateData: UpdateSchemeRequest = req.body;

      const scheme = await this.schemeService.updateScheme(schemeId, updateData);

      if (!scheme) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof scheme> = {
        success: true,
        data: scheme,
        message: 'Scheme updated successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scheme'
      };

      res.status(400).json(response);
    }
  };

  /**
   * Delete a scheme
   */
  deleteScheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const deleted = await this.schemeService.deleteScheme(schemeId);

      if (!deleted) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<null> = {
        success: true,
        message: 'Scheme deleted successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete scheme'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Publish a scheme
   */
  publishScheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const scheme = await this.schemeService.publishScheme(schemeId);

      if (!scheme) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof scheme> = {
        success: true,
        data: scheme,
        message: 'Scheme published successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish scheme'
      };

      res.status(400).json(response);
    }
  };

  /**
   * Get scheme versions
   */
  getSchemeVersions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const versions = await this.schemeService.getSchemeVersions(schemeId);

      const response: ApiResponse<typeof versions> = {
        success: true,
        data: versions
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme versions'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Create rule builder configuration
   */
  createRuleBuilder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.query;
      const ruleBuilder = await this.schemeService.createRuleBuilder(schemeId as string);

      const response: ApiResponse<typeof ruleBuilder> = {
        success: true,
        data: ruleBuilder
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rule builder'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Update eligibility rules using rule builder
   */
  updateEligibilityRules = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const ruleBuilder = req.body;

      const scheme = await this.schemeService.updateEligibilityRules(schemeId, ruleBuilder);

      if (!scheme) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof scheme> = {
        success: true,
        data: scheme,
        message: 'Eligibility rules updated successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update eligibility rules'
      };

      res.status(400).json(response);
    }
  };

  /**
   * Get available rule types
   */
  getAvailableRuleTypes = async (req: Request, res: Response): Promise<void> => {
    try {
      const ruleTypes = this.schemeService.getAvailableRuleTypes();

      const response: ApiResponse<typeof ruleTypes> = {
        success: true,
        data: ruleTypes
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get rule types'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Check user eligibility for a scheme
   */
  checkEligibility = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const { userId } = req.query;

      const eligibility = await this.schemeService.checkEligibility(
        userId as string || req.user?.userId,
        schemeId
      );

      const response: ApiResponse<typeof eligibility> = {
        success: true,
        data: eligibility
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check eligibility'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get scheme statistics
   */
  getSchemeStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const statistics = await this.schemeService.getSchemeStatistics();

      const response: ApiResponse<typeof statistics> = {
        success: true,
        data: statistics
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme statistics'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get AI-powered scheme recommendations for a user
   */
  getSchemeRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;

      const recommendations = await this.schemeService.getSchemeRecommendations(userId, limit);

      const response: ApiResponse<typeof recommendations> = {
        success: true,
        data: recommendations,
        message: 'Recommendations generated successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendations'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Record user feedback on recommendations
   */
  recordRecommendationFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, schemeId } = req.params;
      const { action, rating } = req.body;

      await this.schemeService.recordRecommendationFeedback(userId, schemeId, action, rating);

      const response: ApiResponse<null> = {
        success: true,
        message: 'Feedback recorded successfully'
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record feedback'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get recommendation analytics for admin dashboard
   */
  getRecommendationAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const analytics = await this.schemeService.getRecommendationAnalytics();

      const response: ApiResponse<typeof analytics> = {
        success: true,
        data: analytics
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendation analytics'
      };

      res.status(500).json(response);
    }
  };
}