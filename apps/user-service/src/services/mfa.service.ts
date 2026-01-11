import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { UserRepository } from '../repositories/user.repository';
import { EncryptionService } from '@ltet/shared-utils';
import { VALIDATION_CONSTANTS } from '@ltet/shared-constants';

export interface MFASetupResult {
  success: boolean;
  secret?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
  error?: string;
}

export interface MFAVerificationResult {
  success: boolean;
  error?: string;
}

export interface MFAStatus {
  enabled: boolean;
  backupCodesRemaining?: number;
  lastUsed?: Date;
}

/**
 * Multi-Factor Authentication service for elevated roles
 * Implements TOTP (Time-based One-Time Password) and backup codes
 */
export class MFAService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Check if user requires MFA based on their roles
   */
  isRequiredForUser(roles: string[]): boolean {
    const elevatedRoles = ['admin', 'system_admin', 'finance', 'head'];
    return roles.some(role => elevatedRoles.includes(role));
  }

  /**
   * Setup MFA for a user - generates secret and QR code
   */
  async setupMFA(userId: string, userEmail: string): Promise<MFASetupResult> {
    try {
      // Check if user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `LTET Portal (${userEmail})`,
        issuer: 'L&T Employee Trust Portal',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Encrypt and store secret and backup codes
      const encryptedSecret = EncryptionService.encryptData(secret.base32, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key');
      const encryptedBackupCodes = backupCodes.map(code => 
        EncryptionService.encryptData(code, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key')
      );

      // Store in database (not enabled until verified)
      await this.userRepository.storeMFASecret(userId, encryptedSecret, encryptedBackupCodes);

      return {
        success: true,
        secret: secret.base32,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA setup failed'
      };
    }
  }

  /**
   * Verify MFA setup and enable it for the user
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaSecret) {
        return {
          success: false,
          error: 'MFA not set up for this user'
        };
      }

      // Decrypt secret
      const secret = EncryptionService.decryptData(user.mfaSecret, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key');

      // Verify token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time steps (60 seconds) tolerance
      });

      if (!verified) {
        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      // Enable MFA for user
      await this.userRepository.enableMFA(userId);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      };
    }
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFAToken(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return {
          success: false,
          error: 'MFA not enabled for this user'
        };
      }

      // Check if it's a backup code first
      if (token.length === 8 && /^[A-Z0-9]{8}$/.test(token)) {
        return await this.verifyBackupCode(userId, token);
      }

      // Decrypt secret
      const secret = EncryptionService.decryptData(user.mfaSecret, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key');

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time steps (60 seconds) tolerance
      });

      if (!verified) {
        return {
          success: false,
          error: 'Invalid authentication code'
        };
      }

      // Update last used timestamp
      await this.userRepository.updateMFALastUsed(userId);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      };
    }
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaBackupCodes) {
        return {
          success: false,
          error: 'No backup codes available'
        };
      }

      // Decrypt backup codes - parse JSON string first
      const backupCodesArray = JSON.parse(user.mfaBackupCodes);
      const backupCodes = backupCodesArray.map((encryptedCode: string) =>
        EncryptionService.decryptData(encryptedCode, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key')
      );

      // Check if code exists and hasn't been used
      const codeIndex = backupCodes.indexOf(code);
      if (codeIndex === -1) {
        return {
          success: false,
          error: 'Invalid backup code'
        };
      }

      // Remove used backup code
      await this.userRepository.removeUsedBackupCode(userId, codeIndex);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backup code verification failed'
      };
    }
  }

  /**
   * Get MFA status for user
   */
  async getMFAStatus(userId: string): Promise<MFAStatus> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { enabled: false };
      }

      let backupCodesRemaining = 0;
      if (user.mfaBackupCodes) {
        try {
          const backupCodesArray = JSON.parse(user.mfaBackupCodes);
          backupCodesRemaining = Array.isArray(backupCodesArray) ? backupCodesArray.length : 0;
        } catch {
          backupCodesRemaining = 0;
        }
      }

      return {
        enabled: user.mfaEnabled || false,
        backupCodesRemaining,
        lastUsed: user.mfaLastUsed
      };
    } catch (error) {
      return { enabled: false };
    }
  }

  /**
   * Disable MFA for user (admin function)
   */
  async disableMFA(userId: string): Promise<MFAVerificationResult> {
    try {
      await this.userRepository.disableMFA(userId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable MFA'
      };
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled) {
        return {
          success: false,
          error: 'MFA not enabled for this user'
        };
      }

      const backupCodes = this.generateBackupCodes();
      const encryptedBackupCodes = backupCodes.map(code =>
        EncryptionService.encryptData(code, process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key')
      );

      await this.userRepository.updateBackupCodes(userId, encryptedBackupCodes);

      return {
        success: true,
        backupCodes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate backup codes'
      };
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += charset[Math.floor(Math.random() * charset.length)];
      }
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Check if MFA token is required for current session
   */
  async isMFARequired(userId: string, sessionAge: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled) {
        return false;
      }

      // Require MFA if user has elevated roles
      if (!this.isRequiredForUser(user.roles)) {
        return false;
      }

      // Require MFA every 4 hours for elevated operations
      const MFA_REAUTH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
      
      return sessionAge > MFA_REAUTH_INTERVAL;
    } catch (error) {
      return true; // Fail secure - require MFA if we can't determine
    }
  }
}