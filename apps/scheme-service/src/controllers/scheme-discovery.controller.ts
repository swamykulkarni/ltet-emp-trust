import { Request, Response } from 'express';
import { SchemeDiscoveryService, DiscoveryFilter } from '../services/scheme-discovery.service';
import { ApiResponse } from '@ltet/shared-types';

export class SchemeDiscoveryController {
  private discoveryService: SchemeDiscoveryService;

  constructor() {
    this.discoveryService = new SchemeDiscoveryService();
  }

  /**
   * Discover schemes with advanced filtering
   */
  discoverSchemes = async (req: Request, res: Response): Promise<void> => {
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

      const filter: DiscoveryFilter = {
        category: req.query.category as any,
        deadline: req.query.deadline ? {
          upcoming: req.query.deadline === 'upcoming',
          days: req.query.deadlineDays ? parseInt(req.query.deadlineDays as string) : undefined
        } : undefined,
        ic: req.query.ic as string,
        search: req.query.search as string,
        eligibleOnly: req.query.eligibleOnly === 'true',
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof DiscoveryFilter] === undefined) {
          delete filter[key as keyof DiscoveryFilter];
        }
      });

      const result = await this.discoveryService.discoverSchemes(user, filter);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover schemes'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get detailed scheme information
   */
  getSchemeDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { schemeId } = req.params;
      const user = req.user; // TODO: Get from auth middleware
      
      if (!user) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'User not authenticated'
        };
        res.status(401).json(response);
        return;
      }

      const schemeDetail = await this.discoveryService.getSchemeDetail(schemeId, user);

      if (!schemeDetail) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Scheme not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof schemeDetail> = {
        success: true,
        data: schemeDetail
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme detail'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get real-time scheme updates
   */
  getSchemeUpdates = async (req: Request, res: Response): Promise<void> => {
    try {
      const lastUpdateTime = req.query.lastUpdate 
        ? new Date(req.query.lastUpdate as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago

      const filter: DiscoveryFilter = {
        category: req.query.category as any,
        ic: req.query.ic as string,
        search: req.query.search as string
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof DiscoveryFilter] === undefined) {
          delete filter[key as keyof DiscoveryFilter];
        }
      });

      const updates = await this.discoveryService.getSchemeUpdates(lastUpdateTime, filter);

      const response: ApiResponse<typeof updates> = {
        success: true,
        data: updates
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme updates'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get scheme recommendations
   */
  getSchemeRecommendations = async (req: Request, res: Response): Promise<void> => {
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

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const recommendations = await this.discoveryService.getSchemeRecommendations(user, limit);

      const response: ApiResponse<typeof recommendations> = {
        success: true,
        data: recommendations
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme recommendations'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Search schemes with advanced text search
   */
  searchSchemes = async (req: Request, res: Response): Promise<void> => {
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

      const searchQuery = req.query.q as string;
      if (!searchQuery || searchQuery.trim().length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Search query is required'
        };
        res.status(400).json(response);
        return;
      }

      const filter: DiscoveryFilter = {
        search: searchQuery,
        category: req.query.category as any,
        ic: req.query.ic as string,
        eligibleOnly: req.query.eligibleOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof DiscoveryFilter] === undefined) {
          delete filter[key as keyof DiscoveryFilter];
        }
      });

      const result = await this.discoveryService.discoverSchemes(user, filter);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search schemes'
      };

      res.status(500).json(response);
    }
  };

  /**
   * Get scheme categories with counts
   */
  getSchemeCategories = async (req: Request, res: Response): Promise<void> => {
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

      // Get all schemes to calculate categories
      const result = await this.discoveryService.discoverSchemes(user, {});
      
      const categories = result.filters.categories.map(cat => ({
        name: cat.value,
        count: cat.count,
        displayName: this.formatCategoryName(cat.value)
      }));

      const response: ApiResponse<typeof categories> = {
        success: true,
        data: categories
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheme categories'
      };

      res.status(500).json(response);
    }
  };

  private formatCategoryName(category: string): string {
    switch (category) {
      case 'medical':
        return 'Medical & Healthcare';
      case 'education':
        return 'Education & Learning';
      case 'skill_building':
        return 'Skill Building & Training';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
}