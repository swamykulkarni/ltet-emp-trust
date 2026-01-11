import { AccountLockoutService } from '../account-lockout.service';
import { UserRepository } from '../../repositories/user.repository';
import { OTPService } from '../otp.service';
import { redisService } from '../redis.service';
import { UserEntity } from '../../models/user.model';

// Mock dependencies
jest.mock('../../repositories/user.repository');
jest.mock('../otp.service');
jest.mock('../redis.service');

describe('AccountLockoutService', () => {
  let lockoutService: AccountLockoutService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockOTPService: jest.Mocked<OTPService>;
  let mockRedisService: jest.Mocked<typeof redisService>;

  const mockUser: UserEntity = {
    userId: 'user-123',
    employeeId: 'EMP001',
    passwordHash: 'hashed-password',
    personalInfo: {
      name: 'John Doe',
      email: 'john.doe@lnt.com',
      phone: '9876543210',
      address: {
        street: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India'
      }
    },
    employmentInfo: {
      department: 'Engineering',
      ic: 'LTTS',
      joiningDate: new Date('2020-01-01'),
      status: 'active'
    },
    dependents: [],
    roles: ['employee'],
    failedLoginAttempts: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lockoutService = new AccountLockoutService();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockOTPService = new OTPService() as jest.Mocked<OTPService>;
    mockRedisService = redisService as jest.Mocked<typeof redisService>;
    
    (lockoutService as any).userRepository = mockUserRepository;
    (lockoutService as any).otpService = mockOTPService;
  });

  describe('handleFailedLogin', () => {
    it('should increment failed attempts without locking for attempts below threshold', async () => {
      // Arrange
      const userWithZeroAttempts = { ...mockUser, failedLoginAttempts: 0 };
      mockUserRepository.findById.mockResolvedValue(userWithZeroAttempts);
      mockUserRepository.updateLoginAttempts.mockResolvedValue();

      // Act
      const result = await lockoutService.handleFailedLogin('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(2); // 3 - 1 = 2 (since user has 0 failed attempts initially)
      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
        'user-123', 
        1, // 0 + 1 = 1
        undefined
      );
    });

    it('should lock account when max attempts reached', async () => {
      // Arrange
      const userWithMaxAttempts = { ...mockUser, failedLoginAttempts: 2 };
      mockUserRepository.findById.mockResolvedValue(userWithMaxAttempts);
      mockUserRepository.updateLoginAttempts.mockResolvedValue();
      mockRedisService.setWithExpiry.mockResolvedValue();

      // Act
      const result = await lockoutService.handleFailedLogin('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(true);
      expect(result.lockoutExpiresAt).toBeDefined();
      expect(result.attemptsRemaining).toBe(0);
      expect(mockRedisService.setWithExpiry).toHaveBeenCalledWith(
        'lockout:user-123',
        expect.any(String),
        1800 // 30 minutes
      );
    });

    it('should handle user not found error', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await lockoutService.handleFailedLogin('user-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('isAccountLocked', () => {
    it('should return locked status from Redis when available', async () => {
      // Arrange
      const lockoutData = {
        lockedAt: new Date().toISOString(),
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        attempts: 3
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(lockoutData));

      // Act
      const result = await lockoutService.isAccountLocked('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(true);
      expect(result.lockoutExpiresAt).toBeDefined();
      expect(result.attemptsRemaining).toBe(0);
    });

    it('should check database when Redis data is expired', async () => {
      // Arrange
      const expiredLockoutData = {
        lockedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        lockedUntil: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago (expired)
        attempts: 3
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(expiredLockoutData));
      mockRedisService.del.mockResolvedValue();
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 });

      // Act
      const result = await lockoutService.isAccountLocked('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(2); // 3 - 1 = 2
      expect(mockRedisService.del).toHaveBeenCalledWith('lockout:user-123');
    });

    it('should return not locked for user with no failed attempts', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, failedLoginAttempts: 0 });

      // Act
      const result = await lockoutService.isAccountLocked('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
    });
  });

  describe('requestUnlockOTP', () => {
    it('should successfully request unlock OTP for locked account', async () => {
      // Arrange
      const lockedUser = { 
        ...mockUser, 
        failedLoginAttempts: 3,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      };
      mockUserRepository.findByEmployeeId.mockResolvedValue(lockedUser);
      mockRedisService.get.mockResolvedValue(JSON.stringify({
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }));
      mockOTPService.hasPendingOTP.mockResolvedValue(false);
      mockOTPService.generateUnlockOTP.mockResolvedValue({
        success: true,
        otpId: 'otp-123'
      });

      // Act
      const result = await lockoutService.requestUnlockOTP('EMP001');

      // Assert
      expect(result.success).toBe(true);
      expect(result.otpId).toBe('otp-123');
      expect(mockOTPService.generateUnlockOTP).toHaveBeenCalledWith(
        'user-123',
        'EMP001',
        'john.doe@lnt.com',
        '9876543210'
      );
    });

    it('should fail when account is not locked', async () => {
      // Arrange
      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      mockRedisService.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 });

      // Act
      const result = await lockoutService.requestUnlockOTP('EMP001');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is not locked');
    });

    it('should fail when user has pending OTP', async () => {
      // Arrange
      const lockedUser = { 
        ...mockUser, 
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
      };
      mockUserRepository.findByEmployeeId.mockResolvedValue(lockedUser);
      mockRedisService.get.mockResolvedValue(JSON.stringify({
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }));
      mockOTPService.hasPendingOTP.mockResolvedValue(true);

      // Act
      const result = await lockoutService.requestUnlockOTP('EMP001');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('An unlock OTP has already been sent');
    });
  });

  describe('unlockAccountWithOTP', () => {
    it('should successfully unlock account with valid OTP', async () => {
      // Arrange
      mockOTPService.verifyUnlockOTP.mockResolvedValue({
        success: true,
        userId: 'user-123'
      });
      mockUserRepository.updateLoginAttempts.mockResolvedValue();
      mockRedisService.del.mockResolvedValue();

      // Act
      const result = await lockoutService.unlockAccountWithOTP('otp-123', '123456');

      // Assert
      expect(result.success).toBe(true);
      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith('user-123', 0, undefined);
      expect(mockRedisService.del).toHaveBeenCalledWith('lockout:user-123');
    });

    it('should fail with invalid OTP', async () => {
      // Arrange
      mockOTPService.verifyUnlockOTP.mockResolvedValue({
        success: false,
        error: 'Invalid OTP'
      });

      // Act
      const result = await lockoutService.unlockAccountWithOTP('otp-123', '123456');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid OTP');
    });
  });

  describe('clearLockout', () => {
    it('should successfully clear lockout (admin function)', async () => {
      // Arrange
      mockUserRepository.updateLoginAttempts.mockResolvedValue();
      mockRedisService.del.mockResolvedValue();

      // Act
      const result = await lockoutService.clearLockout('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(false);
      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith('user-123', 0, undefined);
      expect(mockRedisService.del).toHaveBeenCalledWith('lockout:user-123');
    });
  });
});