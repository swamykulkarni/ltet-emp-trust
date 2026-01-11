import { redisService } from './redis.service';
import { NotificationService } from './notification.service';
import { VALIDATION_CONSTANTS } from '@ltet/shared-constants';

export interface OTPResult {
  success: boolean;
  error?: string;
  otpId?: string;
}

export interface OTPVerificationResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export class OTPService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Generate and send OTP for account unlock
   */
  async generateUnlockOTP(userId: string, employeeId: string, email: string, phone: string): Promise<OTPResult> {
    try {
      // Generate 6-digit OTP
      const otp = this.generateOTP();
      const otpId = `unlock_otp:${userId}:${Date.now()}`;
      
      // Store OTP in Redis with expiry
      const otpData = {
        otp,
        userId,
        employeeId,
        email,
        phone,
        type: 'unlock',
        attempts: '0',
        createdAt: new Date().toISOString()
      };

      await redisService.setWithExpiry(
        otpId, 
        JSON.stringify(otpData), 
        VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES * 60
      );

      // Send OTP via email and SMS
      const emailResult = await this.notificationService.sendEmail({
        to: email,
        subject: 'Account Unlock OTP - LTET Portal',
        template: 'unlock-otp',
        data: {
          employeeId,
          otp,
          expiryMinutes: VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES
        }
      });

      const smsResult = await this.notificationService.sendSMS({
        to: phone,
        message: `Your LTET Portal account unlock OTP is: ${otp}. Valid for ${VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES} minutes. Do not share this OTP.`
      });

      if (!emailResult.success && !smsResult.success) {
        return {
          success: false,
          error: 'Failed to send OTP via email or SMS'
        };
      }

      return {
        success: true,
        otpId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate OTP'
      };
    }
  }

  /**
   * Verify OTP for account unlock
   */
  async verifyUnlockOTP(otpId: string, otp: string): Promise<OTPVerificationResult> {
    try {
      // Get OTP data from Redis
      const otpDataStr = await redisService.get(otpId);
      if (!otpDataStr) {
        return {
          success: false,
          error: 'OTP expired or invalid'
        };
      }

      const otpData = JSON.parse(otpDataStr);
      
      // Check attempts
      const attempts = parseInt(otpData.attempts) + 1;
      if (attempts > 3) {
        await redisService.del(otpId);
        return {
          success: false,
          error: 'Too many invalid attempts. Please request a new OTP.'
        };
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        // Update attempts
        otpData.attempts = attempts.toString();
        await redisService.setWithExpiry(
          otpId, 
          JSON.stringify(otpData), 
          await redisService.ttl(otpId)
        );

        return {
          success: false,
          error: `Invalid OTP. ${3 - attempts} attempts remaining.`
        };
      }

      // OTP is valid, delete it
      await redisService.del(otpId);

      return {
        success: true,
        userId: otpData.userId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify OTP'
      };
    }
  }

  /**
   * Generate OTP for password reset
   */
  async generatePasswordResetOTP(userId: string, employeeId: string, email: string, phone: string): Promise<OTPResult> {
    try {
      const otp = this.generateOTP();
      const otpId = `reset_otp:${userId}:${Date.now()}`;
      
      const otpData = {
        otp,
        userId,
        employeeId,
        email,
        phone,
        type: 'password_reset',
        attempts: '0',
        createdAt: new Date().toISOString()
      };

      await redisService.setWithExpiry(
        otpId, 
        JSON.stringify(otpData), 
        VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES * 60
      );

      // Send OTP via email and SMS
      const emailResult = await this.notificationService.sendEmail({
        to: email,
        subject: 'Password Reset OTP - LTET Portal',
        template: 'password-reset-otp',
        data: {
          employeeId,
          otp,
          expiryMinutes: VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES
        }
      });

      const smsResult = await this.notificationService.sendSMS({
        to: phone,
        message: `Your LTET Portal password reset OTP is: ${otp}. Valid for ${VALIDATION_CONSTANTS.OTP_EXPIRY_MINUTES} minutes. Do not share this OTP.`
      });

      if (!emailResult.success && !smsResult.success) {
        return {
          success: false,
          error: 'Failed to send OTP via email or SMS'
        };
      }

      return {
        success: true,
        otpId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate password reset OTP'
      };
    }
  }

  /**
   * Verify password reset OTP
   */
  async verifyPasswordResetOTP(otpId: string, otp: string): Promise<OTPVerificationResult> {
    try {
      const otpDataStr = await redisService.get(otpId);
      if (!otpDataStr) {
        return {
          success: false,
          error: 'OTP expired or invalid'
        };
      }

      const otpData = JSON.parse(otpDataStr);
      
      // Check attempts
      const attempts = parseInt(otpData.attempts) + 1;
      if (attempts > 3) {
        await redisService.del(otpId);
        return {
          success: false,
          error: 'Too many invalid attempts. Please request a new OTP.'
        };
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        otpData.attempts = attempts.toString();
        await redisService.setWithExpiry(
          otpId, 
          JSON.stringify(otpData), 
          await redisService.ttl(otpId)
        );

        return {
          success: false,
          error: `Invalid OTP. ${3 - attempts} attempts remaining.`
        };
      }

      // Don't delete OTP yet - it will be used for password reset
      return {
        success: true,
        userId: otpData.userId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify password reset OTP'
      };
    }
  }

  /**
   * Consume password reset OTP (delete after successful password reset)
   */
  async consumePasswordResetOTP(otpId: string): Promise<void> {
    await redisService.del(otpId);
  }

  /**
   * Check if user has pending OTP
   */
  async hasPendingOTP(userId: string, type: 'unlock' | 'password_reset'): Promise<boolean> {
    try {
      // Search for existing OTP keys for this user
      const pattern = `${type}_otp:${userId}:*`;
      // Note: In production, you might want to use SCAN instead of KEYS for better performance
      // For now, we'll check if any OTP exists by trying to find recent ones
      
      // Check last 5 minutes for existing OTPs
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      for (let timestamp = now; timestamp > fiveMinutesAgo; timestamp -= 1000) {
        const key = `${type}_otp:${userId}:${timestamp}`;
        if (await redisService.exists(key)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}