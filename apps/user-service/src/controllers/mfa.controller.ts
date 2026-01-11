import { Request, Response } from 'express';
import { MFAService } from '../services/mfa.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditLoggerService } from '@ltet/shared-utils';

export class MFAController {
  private mfaService: MFAService;
  private auditLogger: AuditLoggerService;

  constructor() {
    this.mfaService = new MFAService();
    this.auditLogger = AuditLoggerService.getInstance();
  }

  /**
   * Setup MFA for user
   */
  setupMFA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const userEmail = req.user!.email || req.body.email;

      if (!userEmail) {
        res.status(400).json({
          success: false,
          error: 'Email is required for MFA setup'
        });
        return;
      }

      // Check if MFA is required for user's roles
      if (!this.mfaService.isRequiredForUser(req.user!.roles)) {
        res.status(403).json({
          success: false,
          error: 'MFA is not required for your role'
        });
        return;
      }

      const result = await this.mfaService.setupMFA(userId, userEmail);

      // Log MFA setup attempt
      await this.auditLogger.logAuthEvent(
        userId,
        'mfa_setup',
        result.success,
        req.ip,
        req.get('User-Agent') || '',
        req.sessionID,
        { userRole: req.user!.roles.join(',') },
        result.error
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        data: {
          qrCodeUrl: result.qrCodeUrl,
          backupCodes: result.backupCodes,
          message: 'Scan the QR code with your authenticator app and verify with a code to enable MFA'
        }
      });
    } catch (error) {
      console.error('MFA setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Verify and enable MFA
   */
  verifyAndEnableMFA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Verification token is required'
        });
        return;
      }

      const result = await this.mfaService.verifyAndEnableMFA(userId, token);

      // Log MFA verification attempt
      await this.auditLogger.logAuthEvent(
        userId,
        'mfa_verify',
        result.success,
        req.ip,
        req.get('User-Agent') || '',
        req.sessionID,
        { 
          userRole: req.user!.roles.join(','),
          action: 'enable_mfa'
        },
        result.error
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: 'MFA has been successfully enabled for your account'
      });
    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Verify MFA token during login
   */
  verifyMFAToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'MFA token is required'
        });
        return;
      }

      const result = await this.mfaService.verifyMFAToken(userId, token);

      // Log MFA verification attempt
      await this.auditLogger.logAuthEvent(
        userId,
        'mfa_verify',
        result.success,
        req.ip,
        req.get('User-Agent') || '',
        req.sessionID,
        { 
          userRole: req.user!.roles.join(','),
          action: 'login_verification',
          tokenType: token.length === 8 ? 'backup_code' : 'totp'
        },
        result.error
      );

      if (!result.success) {
        res.status(401).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: 'MFA verification successful'
      });
    } catch (error) {
      console.error('MFA token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get MFA status for user
   */
  getMFAStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const status = await this.mfaService.getMFAStatus(userId);

      res.json({
        success: true,
        data: {
          ...status,
          required: this.mfaService.isRequiredForUser(req.user!.roles)
        }
      });
    } catch (error) {
      console.error('Get MFA status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Disable MFA (admin function)
   */
  disableMFA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const adminUserId = req.user!.userId;

      // Only allow admins to disable MFA for other users
      if (userId !== adminUserId && !req.user!.roles.includes('admin') && !req.user!.roles.includes('system_admin')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to disable MFA for other users'
        });
        return;
      }

      const result = await this.mfaService.disableMFA(userId);

      // Log MFA disable action
      await this.auditLogger.logAdminAction(
        adminUserId,
        req.user!.roles.join(','),
        'disable_mfa',
        'user_mfa',
        userId,
        req.ip,
        req.get('User-Agent') || '',
        req.sessionID,
        result.success,
        { 
          targetUserId: userId,
          adminAction: true
        },
        result.error
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: 'MFA has been disabled'
      });
    } catch (error) {
      console.error('Disable MFA error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const result = await this.mfaService.regenerateBackupCodes(userId);

      // Log backup code regeneration
      await this.auditLogger.logAuthEvent(
        userId,
        'mfa_backup_codes_regenerated',
        result.success,
        req.ip,
        req.get('User-Agent') || '',
        req.sessionID,
        { userRole: req.user!.roles.join(',') },
        result.error
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        data: {
          backupCodes: result.backupCodes,
          message: 'New backup codes generated. Store them securely as they replace your previous codes.'
        }
      });
    } catch (error) {
      console.error('Regenerate backup codes error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}