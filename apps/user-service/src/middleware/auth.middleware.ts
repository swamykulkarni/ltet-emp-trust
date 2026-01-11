import { Request, Response, NextFunction } from 'express';
import { UserRole, JWTPayload } from '@ltet/shared-types';
import { AuthService } from '../services/auth.service';
import { RoleUtils } from '@ltet/shared-utils';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Access token required'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const verificationResult = await this.authService.verifyToken(token);

      if (!verificationResult.valid || !verificationResult.payload) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
        return;
      }

      req.user = verificationResult.payload;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  };

  /**
   * Middleware to authorize specific roles
   */
  authorize = (requiredRoles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const hasRequiredRole = RoleUtils.hasAnyRole(req.user.roles, requiredRoles);
      
      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if user can approve applications
   */
  canApprove = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!RoleUtils.canApprove(req.user.roles)) {
      res.status(403).json({
        success: false,
        error: 'Approval permissions required'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to check if user can manage finance operations
   */
  canManageFinance = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!RoleUtils.canManageFinance(req.user.roles)) {
      res.status(403).json({
        success: false,
        error: 'Finance management permissions required'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to check if user can administer the system
   */
  canAdminister = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!RoleUtils.canAdminister(req.user.roles)) {
      res.status(403).json({
        success: false,
        error: 'Administrator permissions required'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to check if user can access their own resources or has admin privileges
   */
  canAccessUserResource = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const targetUserId = req.params.userId || req.params.id;
    const isOwnResource = req.user.userId === targetUserId;
    const hasAdminAccess = RoleUtils.canAdminister(req.user.roles);

    if (!isOwnResource && !hasAdminAccess) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    next();
  };

  /**
   * Optional authentication - sets user if token is valid but doesn't fail if missing
   */
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const verificationResult = await this.authService.verifyToken(token);

        if (verificationResult.valid && verificationResult.payload) {
          req.user = verificationResult.payload;
        }
      }

      next();
    } catch (error) {
      // Continue without authentication for optional auth
      next();
    }
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();