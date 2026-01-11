import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { LoginRequest, LoginResponse, JWTPayload, User } from '@ltet/shared-types';
import { LoginValidator, PasswordValidator, ValidationHelper } from '@ltet/shared-validation';
import { UserRepository } from '../repositories/user.repository';
import { UserEntity } from '../models/user.model';
import { environment } from '../environments/environment';
import { VALIDATION_CONSTANTS } from '@ltet/shared-constants';
import { AccountLockoutService } from './account-lockout.service';
import { MFAService } from './mfa.service';
import { AuditLoggerService } from '@ltet/shared-utils';

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  requiresMFA?: boolean;
  mfaToken?: string;
  error?: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private loginValidator: LoginValidator;
  private passwordValidator: PasswordValidator;
  private lockoutService: AccountLockoutService;
  private mfaService: MFAService;
  private auditLogger: AuditLoggerService;

  constructor() {
    this.userRepository = new UserRepository();
    this.loginValidator = new LoginValidator();
    this.passwordValidator = new PasswordValidator();
    this.lockoutService = new AccountLockoutService();
    this.mfaService = new MFAService();
    this.auditLogger = AuditLoggerService.getInstance();
  }

  async login(loginData: LoginRequest, ipAddress: string = 'unknown', userAgent: string = 'unknown'): Promise<AuthResult> {
    try {
      // Validate input
      ValidationHelper.validateAndThrow(this.loginValidator, loginData);

      // Find user by employee ID
      const userEntity = await this.userRepository.findByEmployeeId(loginData.employeeId);
      if (!userEntity) {
        // Log failed login attempt
        await this.auditLogger.logAuthEvent(
          loginData.employeeId,
          'login',
          false,
          ipAddress,
          userAgent,
          'unknown',
          { loginMethod: 'password' },
          'Invalid credentials'
        );
        
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check if account is locked
      const lockoutStatus = await this.lockoutService.isAccountLocked(userEntity.userId);
      if (lockoutStatus.success && lockoutStatus.isLocked) {
        // Log locked account access attempt
        await this.auditLogger.logAuthEvent(
          userEntity.userId,
          'login',
          false,
          ipAddress,
          userAgent,
          'unknown',
          { 
            loginMethod: 'password',
            userRole: userEntity.roles.join(','),
            accountLocked: true
          },
          'Account locked'
        );
        
        return {
          success: false,
          error: `Account is locked until ${lockoutStatus.lockoutExpiresAt?.toLocaleString()}. Use OTP unlock to regain access.`
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, userEntity.passwordHash);
      if (!isPasswordValid) {
        await this.lockoutService.handleFailedLogin(userEntity.userId);
        
        // Log failed login attempt
        await this.auditLogger.logAuthEvent(
          userEntity.userId,
          'login',
          false,
          ipAddress,
          userAgent,
          'unknown',
          { 
            loginMethod: 'password',
            userRole: userEntity.roles.join(',')
          },
          'Invalid password'
        );
        
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check if MFA is required
      const requiresMFA = this.mfaService.isRequiredForUser(userEntity.roles) && userEntity.mfaEnabled;
      
      if (requiresMFA) {
        // Generate temporary MFA token for second step
        const mfaToken = this.generateMFAToken(userEntity.userId);
        
        // Log successful password verification (MFA pending)
        await this.auditLogger.logAuthEvent(
          userEntity.userId,
          'login',
          true,
          ipAddress,
          userAgent,
          'mfa_pending',
          { 
            loginMethod: 'password',
            userRole: userEntity.roles.join(','),
            mfaRequired: true,
            step: 'password_verified'
          }
        );
        
        return {
          success: true,
          requiresMFA: true,
          mfaToken,
          user: this.toPublicUser(userEntity)
        };
      }

      // Generate tokens for complete login
      const { token, refreshToken, expiresIn } = await this.generateTokens(userEntity);

      // Update last login and clear failed attempts
      await this.userRepository.updateLastLogin(userEntity.userId);

      // Log successful login
      await this.auditLogger.logAuthEvent(
        userEntity.userId,
        'login',
        true,
        ipAddress,
        userAgent,
        'session_created',
        { 
          loginMethod: 'password',
          userRole: userEntity.roles.join(','),
          mfaUsed: false
        }
      );

      // Convert to public user object
      const user = this.toPublicUser(userEntity);

      return {
        success: true,
        user,
        token,
        refreshToken,
        expiresIn
      };
    } catch (error: any) {
      // Log system error
      await this.auditLogger.logSystemEvent(
        'login_system_error',
        'authentication',
        false,
        { error: error.message },
        error.message
      );
      
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  async logout(userId: string, sessionId: string = 'unknown', ipAddress: string = 'unknown', userAgent: string = 'unknown'): Promise<{ success: boolean; error?: string }> {
    try {
      await this.userRepository.clearRefreshToken(userId);
      
      // Log logout event
      await this.auditLogger.logAuthEvent(
        userId,
        'logout',
        true,
        ipAddress,
        userAgent,
        sessionId,
        { logoutType: 'user_initiated' }
      );
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Logout failed'
      };
    }
  }

  /**
   * Complete MFA login process
   */
  async completeMFALogin(mfaToken: string, mfaCode: string, ipAddress: string = 'unknown', userAgent: string = 'unknown'): Promise<AuthResult> {
    try {
      // Verify MFA token
      const mfaPayload = this.verifyMFAToken(mfaToken);
      if (!mfaPayload) {
        return {
          success: false,
          error: 'Invalid or expired MFA token'
        };
      }

      // Get user
      const userEntity = await this.userRepository.findById(mfaPayload.userId);
      if (!userEntity) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify MFA code
      const mfaResult = await this.mfaService.verifyMFAToken(userEntity.userId, mfaCode);
      if (!mfaResult.success) {
        // Log failed MFA verification
        await this.auditLogger.logAuthEvent(
          userEntity.userId,
          'login',
          false,
          ipAddress,
          userAgent,
          'mfa_failed',
          { 
            loginMethod: 'mfa',
            userRole: userEntity.roles.join(','),
            step: 'mfa_verification'
          },
          mfaResult.error
        );
        
        return {
          success: false,
          error: mfaResult.error
        };
      }

      // Generate tokens for complete login
      const { token, refreshToken, expiresIn } = await this.generateTokens(userEntity);

      // Update last login and clear failed attempts
      await this.userRepository.updateLastLogin(userEntity.userId);

      // Log successful MFA login
      await this.auditLogger.logAuthEvent(
        userEntity.userId,
        'login',
        true,
        ipAddress,
        userAgent,
        'session_created',
        { 
          loginMethod: 'password_mfa',
          userRole: userEntity.roles.join(','),
          mfaUsed: true,
          step: 'complete'
        }
      );

      // Convert to public user object
      const user = this.toPublicUser(userEntity);

      return {
        success: true,
        user,
        token,
        refreshToken,
        expiresIn
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'MFA login failed'
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, environment.jwtSecret) as JWTPayload;
      
      // Find user and verify refresh token
      const userEntity = await this.userRepository.findById(decoded.userId);
      if (!userEntity || userEntity.refreshToken !== refreshToken) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      // Check if refresh token is expired
      if (userEntity.refreshTokenExpiresAt && userEntity.refreshTokenExpiresAt < new Date()) {
        await this.userRepository.clearRefreshToken(userEntity.userId);
        return {
          success: false,
          error: 'Refresh token expired'
        };
      }

      // Generate new tokens
      const tokens = await this.generateTokens(userEntity);
      const user = this.toPublicUser(userEntity);

      return {
        success: true,
        user,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Invalid refresh token'
      };
    }
  }

  async verifyToken(token: string): Promise<{ valid: boolean; payload?: JWTPayload; error?: string }> {
    try {
      const payload = jwt.verify(token, environment.jwtSecret) as JWTPayload;
      return {
        valid: true,
        payload
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate new password
      ValidationHelper.validateAndThrow(this.passwordValidator, newPassword);

      // Find user
      const userEntity = await this.userRepository.findById(userId);
      if (!userEntity) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userEntity.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, environment.bcryptRounds);

      // Update password
      await this.userRepository.updatePassword(userId, newPasswordHash);

      // Clear all refresh tokens to force re-login
      await this.userRepository.clearRefreshToken(userId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.validationErrors ? 
          error.validationErrors.map((e: any) => e.message).join(', ') : 
          error.message || 'Password change failed'
      };
    }
  }

  private async generateTokens(userEntity: UserEntity): Promise<{ token: string; refreshToken: string; expiresIn: number }> {
    const payload: JWTPayload = {
      userId: userEntity.userId,
      employeeId: userEntity.employeeId,
      roles: userEntity.roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiryToSeconds(environment.jwtExpiresIn)
    };

    const token = jwt.sign(payload, environment.jwtSecret, {
      expiresIn: environment.jwtExpiresIn
    });

    const refreshTokenPayload = {
      userId: userEntity.userId,
      type: 'refresh'
    };

    const refreshToken = jwt.sign(refreshTokenPayload, environment.jwtSecret, {
      expiresIn: environment.refreshTokenExpiresIn
    });

    // Store refresh token in database
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setTime(
      refreshTokenExpiresAt.getTime() + this.parseExpiryToSeconds(environment.refreshTokenExpiresIn) * 1000
    );

    await this.userRepository.updateRefreshToken(userEntity.userId, refreshToken, refreshTokenExpiresAt);

    return {
      token,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(environment.jwtExpiresIn)
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60; // Default to 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  /**
   * Generate temporary MFA token for two-step authentication
   */
  private generateMFAToken(userId: string): string {
    const payload = {
      userId,
      type: 'mfa',
      exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes expiry
    };

    return jwt.sign(payload, environment.jwtSecret);
  }

  /**
   * Verify MFA token
   */
  private verifyMFAToken(token: string): { userId: string } | null {
    try {
      const payload = jwt.verify(token, environment.jwtSecret) as any;
      if (payload.type !== 'mfa') {
        return null;
      }
      return { userId: payload.userId };
    } catch (error) {
      return null;
    }
  }

  private toPublicUser(userEntity: UserEntity): User {
    return {
      userId: userEntity.userId,
      employeeId: userEntity.employeeId,
      personalInfo: userEntity.personalInfo,
      employmentInfo: userEntity.employmentInfo,
      bankDetails: userEntity.bankDetails,
      dependents: userEntity.dependents,
      roles: userEntity.roles,
      createdAt: userEntity.createdAt,
      updatedAt: userEntity.updatedAt
    };
  }
}