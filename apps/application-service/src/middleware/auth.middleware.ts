/**
 * Authentication Middleware for LTET Employee Trust Portal
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@ltet/shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    employeeId: string;
    roles: UserRole[];
    [key: string]: any;
  };
}

interface JWTPayload {
  userId: string;
  employeeId: string;
  roles: UserRole[];
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate JWT tokens
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable not set');
      res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Attach user information to request
    req.user = {
      userId: decoded.userId,
      employeeId: decoded.employeeId,
      roles: decoded.roles,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      });
      return;
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
      req.user = {
        userId: decoded.userId,
        employeeId: decoded.employeeId,
        roles: decoded.roles,
      };
    } catch {
      // Invalid token, continue without authentication
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
}