import { UserRepository } from '../repositories/user.repository';
import { OTPService } from './otp.service';
import { redisService } from './redis.service';
import { VALIDATION_CONSTANTS } from '@ltet/shared-constants';

export interface LockoutResult {
  success: boolean;
  error?: string;
  isLocked?: boolean;
  lockoutExpiresAt?: Date;
  attemptsRemaining?: number;
}

export interface UnlockResult {
  success: boolean;
  error?: string;
  otpId?: string;
}

export class AccountLockoutService {
  private userRepository: UserRepository;
  private otpService: OTPService;

  constructor() {
    this.userRepository = new UserRepository();
    this.otpService = new OTPService();
  }

  /**
   * Handle failed login attempt
   */
  async handleFailedLogin(userId: string): Promise<LockoutResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const newFailedAttempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | undefined;
      let isLocked = false;

      // Check if account should be locked
      if (newFailedAttempts >= VALIDATION_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
        // Lock account for 30 minutes
        lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 30);
        isLocked = true;

        // Store lockout info in Redis for faster access
        await redisService.setWithExpiry(
          `lockout:${userId}`,
          JSON.stringify({
            lockedAt: new Date().toISOString(),
            lockedUntil: lockedUntil.toISOString(),
            attempts: newFailedAttempts
          }),
          30 * 60 // 30 minutes
        );
      }

      // Update user in database
      await this.userRepository.updateLoginAttempts(userId, newFailedAttempts, lockedUntil);

      return {
        success: true,
        isLocked,
        lockoutExpiresAt: lockedUntil,
        attemptsRemaining: Math.max(0, VALIDATION_CONSTANTS.MAX_LOGIN_ATTEMPTS - newFailedAttempts)
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to handle failed login'
      };
    }
  }

  /**
   * Check if account is currently locked
   */
  async isAccountLocked(userId: string): Promise<LockoutResult> {
    try {
      // First check Redis for faster access
      const lockoutData = await redisService.get(`lockout:${userId}`);
      if (lockoutData) {
        const lockout = JSON.parse(lockoutData);
        const lockedUntil = new Date(lockout.lockedUntil);
        
        if (lockedUntil > new Date()) {
          return {
            success: true,
            isLocked: true,
            lockoutExpiresAt: lockedUntil,
            attemptsRemaining: 0
          };
        } else {
          // Lockout expired, clean up Redis
          await redisService.del(`lockout:${userId}`);
        }
      }

      // Check database
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const isLocked = user.lockedUntil !== undefined && user.lockedUntil > new Date();
      
      return {
        success: true,
        isLocked,
        lockoutExpiresAt: user.lockedUntil,
        attemptsRemaining: isLocked ? 0 : Math.max(0, VALIDATION_CONSTANTS.MAX_LOGIN_ATTEMPTS - user.failedLoginAttempts)
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check account lockout status'
      };
    }
  }

  /**
   * Request OTP for account unlock
   */
  async requestUnlockOTP(employeeId: string): Promise<UnlockResult> {
    try {
      const user = await this.userRepository.findByEmployeeId(employeeId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Check if account is actually locked
      const lockoutStatus = await this.isAccountLocked(user.userId);
      if (!lockoutStatus.success) {
        return {
          success: false,
          error: lockoutStatus.error
        };
      }

      if (!lockoutStatus.isLocked) {
        return {
          success: false,
          error: 'Account is not locked'
        };
      }

      // Check if user already has a pending OTP
      const hasPendingOTP = await this.otpService.hasPendingOTP(user.userId, 'unlock');
      if (hasPendingOTP) {
        return {
          success: false,
          error: 'An unlock OTP has already been sent. Please wait before requesting a new one.'
        };
      }

      // Generate and send OTP
      const otpResult = await this.otpService.generateUnlockOTP(
        user.userId,
        user.employeeId,
        user.personalInfo.email,
        user.personalInfo.phone
      );

      if (!otpResult.success) {
        return {
          success: false,
          error: otpResult.error
        };
      }

      return {
        success: true,
        otpId: otpResult.otpId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to request unlock OTP'
      };
    }
  }

  /**
   * Unlock account using OTP
   */
  async unlockAccountWithOTP(otpId: string, otp: string): Promise<UnlockResult> {
    try {
      // Verify OTP
      const verificationResult = await this.otpService.verifyUnlockOTP(otpId, otp);
      if (!verificationResult.success) {
        return {
          success: false,
          error: verificationResult.error
        };
      }

      const userId = verificationResult.userId!;

      // Reset failed login attempts and clear lockout
      await this.userRepository.updateLoginAttempts(userId, 0, undefined);

      // Clear lockout from Redis
      await redisService.del(`lockout:${userId}`);

      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to unlock account'
      };
    }
  }

  /**
   * Clear lockout (admin function)
   */
  async clearLockout(userId: string): Promise<LockoutResult> {
    try {
      // Reset failed login attempts and clear lockout
      await this.userRepository.updateLoginAttempts(userId, 0, undefined);

      // Clear lockout from Redis
      await redisService.del(`lockout:${userId}`);

      return {
        success: true,
        isLocked: false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to clear lockout'
      };
    }
  }

  /**
   * Get lockout statistics for monitoring
   */
  async getLockoutStats(): Promise<{ totalLocked: number; recentLockouts: number }> {
    try {
      // This would typically query the database for statistics
      // For now, return mock data
      return {
        totalLocked: 0,
        recentLockouts: 0
      };
    } catch (error) {
      return {
        totalLocked: 0,
        recentLockouts: 0
      };
    }
  }
}