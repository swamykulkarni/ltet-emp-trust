import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { environment } from '../environments/environment';
import { JWTPayload, User } from '@ltet/shared-types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, environment.jwt.secret) as JWTPayload;
    
    // TODO: Fetch full user details from user service
    // For now, create a minimal user object
    req.user = {
      userId: decoded.userId,
      employeeId: decoded.employeeId,
      personalInfo: {
        name: 'Test User',
        email: 'test@ltet.com',
        phone: '9999999999',
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        }
      },
      employmentInfo: {
        department: 'IT',
        ic: 'LTET',
        joiningDate: new Date('2020-01-01'),
        status: 'active'
      },
      dependents: [],
      roles: decoded.roles,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const hasRole = req.user.roles.some(role => roles.includes(role));
    
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};