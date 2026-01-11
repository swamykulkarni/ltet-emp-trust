/**
 * Role-based Access Control Middleware for LTET Employee Trust Portal
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@ltet/shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    employeeId: string;
    roles: UserRole[];
    [key: string]: any;
  };
}

/**
 * Middleware to check if user has required roles
 */
export function roleMiddleware(requiredRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Check if user has any of the required roles
      const userRoles = req.user.roles || [];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: requiredRoles,
          current: userRoles,
        });
        return;
      }

      // User has required role, proceed
      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
}

/**
 * Middleware to check if user is admin
 */
export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  roleMiddleware(['admin', 'system_admin'])(req, res, next);
}

/**
 * Middleware to check if user is system admin
 */
export function systemAdminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  roleMiddleware(['system_admin'])(req, res, next);
}

/**
 * Middleware to check if user can approve applications
 */
export function approverMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  roleMiddleware(['approver', 'admin', 'head'])(req, res, next);
}

/**
 * Middleware to check if user can manage finance
 */
export function financeMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  roleMiddleware(['finance', 'admin'])(req, res, next);
}