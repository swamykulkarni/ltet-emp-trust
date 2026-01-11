import { AuthService } from '../auth.service';
import { UserRepository } from '../../repositories/user.repository';
import { UserEntity } from '../../models/user.model';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../repositories/user.repository');
jest.mock('../account-lockout.service');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

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
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    (authService as any).userRepository = mockUserRepository;
    
    // Mock the lockout service
    const mockLockoutService = {
      isAccountLocked: jest.fn().mockResolvedValue({ success: true, isLocked: false }),
      handleFailedLogin: jest.fn().mockResolvedValue({ success: true })
    };
    (authService as any).lockoutService = mockLockoutService;
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const loginData = {
        employeeId: 'EMP001',
        password: 'password123'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');
      mockUserRepository.updateLastLogin.mockResolvedValue();
      mockUserRepository.updateRefreshToken.mockResolvedValue();

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBe('mock-token');
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledWith('EMP001');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should fail login with invalid employee ID', async () => {
      // Arrange
      const loginData = {
        employeeId: 'INVALID',
        password: 'password123'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(null);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it('should fail login with invalid password', async () => {
      // Arrange
      const loginData = {
        employeeId: 'EMP001',
        password: 'wrong-password'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      
      const mockLockoutService = (authService as any).lockoutService;
      mockLockoutService.handleFailedLogin.mockResolvedValue({ success: true });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(mockLockoutService.handleFailedLogin).toHaveBeenCalledWith('user-123');
    });

    it('should fail login when account is locked', async () => {
      // Arrange
      const loginData = {
        employeeId: 'EMP001',
        password: 'password123'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      
      const mockLockoutService = (authService as any).lockoutService;
      mockLockoutService.isAccountLocked.mockResolvedValue({
        success: true,
        isLocked: true,
        lockoutExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Account is locked');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidLoginData = {
        employeeId: '',
        password: ''
      };

      // Act
      const result = await authService.login(invalidLoginData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      // Arrange
      const userId = 'user-123';
      mockUserRepository.clearRefreshToken.mockResolvedValue();

      // Act
      const result = await authService.logout(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUserRepository.clearRefreshToken).toHaveBeenCalledWith(userId);
    });

    it('should handle logout errors', async () => {
      // Arrange
      const userId = 'user-123';
      mockUserRepository.clearRefreshToken.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.logout(userId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      // Arrange
      const token = 'valid-token';
      const mockPayload = {
        userId: 'user-123',
        employeeId: 'EMP001',
        roles: ['employee'],
        iat: 1234567890,
        exp: 1234567890
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
    });

    it('should fail to verify invalid token', async () => {
      // Arrange
      const token = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'old-password';
      const newPassword = 'NewPassword123!';

      mockUserRepository.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.updatePassword.mockResolvedValue();
      mockUserRepository.clearRefreshToken.mockResolvedValue();

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result.success).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, expect.any(Number));
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, 'new-hashed-password');
      expect(mockUserRepository.clearRefreshToken).toHaveBeenCalledWith(userId);
    });

    it('should fail to change password with incorrect current password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'wrong-password';
      const newPassword = 'NewPassword123!';

      mockUserRepository.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should fail to change password with weak new password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'old-password';
      const newPassword = 'weak'; // Too weak

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must');
    });
  });
});