import { Request, Response } from 'express';
import { AccountLockoutService } from '../services/account-lockout.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class LockoutController {
  private lockoutService: AccountLockoutService;

  constructor() {
    this.lockoutService = new AccountLockoutService();
  }

  /**
   * Check lockout status for a user
   */
  checkLockoutStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId } = req.params;
      
      if (!employeeId) {
        res.status(400).json({
          success: false,
          error: 'Employee ID is required'
        });
        return;
      }

      // For security, we'll only return basic lockout info
      res.status(200).json({
        success: true,
        message: 'Use login endpoint to check account status'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Request OTP for account unlock
   */
  requestUnlockOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId } = req.body;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          error: 'Employee ID is required'
        });
        return;
      }

      const result = await this.lockoutService.requestUnlockOTP(employeeId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            otpId: result.otpId
          },
          message: 'Unlock OTP has been sent to your registered email and phone number'
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

  /**
   * Verify OTP and unlock account
   */
  unlockAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { otpId, otp } = req.body;

      if (!otpId || !otp) {
        res.status(400).json({
          success: false,
          error: 'OTP ID and OTP are required'
        });
        return;
      }

      const result = await this.lockoutService.unlockAccountWithOTP(otpId, otp);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Account unlocked successfully. You can now login.'
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

  /**
   * Admin function to clear lockout
   */
  clearLockout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const result = await this.lockoutService.clearLockout(userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Account lockout cleared successfully'
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

  /**
   * Get lockout statistics (admin only)
   */
  getLockoutStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const stats = await this.lockoutService.getLockoutStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Lockout statistics retrieved successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}