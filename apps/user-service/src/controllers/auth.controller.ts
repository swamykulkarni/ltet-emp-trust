import { Request, Response } from 'express';
import { LoginRequest } from '@ltet/shared-types';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            user: result.user,
            token: result.token,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn
          },
          message: 'Login successful'
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await this.authService.logout(req.user.userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Logout successful'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            user: result.user,
            token: result.token,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn
          },
          message: 'Token refreshed successfully'
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
        return;
      }

      const result = await this.authService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Password changed successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  verifyToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: req.user,
          valid: true
        },
        message: 'Token is valid'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}